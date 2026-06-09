import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { desc, eq } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { conversations, files, messages, proofSnapshots, toolCalls, type StoredFile } from "./schema.js";

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

  function ensureConversation(conversationId?: string | null, title = "Chronofact conversation") {
    const id = conversationId || nextId("conv", "conversations", "conversation_id");
    const existing = db.select().from(conversations).where(eq(conversations.conversationId, id)).get();
    if (existing) {
      return existing;
    }
    const timestamp = now();
    const conversation = {
      conversationId: id,
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

    ensureConversation,

    addMessage({ conversationId, role, content }: { conversationId: string; role: string; content: string }) {
      ensureConversation(conversationId);
      const message = {
        messageId: nextId("msg", "messages", "message_id"),
        conversationId,
        role,
        content,
        createdAt: now()
      };
      db.insert(messages).values(message).run();
      touchConversation(db, conversationId, now());
      return message;
    },

    addFile(input: {
      conversationId: string;
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

    listConversations() {
      return db.select().from(conversations).orderBy(desc(conversations.updatedAt)).all();
    },

    describeConversation(conversationId: string) {
      const conversation = db.select().from(conversations).where(eq(conversations.conversationId, conversationId)).get();
      if (!conversation) {
        return null;
      }
      return {
        conversation,
        messages: db.select().from(messages).where(eq(messages.conversationId, conversationId)).all(),
        files: db.select().from(files).where(eq(files.conversationId, conversationId)).all(),
        tool_calls: db.select().from(toolCalls).where(eq(toolCalls.conversationId, conversationId)).all(),
        proof_snapshots: db.select().from(proofSnapshots).where(eq(proofSnapshots.conversationId, conversationId)).all()
      };
    }
  };
}

function migrate(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      message_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      file_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT,
      storage_path TEXT,
      proof_id TEXT,
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
  `);
}

function touchConversation(db: BetterSQLite3Database, conversationId: string, updatedAt: string) {
  db.update(conversations).set({ updatedAt }).where(eq(conversations.conversationId, conversationId)).run();
}
