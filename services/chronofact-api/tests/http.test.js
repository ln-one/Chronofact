import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";

async function withServer(t, env = {}) {
  const storageDir = await mkdtemp(join(tmpdir(), "chronofact-http-"));
  const { handler } = createApp({ storageDir, env });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(storageDir, { recursive: true, force: true });
  });
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

async function withLimoraServer(t, { allowed = true, session = true, hidden = false } = {}) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    response.setHeader("content-type", "application/json; charset=utf-8");

    if (url.pathname === "/v1/sessions/current") {
      if (!session || !request.headers.cookie) {
        response.writeHead(401);
        response.end(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "No active session" } }));
        return;
      }
      response.end(JSON.stringify({
        data: {
          currentSession: {
            session: { id: "session-1", userId: "user-1" },
            identity: { id: "user-1", email: "user@example.test" },
            memberships: []
          }
        }
      }));
      return;
    }

    if (url.pathname === "/v1/organizations/org-1/permissions/check") {
      if (hidden) {
        response.writeHead(404);
        response.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Organization not found" } }));
        return;
      }
      const body = await readRequestJson(request);
      response.end(JSON.stringify({
        data: {
          permissionCheck: {
            allowed,
            requestedPermissions: body.permissions ?? [],
            grantedPermissions: allowed ? body.permissions ?? [] : [],
            missingPermissions: allowed ? [] : body.permissions ?? []
          }
        }
      }));
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }));
  });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

test("health exposes active adapter runtime", async (t) => {
  const baseUrl = await withServer(t, {
    CHRONOFACT_CHRONESTIA_URL: "http://127.0.0.1:8080",
    CHRONOFACT_LIMORA_URL: "http://127.0.0.1:3002",
    CHRONOFACT_AI_URL: "https://ai.example.test"
  });

  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.service, "chronofact-api");
  assert.equal(body.runtime.chronestia.mode, "http");
  assert.equal(body.runtime.chronestia.url, "http://127.0.0.1:8080");
  assert.equal(body.runtime.limora.mode, "http");
  assert.equal(body.runtime.dualweave.mode, "mock");
  assert.equal(body.runtime.ai.mode, "http");
});

test("HTTP API supports submit, version, detail, and verify flows", async (t) => {
  const baseUrl = await withServer(t);

  const created = await postJson(`${baseUrl}/assets`, {
    filename: "report.pdf",
    content_text: "v1"
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.verification_result.status, "verified");

  const v2 = await postJson(`${baseUrl}/assets/${created.body.asset_version.asset_id}/versions`, {
    filename: "report-v2.pdf",
    content_text: "v2"
  });
  assert.equal(v2.status, 201);
  assert.equal(v2.body.asset_version.previous_version_id, created.body.asset_version.version_id);

  const detail = await fetch(`${baseUrl}/assets/${created.body.asset_version.asset_id}`);
  const detailBody = await detail.json();
  assert.equal(detail.status, 200);
  assert.equal(detailBody.versions.length, 2);

  const verify = await postJson(`${baseUrl}/verify`, {
    version_id: v2.body.asset_version.version_id,
    content_text: "changed"
  });
  assert.equal(verify.status, 200);
  assert.equal(verify.body.verification_result.failure_reason, "digest_mismatch");
});

test("HTTP API supports workspace-scoped submission, listing, and report export", async (t) => {
  const baseUrl = await withServer(t);

  const workspace = await postJson(`${baseUrl}/workspaces`, {
    title: "Experiment Delivery",
    workspace_type: "experiment",
    description: "Report, screenshot, and log evidence"
  });
  assert.equal(workspace.status, 201);
  assert.equal(workspace.body.workspace.title, "Experiment Delivery");

  const submitted = await postJson(`${baseUrl}/workspaces/${workspace.body.workspace.workspace_id}/assets`, {
    asset_title: "Report v1",
    filename: "report.md",
    content_text: "first report"
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.asset_version.workspace_id, workspace.body.workspace.workspace_id);
  assert.equal(submitted.body.preservation_record.verification_status, "verified");

  const assets = await fetch(`${baseUrl}/assets?workspace_id=${workspace.body.workspace.workspace_id}`);
  const assetsBody = await assets.json();
  assert.equal(assets.status, 200);
  assert.equal(assetsBody.assets.length, 1);
  assert.equal(assetsBody.assets[0].latest_version.version_no, 1);

  const detail = await fetch(`${baseUrl}/workspaces/${workspace.body.workspace.workspace_id}`);
  const detailBody = await detail.json();
  assert.equal(detail.status, 200);
  assert.equal(detailBody.assets.length, 1);
  assert.ok(detailBody.audit_log.some((entry) => entry.action === "workspace_created"));

  const report = await fetch(`${baseUrl}/workspaces/${workspace.body.workspace.workspace_id}/report`);
  const reportBody = await report.json();
  assert.equal(report.status, 200);
  assert.match(reportBody.report.content, /# Experiment Delivery/);
  assert.match(reportBody.report.content, /Latest digest:/);
});

test("HTTP organization evidence APIs preserve and verify by hash", async (t) => {
  const baseUrl = await withServer(t);

  const preserved = await postJson(`${baseUrl}/organizations/org-1/evidence/preserve`, {
    filename: "report.md",
    content_text: "original"
  });
  assert.equal(preserved.status, 201);
  assert.equal(preserved.body.status, "preserved");
  assert.equal(preserved.body.sha256, "0682c5f2076f099c34cfdd15a9e063849ed437a49677e6fcc5b4198c76575be5");

  const found = await postJson(`${baseUrl}/organizations/org-1/evidence/verify`, {
    content_text: "original"
  });
  assert.equal(found.status, 200);
  assert.equal(found.body.result, "preserved");
  assert.equal(found.body.matches.length, 1);

  const missing = await postJson(`${baseUrl}/organizations/org-1/evidence/verify`, {
    content_text: "changed"
  });
  assert.equal(missing.status, 200);
  assert.equal(missing.body.result, "not_preserved");

  const mismatch = await postJson(`${baseUrl}/organizations/org-1/evidence/verify`, {
    proof_id: preserved.body.proof_id,
    content_text: "changed"
  });
  assert.equal(mismatch.status, 200);
  assert.equal(mismatch.body.result, "mismatch");

  const listed = await fetch(`${baseUrl}/organizations/org-1/evidence`);
  const listedBody = await listed.json();
  assert.equal(listed.status, 200);
  assert.equal(listedBody.evidence.length, 1);

  const byDigest = await fetch(`${baseUrl}/organizations/org-1/evidence/digests/${preserved.body.sha256}`);
  const byDigestBody = await byDigest.json();
  assert.equal(byDigest.status, 200);
  assert.equal(byDigestBody.matches[0].proof_id, preserved.body.proof_id);
});

test("HTTP organization evidence APIs enforce Limora session and permissions", async (t) => {
  const limoraUrl = await withLimoraServer(t, { session: true, allowed: true });
  const baseUrl = await withServer(t, { CHRONOFACT_LIMORA_URL: limoraUrl });

  const missingSession = await postJson(`${baseUrl}/organizations/org-1/evidence/preserve`, {
    filename: "report.md",
    content_text: "original"
  });
  assert.equal(missingSession.status, 401);

  const allowed = await postJson(
    `${baseUrl}/organizations/org-1/evidence/preserve`,
    {
      filename: "report.md",
      content_text: "original"
    },
    { cookie: "better-auth.session_token=test" }
  );
  assert.equal(allowed.status, 201);
});

test("HTTP asset version API forwards Limora session and permissions", async (t) => {
  const limoraUrl = await withLimoraServer(t, { session: true, allowed: true });
  const baseUrl = await withServer(t, { CHRONOFACT_LIMORA_URL: limoraUrl });
  const sessionHeaders = { cookie: "better-auth.session_token=test" };

  const created = await postJson(
    `${baseUrl}/assets`,
    {
      workspace_id: "org-1",
      filename: "report-v1.pdf",
      content_text: "v1"
    },
    sessionHeaders
  );
  assert.equal(created.status, 201);

  const missingSession = await postJson(`${baseUrl}/assets/${created.body.asset_version.asset_id}/versions`, {
    workspace_id: "org-1",
    filename: "report-v2.pdf",
    content_text: "v2"
  });
  assert.equal(missingSession.status, 401);

  const v2 = await postJson(
    `${baseUrl}/assets/${created.body.asset_version.asset_id}/versions`,
    {
      workspace_id: "org-1",
      filename: "report-v2.pdf",
      content_text: "v2"
    },
    sessionHeaders
  );
  assert.equal(v2.status, 201);
  assert.equal(v2.body.asset_version.previous_version_id, created.body.asset_version.version_id);
});

test("HTTP organization evidence APIs return 403 and 404 from Limora authorization", async (t) => {
  const deniedLimoraUrl = await withLimoraServer(t, { session: true, allowed: false });
  const deniedBaseUrl = await withServer(t, { CHRONOFACT_LIMORA_URL: deniedLimoraUrl });
  const denied = await postJson(
    `${deniedBaseUrl}/organizations/org-1/evidence/verify`,
    { content_text: "original" },
    { cookie: "better-auth.session_token=test" }
  );
  assert.equal(denied.status, 403);

  const hiddenLimoraUrl = await withLimoraServer(t, { session: true, hidden: true });
  const hiddenBaseUrl = await withServer(t, { CHRONOFACT_LIMORA_URL: hiddenLimoraUrl });
  const hidden = await fetch(`${hiddenBaseUrl}/organizations/org-1/evidence`, {
    headers: { cookie: "better-auth.session_token=test" }
  });
  assert.equal(hidden.status, 404);
});

test("HTTP API exposes explicit AI explanation endpoints", async (t) => {
  const baseUrl = await withServer(t);

  const created = await postJson(`${baseUrl}/assets`, {
    filename: "report-v1.pdf",
    content_text: "v1"
  });
  const v2 = await postJson(`${baseUrl}/assets/${created.body.asset_version.asset_id}/versions`, {
    filename: "report-v2.pdf",
    content_text: "v2"
  });

  const fact = await postJson(`${baseUrl}/ai/explain/fact`, {
    version_id: v2.body.asset_version.version_id
  });
  assert.equal(fact.status, 200);
  assert.equal(fact.body.explanation_type, "fact");
  assert.equal(fact.body.verification_result.status, "verified");

  const trace = await postJson(`${baseUrl}/ai/explain/trace`, {
    asset_id: created.body.asset_version.asset_id
  });
  assert.equal(trace.status, 200);
  assert.equal(trace.body.trace.version_count, 2);
  assert.equal(trace.body.trace.versions[1].previous_version_id, created.body.asset_version.version_id);

  const risk = await postJson(`${baseUrl}/ai/explain/risk`, {
    version_id: v2.body.asset_version.version_id,
    scenario: "chain_unavailable"
  });
  assert.equal(risk.status, 200);
  assert.equal(risk.body.risk_summary.severity, "medium");
  assert.equal(risk.body.risk_summary.failure_reason, "chain_unavailable");
});

test("HTTP API filters assets and evidence by status and date range", async (t) => {
  const baseUrl = await withServer(t);

  const workspace = await postJson(`${baseUrl}/workspaces`, {
    title: "Searchable Evidence Workspace"
  });
  const verified = await postJson(`${baseUrl}/workspaces/${workspace.body.workspace.workspace_id}/assets`, {
    asset_title: "Verified report",
    filename: "verified.md",
    content_text: "verified"
  });
  const pending = await postJson(`${baseUrl}/workspaces/${workspace.body.workspace.workspace_id}/assets`, {
    asset_title: "Pending receipt",
    filename: "pending.md",
    content_text: "pending",
    scenario: "proof_missing"
  });

  const pendingAssets = await fetch(
    `${baseUrl}/assets?workspace_id=${workspace.body.workspace.workspace_id}&verification_status=pending`
  );
  const pendingAssetsBody = await pendingAssets.json();
  assert.equal(pendingAssets.status, 200);
  assert.equal(pendingAssetsBody.assets.length, 1);
  assert.equal(pendingAssetsBody.assets[0].asset_id, pending.body.asset_version.asset_id);

  const futureAssets = await fetch(`${baseUrl}/assets?created_from=2999-01-01T00:00:00.000Z`);
  const futureAssetsBody = await futureAssets.json();
  assert.equal(futureAssets.status, 200);
  assert.equal(futureAssetsBody.assets.length, 0);

  const evidence = await fetch(
    `${baseUrl}/evidence?workspace_id=${workspace.body.workspace.workspace_id}&verification_status=verified`
  );
  const evidenceBody = await evidence.json();
  assert.equal(evidence.status, 200);
  assert.equal(evidenceBody.evidence.length, 1);
  assert.equal(evidenceBody.evidence[0].asset_id, verified.body.asset_version.asset_id);
  assert.equal(evidenceBody.evidence[0].asset_version.version_id, verified.body.asset_version.version_id);

  const detail = await fetch(`${baseUrl}/versions/${verified.body.asset_version.version_id}/evidence`);
  const detailBody = await detail.json();
  assert.equal(detail.status, 200);
  assert.equal(detailBody.evidence.preservation_record.verification_status, "verified");
  assert.equal(detailBody.evidence.witness_record.fact_id, verified.body.witness_record.fact_id);
});

test("HTTP API exports version verification reports", async (t) => {
  const baseUrl = await withServer(t);

  const created = await postJson(`${baseUrl}/assets`, {
    asset_title: "Final report",
    filename: "report.md",
    content_text: "report"
  });

  const report = await fetch(`${baseUrl}/versions/${created.body.asset_version.version_id}/report`);
  const reportBody = await report.json();
  assert.equal(report.status, 200);
  assert.equal(reportBody.report.format, "markdown");
  assert.equal(reportBody.verification_result.status, "verified");
  assert.match(reportBody.report.content, /# Verification Report:/);
  assert.match(reportBody.report.content, /## Next Checks/);
  assert.match(reportBody.report.content, new RegExp(created.body.asset_version.sha256));

  const unavailable = await fetch(
    `${baseUrl}/versions/${created.body.asset_version.version_id}/report?scenario=chain_unavailable`
  );
  const unavailableBody = await unavailable.json();
  assert.equal(unavailable.status, 200);
  assert.equal(unavailableBody.verification_result.status, "unsupported");
  assert.match(unavailableBody.report.content, /chain_unavailable/);
});

test("HTTP API records manual reviews and workspace status changes", async (t) => {
  const baseUrl = await withServer(t);

  const workspace = await postJson(`${baseUrl}/workspaces`, {
    title: "Review Workspace"
  });
  const created = await postJson(`${baseUrl}/workspaces/${workspace.body.workspace.workspace_id}/assets`, {
    filename: "report.md",
    content_text: "report"
  });

  const status = await postJson(`${baseUrl}/workspaces/${workspace.body.workspace.workspace_id}/status`, {
    status: "under_review"
  });
  assert.equal(status.status, 200);
  assert.equal(status.body.workspace.status, "under_review");

  const review = await postJson(`${baseUrl}/versions/${created.body.asset_version.version_id}/reviews`, {
    decision: "approved",
    summary: "Evidence is complete",
    notes: "Manual review accepted the submitted package.",
    next_checks: ["Archive the submission"]
  });
  assert.equal(review.status, 201);
  assert.equal(review.body.review_record.decision, "approved");
  assert.equal(review.body.evidence.review_records.length, 1);

  const reviews = await fetch(`${baseUrl}/reviews?workspace_id=${workspace.body.workspace.workspace_id}&decision=approved`);
  const reviewsBody = await reviews.json();
  assert.equal(reviews.status, 200);
  assert.equal(reviewsBody.reviews.length, 1);

  const versionReviews = await fetch(`${baseUrl}/versions/${created.body.asset_version.version_id}/reviews`);
  const versionReviewsBody = await versionReviews.json();
  assert.equal(versionReviews.status, 200);
  assert.equal(versionReviewsBody.reviews[0].summary, "Evidence is complete");

  const audit = await fetch(`${baseUrl}/audit-log?workspace_id=${workspace.body.workspace.workspace_id}&action=review_record_created`);
  const auditBody = await audit.json();
  assert.equal(audit.status, 200);
  assert.equal(auditBody.audit_log.length, 1);

  const report = await fetch(`${baseUrl}/versions/${created.body.asset_version.version_id}/report`);
  const reportBody = await report.json();
  assert.match(reportBody.report.content, /## Manual Review/);
  assert.match(reportBody.report.content, /Decision: approved/);
});

test("HTTP API seeds a complete local demo workflow", async (t) => {
  const baseUrl = await withServer(t);

  const seeded = await postJson(`${baseUrl}/demo/seed`, {});
  assert.equal(seeded.status, 201);
  assert.equal(seeded.body.scenario, "course_delivery");
  assert.equal(seeded.body.workspace.status, "under_review");
  assert.equal(seeded.body.primary_asset.version_count, 2);
  assert.equal(seeded.body.pending_asset.failure_reason, "proof_missing");
  assert.equal(seeded.body.created.reviews.length, 2);

  const workspace = await fetch(`${baseUrl}${seeded.body.demo_links.workspace}`);
  const workspaceBody = await workspace.json();
  assert.equal(workspace.status, 200);
  assert.equal(workspaceBody.assets.length, 2);

  const evidence = await fetch(`${baseUrl}${seeded.body.demo_links.evidence}`);
  const evidenceBody = await evidence.json();
  assert.equal(evidence.status, 200);
  assert.equal(evidenceBody.evidence.length, 3);

  const report = await fetch(`${baseUrl}${seeded.body.demo_links.primary_report}`);
  const reportBody = await report.json();
  assert.equal(report.status, 200);
  assert.match(reportBody.report.content, /Decision: approved/);

  const pendingReport = await fetch(`${baseUrl}${seeded.body.demo_links.pending_report}`);
  const pendingReportBody = await pendingReport.json();
  assert.equal(pendingReport.status, 200);
  assert.equal(pendingReportBody.verification_result.failure_reason, "proof_missing");
  assert.match(pendingReportBody.report.content, /Decision: needs_revision/);
});

test("HTTP API returns workspace overview for dashboard display", async (t) => {
  const baseUrl = await withServer(t);

  const seeded = await postJson(`${baseUrl}/demo/seed`, {});
  const overview = await fetch(`${baseUrl}${seeded.body.demo_links.overview}`);
  const overviewBody = await overview.json();

  assert.equal(overview.status, 200);
  assert.equal(overviewBody.workspace.workspace_id, seeded.body.workspace.workspace_id);
  assert.equal(overviewBody.summary.asset_count, 2);
  assert.equal(overviewBody.summary.version_count, 3);
  assert.equal(overviewBody.summary.verification_status_counts.verified, 2);
  assert.equal(overviewBody.summary.verification_status_counts.pending, 1);
  assert.equal(overviewBody.summary.review_decision_counts.needs_revision, 1);
  assert.ok(overviewBody.attention_items.some((item) => item.failure_reason === "proof_missing"));
  assert.ok(overviewBody.latest_activity.some((entry) => entry.action === "workspace_status_updated"));
  assert.match(overviewBody.links.workspace_report, new RegExp(seeded.body.workspace.workspace_id));
});

test("HTTP API verifies audit log hash-chain integrity", async (t) => {
  const baseUrl = await withServer(t);

  const seeded = await postJson(`${baseUrl}/demo/seed`, {});
  const audit = await fetch(`${baseUrl}/audit-log?workspace_id=${seeded.body.workspace.workspace_id}`);
  const auditBody = await audit.json();
  assert.equal(audit.status, 200);
  assert.match(auditBody.audit_log[0].entry_hash, /^[a-f0-9]{64}$/);
  assert.equal(auditBody.audit_log[1].previous_hash, auditBody.audit_log[0].entry_hash);

  const integrity = await fetch(`${baseUrl}/audit-log/verify?workspace_id=${seeded.body.workspace.workspace_id}`);
  const integrityBody = await integrity.json();
  assert.equal(integrity.status, 200);
  assert.equal(integrityBody.audit_integrity.valid, true);
  assert.equal(integrityBody.audit_integrity.scoped_count, auditBody.audit_log.length);
  assert.equal(integrityBody.audit_integrity.latest_entry_hash, auditBody.audit_log.at(-1).entry_hash);

  const overview = await fetch(`${baseUrl}${seeded.body.demo_links.overview}`);
  const overviewBody = await overview.json();
  assert.equal(overviewBody.summary.audit_chain_valid, true);
  assert.equal(overviewBody.summary.latest_audit_hash, auditBody.audit_log.at(-1).entry_hash);
});

test("HTTP API keeps audit hash chains scoped per workspace", async (t) => {
  const baseUrl = await withServer(t);

  const first = await postJson(`${baseUrl}/workspaces`, { title: "First Workspace" });
  const second = await postJson(`${baseUrl}/workspaces`, { title: "Second Workspace" });
  await postJson(`${baseUrl}/workspaces/${first.body.workspace.workspace_id}/assets`, {
    filename: "first.md",
    content_text: "first"
  });
  await postJson(`${baseUrl}/workspaces/${second.body.workspace.workspace_id}/assets`, {
    filename: "second.md",
    content_text: "second"
  });
  await postJson(`${baseUrl}/workspaces/${first.body.workspace.workspace_id}/status`, {
    status: "under_review"
  });

  const firstAudit = await fetch(`${baseUrl}/audit-log?workspace_id=${first.body.workspace.workspace_id}`);
  const firstAuditBody = await firstAudit.json();
  const secondAudit = await fetch(`${baseUrl}/audit-log?workspace_id=${second.body.workspace.workspace_id}`);
  const secondAuditBody = await secondAudit.json();
  assert.equal(firstAuditBody.audit_log[0].previous_hash, null);
  assert.equal(firstAuditBody.audit_log[1].previous_hash, firstAuditBody.audit_log[0].entry_hash);
  assert.equal(firstAuditBody.audit_log.at(-1).previous_hash, firstAuditBody.audit_log.at(-2).entry_hash);
  assert.equal(secondAuditBody.audit_log[0].previous_hash, null);

  const firstIntegrity = await fetch(`${baseUrl}/audit-log/verify?workspace_id=${first.body.workspace.workspace_id}`);
  const firstIntegrityBody = await firstIntegrity.json();
  assert.equal(firstIntegrityBody.audit_integrity.valid, true);
  assert.equal(firstIntegrityBody.audit_integrity.checked_count, firstAuditBody.audit_log.length);
  assert.equal(firstIntegrityBody.audit_integrity.latest_entry_hash, firstAuditBody.audit_log.at(-1).entry_hash);
});

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
