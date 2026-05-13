import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createChronofactOrchestrator } from "./orchestrator.js";
import { createInMemoryStore } from "./store.js";
import { createChronofactAdapters } from "./adapters/factory.js";
import { isChronofactError } from "./errors.js";
import { MOCK_CONTRACT } from "./mockContract.js";

const moduleDir = fileURLToPath(new URL(".", import.meta.url));
const defaultStorageDir = join(moduleDir, "..", "..", "..", ".cache", "chronofact", "uploads");

export function createApp({ storageDir = defaultStorageDir, env = process.env } = {}) {
  const store = createInMemoryStore();
  const orchestrator = createChronofactOrchestrator({
    store,
    clients: createChronofactAdapters({ env, storageDir })
  });

  return { orchestrator, handler: createHandler(orchestrator) };
}

function createHandler(orchestrator) {
  return async function handler(request, response) {
    try {
      const url = new URL(request.url, "http://localhost");
      const scenario = url.searchParams.get("scenario") ?? undefined;

      if (request.method === "OPTIONS") {
        response.writeHead(204, corsHeaders());
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return sendJson(response, 200, { status: "ok", service: "chronofact-api" });
      }

      if (request.method === "GET" && url.pathname === "/mock-contract") {
        return sendJson(response, 200, MOCK_CONTRACT);
      }

      if (request.method === "POST" && url.pathname === "/assets") {
        const body = await readJson(request);
        const result = await orchestrator.submit({
          filename: body.filename,
          asset_type: body.asset_type,
          content: body,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 201, result);
      }

      const versionMatch = url.pathname.match(/^\/assets\/([^/]+)\/versions$/);
      if (request.method === "POST" && versionMatch) {
        const body = await readJson(request);
        const result = await orchestrator.createVersion({
          asset_id: versionMatch[1],
          filename: body.filename,
          asset_type: body.asset_type,
          content: body,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 201, result);
      }

      const assetMatch = url.pathname.match(/^\/assets\/([^/]+)$/);
      if (request.method === "GET" && assetMatch) {
        return sendJson(response, 200, orchestrator.describeAsset(assetMatch[1]));
      }

      if (request.method === "POST" && url.pathname === "/verify") {
        const body = await readJson(request);
        const result = await orchestrator.verify({
          asset_id: body.asset_id,
          version_id: body.version_id,
          content: body.content !== undefined || body.content_text !== undefined || body.content_base64 !== undefined ? body : undefined,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 200, result);
      }

      return sendJson(response, 404, {
        error: {
          code: "not_found",
          message: `${request.method} ${url.pathname} is not supported.`
        }
      });
    } catch (error) {
      const statusCode = isChronofactError(error) ? error.statusCode : 500;
      return sendJson(response, statusCode, {
        error: {
          code: isChronofactError(error) ? error.code : "internal_error",
          message: error.message
        }
      });
    }
  };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders()
  });
  response.end(JSON.stringify(payload, null, 2));
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

export async function startServer({ port = process.env.PORT ?? 3001, storageDir } = {}) {
  await mkdir(storageDir ?? defaultStorageDir, { recursive: true });
  const { handler } = createApp({ storageDir });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(Number(port), resolve));
  return server;
}
