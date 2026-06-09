import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
// chronofact-api is an existing JavaScript service without TypeScript declarations.
// @ts-expect-error TS7016
import { createApp as createChronofactApiApp } from "../../chronofact-api/src/app.js";
import { createChronofactAgentApp } from "../src/app.ts";

test("agent preserves and verifies through the real Chronofact API service", async (t) => {
  const apiStorageDir = await mkdtemp(join(tmpdir(), "chronofact-api-agent-smoke-"));
  const apiApp = createChronofactApiApp({ storageDir: apiStorageDir });
  const apiServer = createServer(apiApp.handler);
  await new Promise<void>((resolve) => apiServer.listen(0, resolve));
  const apiPort = (apiServer.address() as { port: number }).port;

  const agentDataDir = await mkdtemp(join(tmpdir(), "chronofact-agent-smoke-"));
  const agentApp = createChronofactAgentApp({
    dataDir: agentDataDir,
    env: { CHRONOFACT_API_URL: `http://127.0.0.1:${apiPort}` }
  });
  const agentServer = createServer(agentApp.handler);
  await new Promise<void>((resolve) => agentServer.listen(0, resolve));
  const agentPort = (agentServer.address() as { port: number }).port;
  const agentUrl = `http://127.0.0.1:${agentPort}`;

  t.after(async () => {
    await new Promise<void>((resolve) => agentServer.close(() => resolve()));
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    agentApp.close();
    await rm(agentDataDir, { recursive: true, force: true });
    await rm(apiStorageDir, { recursive: true, force: true });
  });

  const original = await postJson(`${agentUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  const preserved = await postJson(`${agentUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "帮我存证这个文件",
    file_id: original.body.file_id,
    confirmed_action: true
  });
  assert.equal(preserved.status, 200);
  assert.equal(preserved.body.proof.status, "preserved");

  const verified = await postJson(`${agentUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "验证这个文件",
    file_id: original.body.file_id
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.verification.result, "preserved");

  const tampered = await postJson(`${agentUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report-edited.txt",
    content_base64: Buffer.from("tampered").toString("base64")
  });
  const notPreserved = await postJson(`${agentUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "验证这个文件",
    file_id: tampered.body.file_id
  });
  assert.equal(notPreserved.status, 200);
  assert.equal(notPreserved.body.verification.result, "not_preserved");
  assert.equal(notPreserved.body.explanation, undefined);

  const changedSameName = await postJson(`${agentUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("tampered").toString("base64")
  });
  const possibleVersion = await postJson(`${agentUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "验证这个文件",
    file_id: changedSameName.body.file_id
  });
  assert.equal(possibleVersion.status, 200);
  assert.equal(possibleVersion.body.verification.result, "mismatch");
  assert.equal(possibleVersion.body.verification.agent_classification, "possible_new_version");
  assert.match(possibleVersion.body.reply, /新版本/);

  const preservedVersion = await postJson(`${agentUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "确认存证",
    file_id: changedSameName.body.file_id,
    confirmed_action: true
  });
  assert.equal(preservedVersion.status, 200);
  assert.equal(preservedVersion.body.proof.agent_preserve_mode, "version");
  assert.equal(preservedVersion.body.proof.version.version_no, 2);
  assert.equal(preservedVersion.body.proof.version.previous_version_id, preserved.body.proof.version.version_id);
  assert.equal(preservedVersion.body.tool_calls[0].tool_name, "preserveEvidenceVersion");
});

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}
