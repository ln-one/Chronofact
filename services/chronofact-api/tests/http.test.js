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
