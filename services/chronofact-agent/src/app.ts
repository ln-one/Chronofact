import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { ZodError } from "zod";
import { createAgentService } from "./agent.js";
import { createChronofactClient } from "./chronofactClient.js";
import { createAgentLlmClient } from "./llmClient.js";
import { createAgentStore } from "./store.js";

const defaultDataDir = join(process.cwd(), ".cache", "chronofact-agent");

export function createChronofactAgentApp({
  dataDir = defaultDataDir,
  env = process.env,
  fetchImpl = globalThis.fetch
}: {
  dataDir?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
} = {}) {
  const store = createAgentStore({ dataDir });
  const chronofactClient = createChronofactClient({
    baseUrl: env.CHRONOFACT_API_URL || "http://127.0.0.1:3001",
    fetchImpl
  });
  const llmClient = createAgentLlmClient({ env, fetchImpl });
  const agent = createAgentService({
    store,
    chronofactClient,
    uploadDir: join(dataDir, "uploads"),
    llmClient
  });

  return {
    close: () => store.close(),
    handler: async (request: IncomingMessage, response: ServerResponse) => {
      try {
        const url = new URL(request.url ?? "/", "http://localhost");

        if (request.method === "OPTIONS") {
          response.writeHead(204, corsHeaders());
          response.end();
          return;
        }

        if (request.method === "GET" && url.pathname === "/health") {
          return sendJson(response, 200, {
            status: "ok",
            service: "chronofact-agent",
            llm: {
              configured: llmClient.configured,
              model: llmClient.configured ? llmClient.model : null
            }
          });
        }

        if (request.method === "POST" && url.pathname === "/agent/files") {
          const body = await readJson(request);
          return sendJson(response, 201, await agent.uploadFile(body));
        }

        if (request.method === "POST" && url.pathname === "/agent/chat") {
          const body = await readJson(request);
          return sendJson(response, 200, await agent.chat(body));
        }

        if (request.method === "GET" && url.pathname === "/agent/conversations") {
          return sendJson(response, 200, { conversations: store.listConversations().map(toConversationResponse) });
        }

        const conversationMatch = url.pathname.match(/^\/agent\/conversations\/([^/]+)$/);
        if (request.method === "GET" && conversationMatch) {
          const detail = store.describeConversation(decodeURIComponent(conversationMatch[1]));
          if (!detail) {
            return sendJson(response, 404, { error: { code: "conversation_not_found", message: "Conversation not found." } });
          }
          return sendJson(response, 200, {
            conversation: toConversationResponse(detail.conversation),
            messages: detail.messages.map(toMessageResponse),
            files: detail.files.map(toFileResponse),
            tool_calls: detail.tool_calls.map(toToolCallResponse),
            proof_snapshots: detail.proof_snapshots.map(toProofSnapshotResponse)
          });
        }

        return sendJson(response, 404, { error: { code: "not_found", message: "Route not found." } });
      } catch (error) {
        return sendError(response, error);
      }
    }
  };
}

export async function startServer({
  port = Number(process.env.PORT || 3002),
  dataDir,
  env = process.env
}: {
  port?: number;
  dataDir?: string;
  env?: Record<string, string | undefined>;
} = {}) {
  const app = createChronofactAgentApp({ dataDir, env });
  const server = createServer(app.handler);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  return {
    server,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      app.close();
    }
  };
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    ...corsHeaders(),
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function sendError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError) {
    return sendJson(response, 400, {
      error: {
        code: "invalid_request",
        message: "Request body is invalid.",
        issues: error.issues
      }
    });
  }
  const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
  return sendJson(response, status, {
    error: {
      code: status >= 500 ? "agent_error" : "request_failed",
      message: error instanceof Error ? error.message : "Unknown error."
    }
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,cookie"
  };
}

function toConversationResponse(row: any) {
  return {
    conversation_id: row.conversationId,
    title: row.title,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function toMessageResponse(row: any) {
  return {
    message_id: row.messageId,
    conversation_id: row.conversationId,
    role: row.role,
    content: row.content,
    created_at: row.createdAt
  };
}

function toFileResponse(row: any) {
  return {
    file_id: row.fileId,
    conversation_id: row.conversationId,
    filename: row.filename,
    sha256: row.sha256,
    size: row.size,
    mime_type: row.mimeType,
    proof_id: row.proofId,
    created_at: row.createdAt
  };
}

function toToolCallResponse(row: any) {
  return {
    tool_call_id: row.toolCallId,
    conversation_id: row.conversationId,
    tool_name: row.toolName,
    input: JSON.parse(row.inputJson),
    output: row.outputJson ? JSON.parse(row.outputJson) : null,
    status: row.status,
    created_at: row.createdAt
  };
}

function toProofSnapshotResponse(row: any) {
  return {
    proof_snapshot_id: row.proofSnapshotId,
    conversation_id: row.conversationId,
    file_id: row.fileId,
    proof_id: row.proofId,
    sha256: row.sha256,
    snapshot: JSON.parse(row.snapshotJson),
    created_at: row.createdAt
  };
}
