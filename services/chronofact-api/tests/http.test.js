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
