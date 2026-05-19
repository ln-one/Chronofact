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

      if (request.method === "POST" && url.pathname === "/demo/seed") {
        const body = await readJson(request);
        const result = await orchestrator.seedDemoScenario({
          scenario: body.scenario ?? scenario ?? "course_delivery"
        });
        return sendJson(response, 201, result);
      }

      if (request.method === "GET" && url.pathname === "/workspaces") {
        return sendJson(response, 200, {
          workspaces: orchestrator.listWorkspaces({
            status: url.searchParams.get("status") ?? undefined,
            workspaceType: url.searchParams.get("workspace_type") ?? undefined,
            query: url.searchParams.get("q") ?? undefined,
            createdFrom: url.searchParams.get("created_from") ?? undefined,
            createdTo: url.searchParams.get("created_to") ?? undefined
          })
        });
      }

      if (request.method === "POST" && url.pathname === "/workspaces") {
        const body = await readJson(request);
        const result = await orchestrator.createWorkspace({
          title: body.title,
          workspace_type: body.workspace_type,
          description: body.description,
          status: body.status,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 201, result);
      }

      const workspaceStatusMatch = url.pathname.match(/^\/workspaces\/([^/]+)\/status$/);
      if (request.method === "POST" && workspaceStatusMatch) {
        const body = await readJson(request);
        const result = await orchestrator.updateWorkspaceStatus({
          workspace_id: workspaceStatusMatch[1],
          status: body.status,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 200, result);
      }

      const workspaceAssetMatch = url.pathname.match(/^\/workspaces\/([^/]+)\/assets$/);
      if (request.method === "POST" && workspaceAssetMatch) {
        const body = await readJson(request);
        const result = await orchestrator.submit({
          workspace_id: workspaceAssetMatch[1],
          asset_title: body.asset_title ?? body.title,
          filename: body.filename,
          asset_type: body.asset_type,
          content: body,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 201, result);
      }

      const workspaceReportMatch = url.pathname.match(/^\/workspaces\/([^/]+)\/report$/);
      if (request.method === "GET" && workspaceReportMatch) {
        return sendJson(response, 200, orchestrator.exportWorkspaceReport(workspaceReportMatch[1]));
      }

      const workspaceOverviewMatch = url.pathname.match(/^\/workspaces\/([^/]+)\/overview$/);
      if (request.method === "GET" && workspaceOverviewMatch) {
        return sendJson(response, 200, orchestrator.describeWorkspaceOverview(workspaceOverviewMatch[1]));
      }

      const workspaceMatch = url.pathname.match(/^\/workspaces\/([^/]+)$/);
      if (request.method === "GET" && workspaceMatch) {
        return sendJson(response, 200, orchestrator.describeWorkspace(workspaceMatch[1]));
      }

      if (request.method === "GET" && url.pathname === "/assets") {
        return sendJson(response, 200, {
          assets: orchestrator.listAssets({
            workspaceId: url.searchParams.get("workspace_id") ?? undefined,
            status: url.searchParams.get("status") ?? undefined,
            assetType: url.searchParams.get("asset_type") ?? undefined,
            query: url.searchParams.get("q") ?? undefined,
            verificationStatus: url.searchParams.get("verification_status") ?? undefined,
            failureReason: url.searchParams.get("failure_reason") ?? undefined,
            createdFrom: url.searchParams.get("created_from") ?? undefined,
            createdTo: url.searchParams.get("created_to") ?? undefined
          })
        });
      }

      if (request.method === "GET" && url.pathname === "/evidence") {
        return sendJson(response, 200, orchestrator.listEvidence({
          workspaceId: url.searchParams.get("workspace_id") ?? undefined,
          assetId: url.searchParams.get("asset_id") ?? undefined,
          versionId: url.searchParams.get("version_id") ?? undefined,
          verificationStatus: url.searchParams.get("verification_status") ?? undefined,
          failureReason: url.searchParams.get("failure_reason") ?? undefined,
          createdFrom: url.searchParams.get("created_from") ?? undefined,
          createdTo: url.searchParams.get("created_to") ?? undefined
        }));
      }

      const organizationEvidenceMatch = url.pathname.match(/^\/organizations\/([^/]+)\/evidence$/);
      if (request.method === "GET" && organizationEvidenceMatch) {
        return sendJson(response, 200, await orchestrator.listOrganizationEvidence({
          organization_id: organizationEvidenceMatch[1],
          requestHeaders: request.headers,
          scenario
        }));
      }

      const organizationEvidenceDigestMatch = url.pathname.match(/^\/organizations\/([^/]+)\/evidence\/digests\/([^/]+)$/);
      if (request.method === "GET" && organizationEvidenceDigestMatch) {
        return sendJson(response, 200, await orchestrator.findEvidenceByDigest({
          organization_id: organizationEvidenceDigestMatch[1],
          sha256: organizationEvidenceDigestMatch[2],
          requestHeaders: request.headers,
          scenario
        }));
      }

      const organizationEvidencePreserveMatch = url.pathname.match(/^\/organizations\/([^/]+)\/evidence\/preserve$/);
      if (request.method === "POST" && organizationEvidencePreserveMatch) {
        const body = await readJson(request);
        const result = await orchestrator.preserveEvidence({
          organization_id: organizationEvidencePreserveMatch[1],
          filename: body.filename,
          asset_title: body.asset_title ?? body.title,
          asset_type: body.asset_type,
          sha256: body.sha256,
          content: evidenceContentFromBody(body),
          requestHeaders: request.headers,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 201, result);
      }

      const organizationEvidenceVerifyMatch = url.pathname.match(/^\/organizations\/([^/]+)\/evidence\/verify$/);
      if (request.method === "POST" && organizationEvidenceVerifyMatch) {
        const body = await readJson(request);
        const result = await orchestrator.verifyEvidence({
          organization_id: organizationEvidenceVerifyMatch[1],
          sha256: body.sha256,
          content: evidenceContentFromBody(body),
          proof_id: body.proof_id,
          version_id: body.version_id,
          requestHeaders: request.headers,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 200, result);
      }

      if (request.method === "GET" && url.pathname === "/audit-log") {
        return sendJson(response, 200, orchestrator.listAuditLog({
          workspaceId: url.searchParams.get("workspace_id") ?? undefined,
          assetId: url.searchParams.get("asset_id") ?? undefined,
          versionId: url.searchParams.get("version_id") ?? undefined,
          action: url.searchParams.get("action") ?? undefined,
          createdFrom: url.searchParams.get("created_from") ?? undefined,
          createdTo: url.searchParams.get("created_to") ?? undefined
        }));
      }

      if (request.method === "GET" && url.pathname === "/audit-log/verify") {
        return sendJson(response, 200, orchestrator.verifyAuditLog({
          workspaceId: url.searchParams.get("workspace_id") ?? undefined,
          assetId: url.searchParams.get("asset_id") ?? undefined,
          versionId: url.searchParams.get("version_id") ?? undefined,
          action: url.searchParams.get("action") ?? undefined,
          createdFrom: url.searchParams.get("created_from") ?? undefined,
          createdTo: url.searchParams.get("created_to") ?? undefined
        }));
      }

      const versionEvidenceMatch = url.pathname.match(/^\/versions\/([^/]+)\/evidence$/);
      if (request.method === "GET" && versionEvidenceMatch) {
        return sendJson(response, 200, orchestrator.describeEvidence({
          version_id: versionEvidenceMatch[1]
        }));
      }

      const versionReportMatch = url.pathname.match(/^\/versions\/([^/]+)\/report$/);
      if (request.method === "GET" && versionReportMatch) {
        return sendJson(response, 200, await orchestrator.exportVersionReport({
          version_id: versionReportMatch[1],
          scenario
        }));
      }

      const versionReviewMatch = url.pathname.match(/^\/versions\/([^/]+)\/reviews$/);
      if (request.method === "POST" && versionReviewMatch) {
        const body = await readJson(request);
        const result = await orchestrator.createReview({
          version_id: versionReviewMatch[1],
          decision: body.decision,
          summary: body.summary,
          notes: body.notes,
          next_checks: body.next_checks,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 201, result);
      }

      if (request.method === "GET" && versionReviewMatch) {
        return sendJson(response, 200, orchestrator.listReviews({
          versionId: versionReviewMatch[1],
          decision: url.searchParams.get("decision") ?? undefined,
          reviewerId: url.searchParams.get("reviewer_id") ?? undefined,
          createdFrom: url.searchParams.get("created_from") ?? undefined,
          createdTo: url.searchParams.get("created_to") ?? undefined
        }));
      }

      if (request.method === "GET" && url.pathname === "/reviews") {
        return sendJson(response, 200, orchestrator.listReviews({
          workspaceId: url.searchParams.get("workspace_id") ?? undefined,
          assetId: url.searchParams.get("asset_id") ?? undefined,
          versionId: url.searchParams.get("version_id") ?? undefined,
          decision: url.searchParams.get("decision") ?? undefined,
          reviewerId: url.searchParams.get("reviewer_id") ?? undefined,
          createdFrom: url.searchParams.get("created_from") ?? undefined,
          createdTo: url.searchParams.get("created_to") ?? undefined
        }));
      }

      if (request.method === "POST" && url.pathname === "/ai/explain/fact") {
        const body = await readJson(request);
        const result = await orchestrator.explainFact({
          asset_id: body.asset_id,
          version_id: body.version_id,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/ai/explain/trace") {
        const body = await readJson(request);
        const result = await orchestrator.explainTrace({
          asset_id: body.asset_id,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/ai/explain/risk") {
        const body = await readJson(request);
        const result = await orchestrator.explainRisk({
          asset_id: body.asset_id,
          version_id: body.version_id,
          scenario: body.scenario ?? scenario
        });
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/assets") {
        const body = await readJson(request);
        const result = await orchestrator.submit({
          workspace_id: body.workspace_id,
          asset_title: body.asset_title ?? body.title,
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
          workspace_id: body.workspace_id,
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
    "access-control-allow-headers": "content-type,authorization,cookie"
  };
}

function evidenceContentFromBody(body) {
  if (body.content_text !== undefined || body.content_base64 !== undefined || body.content !== undefined) {
    return body;
  }
  return undefined;
}

export async function startServer({ port = process.env.PORT ?? 3001, storageDir } = {}) {
  await mkdir(storageDir ?? defaultStorageDir, { recursive: true });
  const { handler } = createApp({ storageDir });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(Number(port), resolve));
  return server;
}
