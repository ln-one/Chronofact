import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createChronofactAgentApp } from "../src/app.ts";

test("file upload stores a stable sha256 in conversation context", async (t) => {
  const { baseUrl, cleanup } = await withAgent(t);
  t.after(cleanup);

  const uploaded = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64"),
    mime_type: "text/plain"
  });

  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.body.file_id, "file_001");
  assert.equal(uploaded.body.sha256, "0682c5f2076f099c34cfdd15a9e063849ed437a49677e6fcc5b4198c76575be5");
  assert.equal(uploaded.body.filename, "report.txt");
  assert.equal(uploaded.body.size, 8);
});

test("preserve requires explicit confirmation before calling Chronofact API", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "帮我存证这个文件",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.match(chat.body.reply, /确认/);
  assert.equal(chat.body.tool_calls.length, 0);
  assert.equal(chronofact.requests.length, 0);
});

test("confirmed preserve calls Chronofact API and records tool call output", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "帮我存证这个文件",
    file_id: file.body.file_id,
    confirmed_action: true
  });

  assert.equal(chat.status, 200);
  assert.equal(chat.body.proof.proof_id, "proof_001");
  assert.equal(chat.body.tool_calls[0].tool_name, "preserveEvidence");
  assert.equal(chronofact.requests[0].path, "/organizations/org_001/evidence/preserve");
  assert.equal(chronofact.requests[0].body.sha256, file.body.sha256);
});

test("verify returns preserved and mismatch with explanation without hiding verification", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("tampered").toString("base64")
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "验证这个文件",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.equal(chat.body.verification.result, "mismatch");
  assert.equal(chat.body.explanation.risk_summary.failure_reason, "digest_mismatch");
  assert.match(chat.body.reply, /不一样|不一致/);
  assert.equal(chat.body.tool_calls.map((call: { tool_name: string }) => call.tool_name).join(","), "verifyEvidence,explainEvidence");
});

test("conversation detail includes messages, files, tool calls, and proof snapshots", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "帮我存证这个文件",
    file_id: file.body.file_id,
    confirmed_action: true
  });

  const detail = await getJson(`${baseUrl}/agent/conversations/conv_001`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.conversation.conversation_id, "conv_001");
  assert.equal(detail.body.files.length, 1);
  assert.equal(detail.body.messages.length, 2);
  assert.equal(detail.body.tool_calls.length, 1);
  assert.equal(detail.body.proof_snapshots.length, 1);
});

test("configured LLM writes the user-facing mismatch explanation", async (t) => {
  const chronofact = await withChronofactStub(t);
  const llmCalls: any[] = [];
  const { baseUrl, cleanup } = await withAgent(t, {
    chronofactApiUrl: chronofact.baseUrl,
    env: {
      CHRONOFACT_AGENT_LLM_BASE_URL: "https://mimo.example/v1",
      CHRONOFACT_AGENT_LLM_API_KEY: "secret",
      CHRONOFACT_AGENT_LLM_MODEL: "mimo-v2.5-pro"
    },
    fetchImpl: async (url, options) => {
      if (String(url).startsWith("https://mimo.example/v1")) {
        llmCalls.push(JSON.parse(String(options?.body)));
        return Response.json({
          choices: [{ message: { content: "这份文件和之前存证的版本不一样，你可以把它当作新版本重新存证，或者重新上传原文件再检查。" } }]
        });
      }
      return fetch(url, options);
    }
  });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("tampered").toString("base64")
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "验证这个文件",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.equal(chat.body.verification.result, "mismatch");
  assert.match(chat.body.reply, /^这份文件/);
  assert.equal(llmCalls.length, 1);
  const promptText = llmCalls[0].messages.map((message: { content: string }) => message.content).join("\n");
  assert.match(promptText, /用户通常不懂区块链/);
});

async function withAgent(
  t: { after: (fn: () => Promise<void>) => void },
  options: { chronofactApiUrl?: string; env?: Record<string, string>; fetchImpl?: typeof fetch } = {}
) {
  const dataDir = await mkdtemp(join(tmpdir(), "chronofact-agent-"));
  const { handler, close } = createChronofactAgentApp({
    dataDir,
    env: {
      CHRONOFACT_API_URL: options.chronofactApiUrl ?? "http://chronofact.example.test"
      ,
      ...(options.env || {})
    },
    fetchImpl: options.fetchImpl
  });
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };
  const cleanup = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    close();
    await rm(dataDir, { recursive: true, force: true });
  };
  return { baseUrl: `http://127.0.0.1:${port}`, cleanup };
}

async function withChronofactStub(t: { after: (fn: () => Promise<void>) => void }) {
  const requests: Array<{ path: string; body: any }> = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const body = await readJson(request);
    requests.push({ path: url.pathname, body });

    if (url.pathname.endsWith("/evidence/preserve")) {
      return sendJson(response, 201, {
        status: "preserved",
        proof_id: "proof_001",
        sha256: body.sha256,
        proof: {
          status: "verified",
          receipt_status: "available",
          anchor_status: "confirmed",
          tx_hash: "0xabc"
        },
        version: { version_id: "ver_001", asset_id: "asset_001" }
      });
    }

    if (url.pathname.endsWith("/evidence/verify")) {
      const result = body.sha256 === "0682c5f2076f099c34cfdd15a9e063849ed437a49677e6fcc5b4198c76575be5"
        ? "preserved"
        : "mismatch";
      return sendJson(response, 200, {
        result,
        sha256: body.sha256,
        proof: {
          failure_reason: result === "mismatch" ? "digest_mismatch" : null
        }
      });
    }

    if (url.pathname === "/ai/explain/risk") {
      return sendJson(response, 200, {
        explanation_type: "risk",
        risk_summary: {
          status: "failed",
          failure_reason: "digest_mismatch"
        },
        ai_explanation: {
          summary: "当前文件与存证摘要不一致。",
          risks: ["文件内容可能发生变化。"],
          next_checks: ["确认是否作为新版本提交。"],
          evidence_basis: ["verification_result"]
        }
      });
    }

    return sendJson(response, 404, { error: { message: "not found" } });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const { port } = server.address() as { port: number };
  return { baseUrl: `http://127.0.0.1:${port}`, requests };
}

async function getJson(url: string) {
  const response = await fetch(url);
  return { status: response.status, body: await response.json() };
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
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
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
