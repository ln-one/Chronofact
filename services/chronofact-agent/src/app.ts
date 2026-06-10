import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { getRequestListener, serve } from "@hono/node-server";
import { OpenAPIHono, createRoute, z as openApiZ } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import { chatSchema, createAgentService, runSchema, uploadFileSchema } from "./agent.js";
import { createChronofactClient } from "./chronofactClient.js";
import { createLimoraClient } from "./limoraClient.js";
import { createAgentLlmClient } from "./llmClient.js";
import { createAgentStore } from "./store.js";

const defaultDataDir = join(process.cwd(), ".cache", "chronofact-agent");
const jsonResponseSchema = openApiZ.object({}).passthrough();
const errorResponseSchema = openApiZ.object({
  error: openApiZ.object({
    code: openApiZ.string(),
    message: openApiZ.string()
  }).passthrough()
});

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
  store.recoverInterruptedRuns();
  const chronofactClient = createChronofactClient({
    baseUrl: env.CHRONOFACT_API_URL || "http://127.0.0.1:3001",
    fetchImpl
  });
  const llmClient = createAgentLlmClient({ env, fetchImpl });
  const limoraUrl = env.CHRONOFACT_AGENT_LIMORA_URL || env.LIMORA_API_URL || "";
  const limoraClient = limoraUrl
    ? createLimoraClient({ baseUrl: limoraUrl, fetchImpl })
    : null;
  const agent = createAgentService({
    store,
    chronofactClient,
    uploadDir: join(dataDir, "uploads"),
    llmClient,
    limoraClient
  });
  const chronofactApiUrl = env.CHRONOFACT_API_URL || "http://127.0.0.1:3001";
  const honoApp = createHonoApp({ agent, store, llmClient, env, chronofactApiUrl, fetchImpl });

  return {
    close: () => store.close(),
    app: honoApp,
    handler: getRequestListener(honoApp.fetch) as (request: IncomingMessage, response: ServerResponse) => Promise<void>
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
  const server = serve({ fetch: app.app.fetch, port });
  return {
    server,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      app.close();
    }
  };
}

function createHonoApp({
  agent,
  store,
  llmClient,
  env,
  chronofactApiUrl,
  fetchImpl
}: {
  agent: ReturnType<typeof createAgentService>;
  store: ReturnType<typeof createAgentStore>;
  llmClient: ReturnType<typeof createAgentLlmClient>;
  env: Record<string, string | undefined>;
  chronofactApiUrl: string;
  fetchImpl: typeof fetch;
}) {
  const app = new OpenAPIHono();
  app.use("*", cors({
    origin: env.CHRONOFACT_AGENT_CORS_ORIGIN || env.CORS_ORIGIN || "http://127.0.0.1:5176",
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["content-type", "authorization", "cookie"]
  }));

  app.openapi(jsonRoute({
    method: "get",
    path: "/health",
    summary: "Agent service health"
  }), async (c) => c.json({
    status: "ok",
    service: "chronofact-agent",
    llm: {
      configured: llmClient.configured,
      model: llmClient.configured ? llmClient.model : null
    },
    limora: {
      configured: Boolean(env.CHRONOFACT_AGENT_LIMORA_URL || env.LIMORA_API_URL)
    },
    chronofact_api: await readChronofactApiHealth({ chronofactApiUrl, fetchImpl })
  }, 200));

  app.openapi(jsonRoute({
    method: "post",
    path: "/agent/conversations",
    summary: "Create an agent conversation",
    bodySchema: openApiZ.object({
      conversation_id: openApiZ.string().optional(),
      title: openApiZ.string().optional()
    }).passthrough(),
    status: 201
  }), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const auth = await agent.resolveAuth({
      organizationId: typeof body?.organization_id === "string" ? body.organization_id : undefined,
      requestContext: requestContext(c.req.raw.headers)
    });
    const conversation = store.createConversation({
      conversationId: typeof body?.conversation_id === "string" ? body.conversation_id : undefined,
      title: typeof body?.title === "string" ? body.title : undefined,
      organizationId: auth.organizationId
    });
    return c.json({
      conversation: toConversationResponse(conversation),
      current_file: null
    }, 201);
  });

  app.openapi(jsonRoute({
    method: "post",
    path: "/agent/files",
    summary: "Upload file context",
    bodySchema: uploadFileSchema,
    status: 201
  }), async (c) => c.json(await agent.uploadFile(await c.req.json(), requestContext(c.req.raw.headers)), 201));

  app.openapi(jsonRoute({
    method: "post",
    path: "/agent/chat",
    summary: "Run synchronous agent chat",
    bodySchema: chatSchema
  }), async (c) => c.json(await agent.chat(await c.req.json(), requestContext(c.req.raw.headers)), 200));

  app.openapi(jsonRoute({
    method: "post",
    path: "/agent/runs",
    summary: "Start durable agent run",
    bodySchema: runSchema,
    status: 202
  }), async (c) => c.json(await agent.startRun(await c.req.json(), requestContext(c.req.raw.headers)), 202));

  app.openapi(jsonRoute({
    method: "get",
    path: "/agent/conversations",
    summary: "List agent conversations"
  }), async (c) => {
    const auth = await agent.resolveAuth({
      requestContext: requestContext(c.req.raw.headers)
    });
    return c.json({
      conversations: store.listConversations({ organizationId: auth.organizationId }).map(toConversationResponse)
    }, 200);
  });

  app.openapi(createRoute({
    method: "get",
    path: "/agent/conversations/{conversation_id}",
    request: {
      params: openApiZ.object({
        conversation_id: openApiZ.string()
      })
    },
    responses: {
      200: jsonResponse("Conversation detail"),
      404: jsonResponse("Conversation not found", errorResponseSchema)
    },
    summary: "Get agent conversation detail"
  }), async (c) => {
    const auth = await agent.resolveAuth({
      requestContext: requestContext(c.req.raw.headers)
    });
    const detail = store.describeConversation(c.req.param("conversation_id"));
    if (!detail) {
      return c.json({ error: { code: "conversation_not_found", message: "Conversation not found." } }, 404);
    }
    if (detail.conversation.organizationId !== auth.organizationId) {
      return c.json({ error: { code: "conversation_not_found", message: "Conversation not found." } }, 404);
    }
    return c.json({
      conversation: toConversationResponse(detail.conversation),
      messages: detail.messages.map(toMessageResponse),
      files: detail.files.map((file) => toFileResponse(file, store)),
      tool_calls: detail.tool_calls.map(toToolCallResponse),
      proof_snapshots: detail.proof_snapshots.map(toProofSnapshotResponse),
      runs: detail.runs.map(toRunResponse),
      current_file: toFileResponse(detail.files[detail.files.length - 1] ?? null, store)
    }, 200);
  });

  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "Chronofact Agent API",
      version: "0.1.0"
    }
  });

  app.notFound((c) => c.json({ error: { code: "not_found", message: "Route not found." } }, 404));
  app.onError((error, c) => {
    const { status, body } = errorResponse(error);
    return c.json(body, status as any);
  });

  return app;
}

function requestContext(headers: Headers) {
  return {
    authHeaders: {
      cookie: headers.get("cookie") ?? undefined,
      authorization: headers.get("authorization") ?? undefined
    }
  };
}

function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "invalid_request",
          message: "Request body is invalid.",
          issues: error.issues
        }
      }
    };
  }
  const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
  return {
    status,
    body: {
      error: {
        code: typeof (error as any)?.code === "string"
          ? (error as any).code
          : status >= 500 ? "agent_error" : "request_failed",
        message: error instanceof Error ? error.message : "Unknown error."
      }
    }
  };
}

function jsonRoute({
  method,
  path,
  summary,
  bodySchema,
  status = 200
}: {
  method: "get" | "post";
  path: string;
  summary: string;
  bodySchema?: any;
  status?: 200 | 201 | 202;
}) {
  return createRoute({
    method,
    path,
    summary,
    request: bodySchema
      ? {
          body: {
            content: {
              "application/json": {
                schema: bodySchema
              }
            }
          }
        }
      : undefined,
    responses: {
      [status]: jsonResponse("JSON response"),
      400: jsonResponse("Invalid request", errorResponseSchema),
      500: jsonResponse("Agent error", errorResponseSchema)
    }
  } as any);
}

function jsonResponse(description: string, schema: any = jsonResponseSchema) {
  return {
    description,
    content: {
      "application/json": {
        schema
      }
    }
  };
}

async function readChronofactApiHealth({
  chronofactApiUrl,
  fetchImpl
}: {
  chronofactApiUrl: string;
  fetchImpl: typeof fetch;
}) {
  const url = chronofactApiUrl.replace(/\/+$/, "");
  try {
    const response = await fetchImpl(`${url}/health`);
    const payload = await response.json().catch(() => ({}));
    return {
      url,
      reachable: response.ok,
      status: response.ok ? payload?.status ?? "ok" : "error",
      service: payload?.service ?? null,
      runtime: payload?.runtime ?? null
    };
  } catch {
    return {
      url,
      reachable: false,
      status: "unreachable",
      service: null,
      runtime: null
    };
  }
}

function toConversationResponse(row: any) {
  return {
    conversation_id: row.conversationId,
    organization_id: row.organizationId,
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
    status: row.status,
    metadata: row.metadataJson ? JSON.parse(row.metadataJson) : null,
    created_at: row.createdAt
  };
}

function toFileResponse(row: any, store?: ReturnType<typeof createAgentStore>) {
  if (!row) {
    return null;
  }
  const detail = store?.describeFile(row);
  return {
    file_id: row.fileId,
    conversation_id: row.conversationId,
    organization_id: row.organizationId,
    filename: row.filename,
    sha256: row.sha256,
    size: row.size,
    mime_type: row.mimeType,
    proof_id: row.proofId,
    document_id: row.documentId,
    document_version_id: row.documentVersionId,
    document: detail?.document ? toDocumentResponse(detail.document) : null,
    version: detail?.version ? toDocumentVersionResponse(detail.version) : null,
    created_at: row.createdAt
  };
}

function toDocumentResponse(row: any) {
  return {
    document_id: row.documentId,
    organization_id: row.organizationId,
    display_name: row.displayName,
    normalized_name: row.normalizedName,
    latest_version_id: row.latestVersionId,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function toDocumentVersionResponse(row: any) {
  return {
    document_version_id: row.documentVersionId,
    document_id: row.documentId,
    file_id: row.fileId,
    sha256: row.sha256,
    version_no: row.versionNo,
    proof_id: row.proofId,
    asset_id: row.assetId,
    chronofact_version_id: row.chronofactVersionId,
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

function toRunResponse(row: any) {
  return {
    run_id: row.runId,
    conversation_id: row.conversationId,
    user_message_id: row.userMessageId,
    assistant_message_id: row.assistantMessageId,
    file_id: row.fileId,
    action: row.action,
    status: row.status,
    error: row.error,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    completed_at: row.completedAt
  };
}
