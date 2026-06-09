import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conversations = sqliteTable("conversations", {
  conversationId: text("conversation_id").primaryKey(),
  organizationId: text("organization_id").notNull().default("org_001"),
  title: text("title").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const messages = sqliteTable("messages", {
  messageId: text("message_id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull(),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull()
});

export const files = sqliteTable("files", {
  fileId: text("file_id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  organizationId: text("organization_id").notNull().default("org_001"),
  documentId: text("document_id"),
  documentVersionId: text("document_version_id"),
  filename: text("filename").notNull(),
  sha256: text("sha256").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type"),
  storagePath: text("storage_path"),
  proofId: text("proof_id"),
  createdAt: text("created_at").notNull()
});

export const documents = sqliteTable("documents", {
  documentId: text("document_id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  displayName: text("display_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  latestVersionId: text("latest_version_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const documentVersions = sqliteTable("document_versions", {
  documentVersionId: text("document_version_id").primaryKey(),
  documentId: text("document_id").notNull(),
  fileId: text("file_id").notNull(),
  sha256: text("sha256").notNull(),
  versionNo: integer("version_no").notNull(),
  proofId: text("proof_id"),
  assetId: text("asset_id"),
  chronofactVersionId: text("chronofact_version_id"),
  createdAt: text("created_at").notNull()
});

export const toolCalls = sqliteTable("tool_calls", {
  toolCallId: text("tool_call_id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  toolName: text("tool_name").notNull(),
  inputJson: text("input_json").notNull(),
  outputJson: text("output_json"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull()
});

export const proofSnapshots = sqliteTable("proof_snapshots", {
  proofSnapshotId: text("proof_snapshot_id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  fileId: text("file_id"),
  proofId: text("proof_id"),
  sha256: text("sha256"),
  snapshotJson: text("snapshot_json").notNull(),
  createdAt: text("created_at").notNull()
});

export const agentRuns = sqliteTable("agent_runs", {
  runId: text("run_id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  userMessageId: text("user_message_id").notNull(),
  assistantMessageId: text("assistant_message_id").notNull(),
  fileId: text("file_id"),
  action: text("action"),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at")
});

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type StoredFile = typeof files.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type ToolCall = typeof toolCalls.$inferSelect;
export type ProofSnapshot = typeof proofSnapshots.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
