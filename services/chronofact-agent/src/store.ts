import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { asc, desc, eq } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  agentRuns,
  conversations,
  documentVersions,
  documents,
  files,
  messages,
  proofSnapshots,
  toolCalls,
  type Document,
  type DocumentVersion,
  type StoredFile
} from "./schema.js";

export type AgentStore = ReturnType<typeof createAgentStore>;

export function createAgentStore({ dataDir, clock = () => new Date() }: { dataDir: string; clock?: () => Date }) {
  mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(join(dataDir, "chronofact-agent.sqlite"));
  sqlite.pragma("journal_mode = WAL");
  migrate(sqlite);
  const db = drizzle(sqlite);

  function now() {
    return clock().toISOString();
  }

  function nextId(prefix: string, table: string, column: string) {
    const row = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    return `${prefix}_${String(row.count + 1).padStart(3, "0")}`;
  }

  function ensureConversation(conversationId?: string | null, title = "Chronofact conversation", organizationId = "org_001") {
    const id = conversationId || nextId("conv", "conversations", "conversation_id");
    const existing = db.select().from(conversations).where(eq(conversations.conversationId, id)).get();
    if (existing) {
      return existing;
    }
    const timestamp = now();
    const conversation = {
      conversationId: id,
      organizationId,
      title,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.insert(conversations).values(conversation).run();
    return conversation;
  }

  return {
    close() {
      sqlite.close();
    },

    recoverInterruptedRuns(message = "Agent service restarted before this run completed.") {
      const runningRuns = db.select().from(agentRuns).where(eq(agentRuns.status, "running")).all();
      const timestamp = now();
      for (const run of runningRuns) {
        db.update(messages)
          .set({
            content: "这次检查被服务重启打断了。请重新发送一次，我会继续处理。",
            status: "failed"
          })
          .where(eq(messages.messageId, run.assistantMessageId))
          .run();
        db.update(agentRuns)
          .set({
            status: "failed",
            error: message,
            updatedAt: timestamp,
            completedAt: timestamp
          })
          .where(eq(agentRuns.runId, run.runId))
          .run();
        touchConversation(db, run.conversationId, timestamp);
      }
      return runningRuns.length;
    },

    ensureConversation,

    createConversation(input: { conversationId?: string | null; title?: string | null; organizationId?: string | null } = {}) {
      return ensureConversation(input.conversationId, input.title || "新对话", input.organizationId ?? "org_001");
    },

    updateConversationTitle({ conversationId, title }: { conversationId: string; title: string }) {
      db.update(conversations).set({ title, updatedAt: now() }).where(eq(conversations.conversationId, conversationId)).run();
    },

    addMessage({
      conversationId,
      role,
      content,
      status = "completed",
      metadata
    }: {
      conversationId: string;
      role: string;
      content: string;
      status?: "completed" | "running" | "failed";
      metadata?: unknown;
    }) {
      ensureConversation(conversationId);
      const message = {
        messageId: nextId("msg", "messages", "message_id"),
        conversationId,
        role,
        content,
        status,
        metadataJson: metadata === undefined ? null : JSON.stringify(metadata),
        createdAt: now()
      };
      db.insert(messages).values(message).run();
      touchConversation(db, conversationId, now());
      return message;
    },

    updateMessage({
      messageId,
      content,
      status,
      metadata
    }: {
      messageId: string;
      content?: string;
      status?: "completed" | "running" | "failed";
      metadata?: unknown;
    }) {
      const existing = db.select().from(messages).where(eq(messages.messageId, messageId)).get();
      if (!existing) {
        return null;
      }
      const patch: Record<string, unknown> = {};
      if (content !== undefined) patch.content = content;
      if (status !== undefined) patch.status = status;
      if (metadata !== undefined) patch.metadataJson = JSON.stringify(metadata);
      db.update(messages).set(patch as any).where(eq(messages.messageId, messageId)).run();
      touchConversation(db, existing.conversationId, now());
      return db.select().from(messages).where(eq(messages.messageId, messageId)).get() ?? null;
    },

    createRun(input: {
      conversationId: string;
      userMessageId: string;
      assistantMessageId: string;
      fileId?: string | null;
      action?: string | null;
    }) {
      ensureConversation(input.conversationId);
      const timestamp = now();
      const row = {
        runId: nextId("run", "agent_runs", "run_id"),
        conversationId: input.conversationId,
        userMessageId: input.userMessageId,
        assistantMessageId: input.assistantMessageId,
        fileId: input.fileId ?? null,
        action: input.action ?? null,
        status: "running",
        error: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null
      };
      db.insert(agentRuns).values(row).run();
      touchConversation(db, input.conversationId, timestamp);
      return row;
    },

    updateRun({
      runId,
      status,
      action,
      error
    }: {
      runId: string;
      status?: "running" | "completed" | "failed";
      action?: string | null;
      error?: string | null;
    }) {
      const existing = db.select().from(agentRuns).where(eq(agentRuns.runId, runId)).get();
      if (!existing) {
        return null;
      }
      const timestamp = now();
      const patch: Record<string, unknown> = {
        updatedAt: timestamp
      };
      if (status !== undefined) {
        patch.status = status;
        patch.completedAt = status === "completed" || status === "failed" ? timestamp : null;
      }
      if (action !== undefined) patch.action = action;
      if (error !== undefined) patch.error = error;
      db.update(agentRuns).set(patch as any).where(eq(agentRuns.runId, runId)).run();
      touchConversation(db, existing.conversationId, timestamp);
      return db.select().from(agentRuns).where(eq(agentRuns.runId, runId)).get() ?? null;
    },

    addFile(input: {
      conversationId: string;
      organizationId?: string | null;
      filename: string;
      sha256: string;
      size: number;
      mimeType?: string | null;
      storagePath?: string | null;
    }) {
      ensureConversation(input.conversationId);
      const file = {
        fileId: nextId("file", "files", "file_id"),
        conversationId: input.conversationId,
        organizationId: input.organizationId ?? "org_001",
        documentId: null,
        documentVersionId: null,
        filename: input.filename,
        sha256: input.sha256,
        size: input.size,
        mimeType: input.mimeType ?? null,
        storagePath: input.storagePath ?? null,
        proofId: null,
        createdAt: now()
      };
      db.insert(files).values(file).run();
      touchConversation(db, input.conversationId, now());
      return file;
    },

    setFileProof({ fileId, proofId }: { fileId: string; proofId: string | null }) {
      db.update(files).set({ proofId }).where(eq(files.fileId, fileId)).run();
    },

    attachFileDocumentVersion({
      fileId,
      documentId,
      documentVersionId,
      proofId
    }: {
      fileId: string;
      documentId: string | null;
      documentVersionId: string | null;
      proofId?: string | null;
    }) {
      db.update(files)
        .set({
          documentId,
          documentVersionId,
          ...(proofId !== undefined ? { proofId } : {})
        })
        .where(eq(files.fileId, fileId))
        .run();
      return db.select().from(files).where(eq(files.fileId, fileId)).get() ?? null;
    },

    getFile(fileId: string): StoredFile | null {
      return db.select().from(files).where(eq(files.fileId, fileId)).get() ?? null;
    },

    latestFile(conversationId: string): StoredFile | null {
      return db
        .select()
        .from(files)
        .where(eq(files.conversationId, conversationId))
        .orderBy(desc(files.createdAt))
        .get() ?? null;
    },

    latestPreservedFileByFilename({ filename, excludeFileId }: { filename: string; excludeFileId?: string | null }): StoredFile | null {
      return db
        .select()
        .from(files)
        .where(eq(files.filename, filename))
        .orderBy(desc(files.createdAt))
        .all()
        .find((file) => file.fileId !== excludeFileId && Boolean(file.proofId)) ?? null;
    },

    matchDocumentForFile({
      organizationId,
      filename,
      sha256,
      excludeFileId
    }: {
      organizationId: string;
      filename: string;
      sha256: string;
      excludeFileId?: string | null;
    }) {
      const exactVersion = db.select().from(documentVersions).where(eq(documentVersions.sha256, sha256)).all()
        .map((version) => ({ version, document: db.select().from(documents).where(eq(documents.documentId, version.documentId)).get() }))
        .find(({ document, version }) => Boolean(document) && document!.organizationId === organizationId && version.fileId !== excludeFileId);
      if (exactVersion?.document) {
        return {
          type: "exact" as const,
          document: exactVersion.document,
          version: exactVersion.version
        };
      }

      const normalizedName = normalizeDocumentName(filename);
      const sameNameDocument = db.select().from(documents)
        .where(eq(documents.normalizedName, normalizedName))
        .orderBy(desc(documents.updatedAt))
        .all()
        .find((document) => document.organizationId === organizationId) ?? null;
      if (sameNameDocument) {
        const latestVersion = sameNameDocument.latestVersionId
          ? db.select().from(documentVersions).where(eq(documentVersions.documentVersionId, sameNameDocument.latestVersionId)).get() ?? null
          : null;
        return {
          type: "same_name" as const,
          document: sameNameDocument,
          version: latestVersion
        };
      }

      return {
        type: "none" as const,
        document: null,
        version: null
      };
    },

    getDocument(documentId: string): Document | null {
      return db.select().from(documents).where(eq(documents.documentId, documentId)).get() ?? null;
    },

    getDocumentVersion(documentVersionId: string): DocumentVersion | null {
      return db.select().from(documentVersions).where(eq(documentVersions.documentVersionId, documentVersionId)).get() ?? null;
    },

    latestDocumentVersion(documentId: string): DocumentVersion | null {
      return db.select().from(documentVersions)
        .where(eq(documentVersions.documentId, documentId))
        .orderBy(desc(documentVersions.versionNo))
        .get() ?? null;
    },

    createDocumentVersion(input: {
      organizationId: string;
      fileId: string;
      filename: string;
      sha256: string;
      proofId: string | null;
      assetId: string | null;
      chronofactVersionId: string | null;
      documentId?: string | null;
    }) {
      const timestamp = now();
      let document = input.documentId ? db.select().from(documents).where(eq(documents.documentId, input.documentId)).get() ?? null : null;
      if (!document) {
        document = {
          documentId: nextId("doc", "documents", "document_id"),
          organizationId: input.organizationId,
          displayName: input.filename,
          normalizedName: normalizeDocumentName(input.filename),
          latestVersionId: null,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        db.insert(documents).values(document).run();
      }
      const latestVersion = db.select().from(documentVersions)
        .where(eq(documentVersions.documentId, document.documentId))
        .orderBy(desc(documentVersions.versionNo))
        .get();
      const version = {
        documentVersionId: nextId("docver", "document_versions", "document_version_id"),
        documentId: document.documentId,
        fileId: input.fileId,
        sha256: input.sha256,
        versionNo: (latestVersion?.versionNo ?? 0) + 1,
        proofId: input.proofId,
        assetId: input.assetId,
        chronofactVersionId: input.chronofactVersionId,
        createdAt: timestamp
      };
      db.insert(documentVersions).values(version).run();
      db.update(documents)
        .set({
          displayName: input.filename,
          latestVersionId: version.documentVersionId,
          updatedAt: timestamp
        })
        .where(eq(documents.documentId, document.documentId))
        .run();
      db.update(files)
        .set({
          documentId: document.documentId,
          documentVersionId: version.documentVersionId,
          proofId: input.proofId
        })
        .where(eq(files.fileId, input.fileId))
        .run();
      return {
        document: db.select().from(documents).where(eq(documents.documentId, document.documentId)).get()!,
        version
      };
    },

    addToolCall(input: {
      conversationId: string;
      toolName: string;
      input: unknown;
      output?: unknown;
      status: "completed" | "failed";
    }) {
      const row = {
        toolCallId: nextId("tool", "tool_calls", "tool_call_id"),
        conversationId: input.conversationId,
        toolName: input.toolName,
        inputJson: JSON.stringify(input.input),
        outputJson: input.output === undefined ? null : JSON.stringify(input.output),
        status: input.status,
        createdAt: now()
      };
      db.insert(toolCalls).values(row).run();
      touchConversation(db, input.conversationId, now());
      return row;
    },

    addProofSnapshot(input: {
      conversationId: string;
      fileId?: string | null;
      proofId?: string | null;
      sha256?: string | null;
      snapshot: unknown;
    }) {
      const row = {
        proofSnapshotId: nextId("proofsnap", "proof_snapshots", "proof_snapshot_id"),
        conversationId: input.conversationId,
        fileId: input.fileId ?? null,
        proofId: input.proofId ?? null,
        sha256: input.sha256 ?? null,
        snapshotJson: JSON.stringify(input.snapshot),
        createdAt: now()
      };
      db.insert(proofSnapshots).values(row).run();
      touchConversation(db, input.conversationId, now());
      return row;
    },

    latestProofSnapshot(conversationId: string) {
      return db
        .select()
        .from(proofSnapshots)
        .where(eq(proofSnapshots.conversationId, conversationId))
        .orderBy(desc(proofSnapshots.createdAt))
        .get() ?? null;
    },

    latestProofSnapshotForFile(fileId: string) {
      return db
        .select()
        .from(proofSnapshots)
        .where(eq(proofSnapshots.fileId, fileId))
        .orderBy(desc(proofSnapshots.createdAt))
        .get() ?? null;
    },

    listConversations(input: { organizationId?: string | null } = {}) {
      const rows = db.select().from(conversations).orderBy(desc(conversations.updatedAt)).all();
      return input.organizationId
        ? rows.filter((conversation) => conversation.organizationId === input.organizationId)
        : rows;
    },

    listDocumentLibrary(organizationId: string) {
      const orgDocuments = db.select().from(documents).orderBy(desc(documents.updatedAt)).all()
        .filter((document) => document.organizationId === organizationId);
      const allVersions = db.select().from(documentVersions).orderBy(asc(documentVersions.versionNo)).all();
      const allFiles = db.select().from(files).orderBy(desc(files.createdAt)).all()
        .filter((file) => file.organizationId === organizationId);

      return {
        documents: orgDocuments.map((document) => {
          const versions = allVersions
            .filter((version) => version.documentId === document.documentId)
            .map((version) => ({
              version,
              file: allFiles.find((file) => file.fileId === version.fileId) ?? null
            }));
          return {
            document,
            latestVersion: versions.find((entry) => entry.version.documentVersionId === document.latestVersionId)?.version
              ?? versions.at(-1)?.version
              ?? null,
            versions
          };
        }),
        unversionedFiles: allFiles.filter((file) => !file.documentVersionId)
      };
    },

    describeConversation(conversationId: string) {
      const conversation = db.select().from(conversations).where(eq(conversations.conversationId, conversationId)).get();
      if (!conversation) {
        return null;
      }
      return {
        conversation,
        messages: db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt)).all(),
        files: db.select().from(files).where(eq(files.conversationId, conversationId)).orderBy(asc(files.createdAt)).all(),
        tool_calls: db.select().from(toolCalls).where(eq(toolCalls.conversationId, conversationId)).orderBy(asc(toolCalls.createdAt)).all(),
        proof_snapshots: db.select().from(proofSnapshots).where(eq(proofSnapshots.conversationId, conversationId)).orderBy(asc(proofSnapshots.createdAt)).all(),
        runs: db.select().from(agentRuns).where(eq(agentRuns.conversationId, conversationId)).orderBy(asc(agentRuns.createdAt)).all()
      };
    },

    describeFile(file: StoredFile) {
      const document = file.documentId ? db.select().from(documents).where(eq(documents.documentId, file.documentId)).get() ?? null : null;
      const version = file.documentVersionId ? db.select().from(documentVersions).where(eq(documentVersions.documentVersionId, file.documentVersionId)).get() ?? null : null;
      return { document, version };
    }
  };
}

function migrate(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_001',
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      message_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      file_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      organization_id TEXT NOT NULL DEFAULT 'org_001',
      document_id TEXT,
      document_version_id TEXT,
      filename TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT,
      storage_path TEXT,
      proof_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      document_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      latest_version_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS document_versions (
      document_version_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      version_no INTEGER NOT NULL,
      proof_id TEXT,
      asset_id TEXT,
      chronofact_version_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tool_calls (
      tool_call_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      input_json TEXT NOT NULL,
      output_json TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS proof_snapshots (
      proof_snapshot_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      file_id TEXT,
      proof_id TEXT,
      sha256 TEXT,
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_runs (
      run_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_message_id TEXT NOT NULL,
      assistant_message_id TEXT NOT NULL,
      file_id TEXT,
      action TEXT,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
  `);
  addColumnIfMissing(sqlite, "messages", "metadata_json", "TEXT");
  addColumnIfMissing(sqlite, "messages", "status", "TEXT NOT NULL DEFAULT 'completed'");
  addColumnIfMissing(sqlite, "conversations", "organization_id", "TEXT NOT NULL DEFAULT 'org_001'");
  addColumnIfMissing(sqlite, "files", "organization_id", "TEXT NOT NULL DEFAULT 'org_001'");
  addColumnIfMissing(sqlite, "files", "document_id", "TEXT");
  addColumnIfMissing(sqlite, "files", "document_version_id", "TEXT");
}

function touchConversation(db: BetterSQLite3Database, conversationId: string, updatedAt: string) {
  db.update(conversations).set({ updatedAt }).where(eq(conversations.conversationId, conversationId)).run();
}

function addColumnIfMissing(sqlite: Database.Database, table: string, column: string, definition: string) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((entry) => entry.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function normalizeDocumentName(filename: string) {
  return filename.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
