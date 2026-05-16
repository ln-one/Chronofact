import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";

async function withServer(t) {
  const storageDir = await mkdtemp(join(tmpdir(), "chronofact-http-"));
  const { handler } = createApp({ storageDir, env: {} });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(storageDir, { recursive: true, force: true });
  });
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

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

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}
