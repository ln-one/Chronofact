import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createChronofactAgentApp } from "../src/app.ts";

test("created conversation is visible in conversation list", async (t) => {
  const { baseUrl, cleanup } = await withAgent(t);
  t.after(cleanup);

  const created = await postJson(`${baseUrl}/agent/conversations`, {
    conversation_id: "conv_product",
    title: "产品化会话"
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.conversation.conversation_id, "conv_product");

  const listed = await getJson(`${baseUrl}/agent/conversations`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.conversations[0].conversation_id, "conv_product");
});

test("conversation list and detail can be scoped by requested organization", async (t) => {
  const { baseUrl, cleanup } = await withAgent(t);
  t.after(cleanup);

  await postJson(`${baseUrl}/agent/conversations`, {
    conversation_id: "conv_org_1",
    organization_id: "org_001",
    title: "Org 1"
  });
  await postJson(`${baseUrl}/agent/conversations`, {
    conversation_id: "conv_org_2",
    organization_id: "org_002",
    title: "Org 2"
  });

  const org2List = await getJson(`${baseUrl}/agent/conversations?organization_id=org_002`);
  assert.equal(org2List.status, 200);
  assert.deepEqual(org2List.body.conversations.map((item: any) => item.conversation_id), ["conv_org_2"]);

  const org2Detail = await getJson(`${baseUrl}/agent/conversations/conv_org_2?organization_id=org_002`);
  assert.equal(org2Detail.status, 200);
  assert.equal(org2Detail.body.conversation.organization_id, "org_002");

  const crossOrgDetail = await getJson(`${baseUrl}/agent/conversations/conv_org_1?organization_id=org_002`);
  assert.equal(crossOrgDetail.status, 404);
});

test("write paths reject conversation ids from another organization", async (t) => {
  const { baseUrl, cleanup } = await withAgent(t);
  t.after(cleanup);

  await postJson(`${baseUrl}/agent/conversations`, {
    conversation_id: "conv_scoped",
    organization_id: "org_001",
    title: "Scoped"
  });

  const upload = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_scoped",
    organization_id: "org_002",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  assert.equal(upload.status, 403);
  assert.equal(upload.body.error.code, "conversation_scope_denied");

  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_scoped",
    organization_id: "org_002",
    message: "这个文件存证了吗"
  });
  assert.equal(chat.status, 403);
  assert.equal(chat.body.error.code, "conversation_scope_denied");

  const run = await postJson(`${baseUrl}/agent/runs`, {
    conversation_id: "conv_scoped",
    organization_id: "org_002",
    message: "这个文件存证了吗"
  });
  assert.equal(run.status, 403);
  assert.equal(run.body.error.code, "conversation_scope_denied");
});

test("openapi document exposes agent routes", async (t) => {
  const { baseUrl, cleanup } = await withAgent(t);
  t.after(cleanup);

  const spec = await getJson(`${baseUrl}/openapi.json`);

  assert.equal(spec.status, 200);
  assert.equal(spec.body.info.title, "Chronofact Agent API");
  assert.ok(spec.body.paths["/health"]);
  assert.ok(spec.body.paths["/agent/conversations"]);
  assert.ok(spec.body.paths["/agent/conversations/{conversation_id}"]);
  assert.ok(spec.body.paths["/agent/files"]);
  assert.ok(spec.body.paths["/agent/chat"]);
  assert.ok(spec.body.paths["/agent/runs"]);
  assert.ok(spec.body.paths["/agent/documents"]);
});

test("health proxies Chronofact API runtime", async (t) => {
  const { baseUrl, cleanup } = await withAgent(t, {
    chronofactApiUrl: "http://chronofact.example.test",
    fetchImpl: async (url) => {
      if (String(url) === "http://chronofact.example.test/health") {
        return Response.json({
          status: "ok",
          service: "chronofact-api",
          runtime: {
            chronestia: { mode: "http", url: "http://127.0.0.1:8080" },
            limora: { mode: "http", url: "http://127.0.0.1:3002" },
            dualweave: { mode: "mock", url: null },
            ai: { mode: "mock", url: null }
          }
        });
      }
      return fetch(url);
    }
  });
  t.after(cleanup);

  const health = await getJson(`${baseUrl}/health`);

  assert.equal(health.status, 200);
  assert.equal(health.body.service, "chronofact-agent");
  assert.equal(health.body.chronofact_api.reachable, true);
  assert.equal(health.body.chronofact_api.runtime.chronestia.mode, "http");
  assert.equal(health.body.chronofact_api.runtime.chronestia.url, "http://127.0.0.1:8080");
});

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
  assert.equal(uploaded.body.tool_call.tool_name, "uploadFileContext");
});

test("preserve requires explicit confirmation before calling Chronofact API", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("missing").toString("base64")
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "帮我存证这个文件",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.match(chat.body.reply, /确认/);
  assert.equal(chat.body.file.file_id, file.body.file_id);
  assert.equal(chat.body.action_required.type, "confirm_preserve");
  assert.equal(chat.body.tool_calls.length, 0);
  assert.equal(chronofact.requests.length, 0);
});

test("LLM tool call chooses the verification tool instead of keyword-only routing", async (t) => {
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
        const body = JSON.parse(String(options?.body));
        llmCalls.push(body);
        if (body.tools) {
          return Response.json({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_verify",
                  type: "function",
                  function: { name: "verifyEvidence", arguments: JSON.stringify({ reason: "user asked whether the file is preserved" }) }
                }]
              }
            }]
          });
        }
        return Response.json({ choices: [{ message: { content: "没有找到这份文件的存证记录。" } }] });
      }
      return fetch(url, options);
    }
  });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("missing").toString("base64")
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "麻烦你看一下这个材料有没有备案",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.equal(chat.body.verification.result, "not_preserved");
  assert.equal(chat.body.tool_calls[0].tool_name, "verifyEvidence");
  assert.ok(llmCalls[0].tools.some((tool: any) => tool.function.name === "verifyEvidence"));
});

test("LLM tool call can choose the document library despite current file context", async (t) => {
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
        const body = JSON.parse(String(options?.body));
        llmCalls.push(body);
        if (body.tools) {
          return Response.json({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_library",
                  type: "function",
                  function: { name: "listDocumentLibrary", arguments: JSON.stringify({ reason: "user asks about the whole evidence ledger" }) }
                }]
              }
            }]
          });
        }
        return Response.json({ choices: [{ message: { content: "这个空间有 1 个已建档文件，没有发现待处理文件。" } }] });
      }
      return fetch(url, options);
    }
  });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_library_tool",
    organization_id: "org_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_library_tool",
    organization_id: "org_001",
    message: "确认存证",
    file_id: file.body.file_id,
    confirmed_action: true
  });

  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_library_tool",
    organization_id: "org_001",
    message: "把我的证据台账过一遍，挑出风险项",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.equal(chat.body.action, "library_summary");
  assert.equal(chat.body.tool_calls.map((call: { tool_name: string }) => call.tool_name).join(","), "listDocumentLibrary");
  assert.match(chat.body.reply, /已建档文件|空间/);
  assert.ok(llmCalls[0].tools.some((tool: any) => tool.function.name === "listDocumentLibrary"));
});

test("LLM tool call can execute inspect current file before verification", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, {
    chronofactApiUrl: chronofact.baseUrl,
    env: {
      CHRONOFACT_AGENT_LLM_BASE_URL: "https://mimo.example/v1",
      CHRONOFACT_AGENT_LLM_API_KEY: "secret",
      CHRONOFACT_AGENT_LLM_MODEL: "mimo-v2.5-pro"
    },
    fetchImpl: async (url, options) => {
      if (String(url).startsWith("https://mimo.example/v1")) {
        const body = JSON.parse(String(options?.body));
        if (body.tools) {
          return Response.json({
            choices: [{
              message: {
                tool_calls: [
                  {
                    id: "call_inspect",
                    type: "function",
                    function: { name: "inspectCurrentFile", arguments: JSON.stringify({ reason: "read current file context first" }) }
                  },
                  {
                    id: "call_verify",
                    type: "function",
                    function: { name: "verifyEvidence", arguments: JSON.stringify({ reason: "verify current file after inspection" }) }
                  }
                ]
              }
            }]
          });
        }
        return Response.json({ choices: [{ message: { content: "这份文件和之前存证的内容一致。" } }] });
      }
      return fetch(url, options);
    }
  });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_inspect_verify",
    organization_id: "org_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_inspect_verify",
    organization_id: "org_001",
    message: "帮我确认一下这份材料现在是否可信",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.equal(chat.body.verification.result, "preserved");
  assert.equal(chat.body.tool_calls.map((call: { tool_name: string }) => call.tool_name).join(","), "inspectCurrentFile,verifyEvidence");
});

test("LLM inspect-only current-file query is completed with verification", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, {
    chronofactApiUrl: chronofact.baseUrl,
    env: {
      CHRONOFACT_AGENT_LLM_BASE_URL: "https://mimo.example/v1",
      CHRONOFACT_AGENT_LLM_API_KEY: "secret",
      CHRONOFACT_AGENT_LLM_MODEL: "mimo-v2.5-pro"
    },
    fetchImpl: async (url, options) => {
      if (String(url).startsWith("https://mimo.example/v1")) {
        const body = JSON.parse(String(options?.body));
        if (body.tools) {
          return Response.json({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_inspect",
                  type: "function",
                  function: { name: "inspectCurrentFile", arguments: JSON.stringify({ reason: "read current file first" }) }
                }]
              }
            }]
          });
        }
        return Response.json({ choices: [{ message: { content: "我没有找到这份文件的存证记录。" } }] });
      }
      return fetch(url, options);
    }
  });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_inspect_only",
    organization_id: "org_001",
    filename: "missing-proof.txt",
    content_base64: Buffer.from("not preserved yet").toString("base64")
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_inspect_only",
    organization_id: "org_001",
    message: "这个文件存证了吗",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.equal(chat.body.verification.agent_classification, "not_preserved");
  assert.equal(chat.body.tool_calls.map((call: { tool_name: string }) => call.tool_name).join(","), "inspectCurrentFile,verifyEvidence");
  assert.match(chat.body.reply, /没有找到|未存证|还没有/);
});

test("model identity question reports configured agent model instead of file fallback", async (t) => {
  const { baseUrl, cleanup } = await withAgent(t, {
    env: {
      CHRONOFACT_AGENT_LLM_BASE_URL: "https://mimo.example/v1",
      CHRONOFACT_AGENT_LLM_API_KEY: "secret",
      CHRONOFACT_AGENT_LLM_MODEL: "mimo-v2.5-pro"
    },
    fetchImpl: async (url, options) => {
      if (String(url).startsWith("https://mimo.example/v1")) {
        const body = JSON.parse(String(options?.body));
        if (body.tools) {
          return Response.json({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_chat",
                  type: "function",
                  function: { name: "chatOnly", arguments: JSON.stringify({ reason: "user asks model identity" }) }
                }]
              }
            }]
          });
        }
        return new Response("upstream unavailable", { status: 503 });
      }
      return fetch(url, options);
    }
  });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_model_identity",
    organization_id: "org_001",
    filename: "current.txt",
    content_base64: Buffer.from("context").toString("base64")
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_model_identity",
    organization_id: "org_001",
    message: "你是什么模型",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.equal(chat.body.action, "chat");
  assert.match(chat.body.reply, /mimo-v2\.5-pro/);
  assert.match(chat.body.reply, /Chronofact Agent/);
  assert.doesNotMatch(chat.body.reply, /你可以直接问/);
});

test("LLM tool call can choose file content analysis without regex keywords", async (t) => {
  const llmCalls: any[] = [];
  const { baseUrl, cleanup } = await withAgent(t, {
    env: {
      CHRONOFACT_AGENT_LLM_BASE_URL: "https://mimo.example/v1",
      CHRONOFACT_AGENT_LLM_API_KEY: "secret",
      CHRONOFACT_AGENT_LLM_MODEL: "mimo-v2.5-pro"
    },
    fetchImpl: async (url, options) => {
      if (String(url).startsWith("https://mimo.example/v1")) {
        const body = JSON.parse(String(options?.body));
        llmCalls.push(body);
        if (body.tools) {
          return Response.json({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_analysis",
                  type: "function",
                  function: { name: "analyzeFileContent", arguments: JSON.stringify({ reason: "user wants the document read" }) }
                }]
              }
            }]
          });
        }
        return Response.json({
          choices: [{ message: { content: "这份材料主要是诚信考试承诺，提醒遵守考试纪律。" } }]
        });
      }
      return fetch(url, options);
    }
  });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_read_file",
    filename: "commitment.txt",
    content_base64: Buffer.from("诚信考试承诺书\n本人承诺遵守考试纪律。").toString("base64"),
    mime_type: "text/plain"
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_read_file",
    organization_id: "org_001",
    message: "给我读一下这份材料",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.equal(chat.body.action, "file_analysis");
  assert.equal(chat.body.tool_calls[0].tool_name, "analyzeFileContent");
  assert.match(chat.body.reply, /诚信考试/);
  assert.equal(chat.body.verification, null);
  assert.ok(llmCalls[0].tools.some((tool: any) => tool.function.name === "analyzeFileContent"));
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
  assert.equal(chat.body.assistant_message.metadata.file_id, file.body.file_id);
  assert.equal(chat.body.assistant_message.metadata.action, "preserve");
  assert.equal(chronofact.requests[0].path, "/organizations/org_001/evidence/preserve");
  assert.equal(chronofact.requests[0].body.sha256, file.body.sha256);
});

test("organization document library is shared across conversations by digest", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const first = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_a",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_a",
    organization_id: "org_001",
    message: "帮我存证这个文件",
    file_id: first.body.file_id,
    confirmed_action: true
  });

  const second = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_b",
    filename: "copy.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  assert.equal(second.body.document_match.type, "exact");

  const verified = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_b",
    organization_id: "org_001",
    message: "这个文件存证了吗",
    file_id: second.body.file_id
  });

  assert.equal(verified.status, 200);
  assert.equal(verified.body.verification.agent_classification, "preserved");
  assert.equal(verified.body.file.document_id, second.body.document_match.document_id);
  assert.equal(verified.body.file.document_version_id, second.body.document_match.latest_version.document_version_id);

  const detail = await getJson(`${baseUrl}/agent/conversations/conv_b`);
  assert.equal(detail.body.files[0].document.display_name, "report.txt");
  assert.equal(detail.body.files[0].version.version_no, 1);
});

test("Limora session scopes files and forwards auth headers to Chronofact API", async (t) => {
  const limora = await withLimoraStub(t, {
    memberships: [
      { organizationId: "org-a", organizationName: "Org A", permissions: ["chronofact.evidence.create", "chronofact.evidence.verify"] },
      { organizationId: "org-b", organizationName: "Org B", permissions: ["chronofact.evidence.create", "chronofact.evidence.verify"] }
    ]
  });
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, {
    chronofactApiUrl: chronofact.baseUrl,
    limoraApiUrl: limora.baseUrl
  });
  t.after(cleanup);

  const headers = { cookie: "better-auth.session_token=session-a" };
  const fileA = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_a",
    organization_id: "org-a",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  }, headers);
  assert.equal(fileA.status, 201);
  assert.equal(fileA.body.organization_id, "org-a");

  const preserved = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_a",
    organization_id: "org-a",
    message: "帮我存证这个文件",
    file_id: fileA.body.file_id,
    confirmed_action: true
  }, headers);
  assert.equal(preserved.status, 200);
  assert.equal(chronofact.requests.at(-1)?.headers.cookie, headers.cookie);

  const fileB = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_b",
    organization_id: "org-b",
    filename: "copy.txt",
    content_base64: Buffer.from("original").toString("base64")
  }, headers);
  assert.equal(fileB.status, 201);
  assert.equal(fileB.body.document_match.type, "none");

  const denied = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_b",
    organization_id: "org-a",
    message: "验证这个文件",
    file_id: fileB.body.file_id
  }, headers);
  assert.equal(denied.status, 403);
});

test("Limora rejects organizations outside current membership scope", async (t) => {
  const limora = await withLimoraStub(t, {
    memberships: [{ organizationId: "org-a", organizationName: "Org A", permissions: [] }]
  });
  const { baseUrl, cleanup } = await withAgent(t, { limoraApiUrl: limora.baseUrl });
  t.after(cleanup);

  const response = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_a",
    organization_id: "org-b",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  }, { cookie: "better-auth.session_token=session-a" });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "organization_access_denied");
});

test("stale version asset falls back to first preserve instead of failing forever", async (t) => {
  const chronofact = await withChronofactStub(t, { staleVersionAsset: true });
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const original = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "帮我存证这个文件",
    file_id: original.body.file_id,
    confirmed_action: true
  });

  const changedSameName = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("tampered").toString("base64")
  });
  const preserved = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "确认存证",
    file_id: changedSameName.body.file_id,
    confirmed_action: true
  });

  assert.equal(preserved.status, 200);
  assert.equal(preserved.body.proof.proof_id, "proof_001");
  assert.equal(preserved.body.tool_calls[0].tool_name, "preserveEvidence");
  assert.equal(chronofact.requests.at(-2)?.path, "/assets/asset_001/versions");
  assert.equal(chronofact.requests.at(-1)?.path, "/organizations/org_001/evidence/preserve");
});

test("verification does not compare different filenames to the latest proof and classifies same-name digest changes", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const original = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "帮我存证这个文件",
    file_id: original.body.file_id,
    confirmed_action: true
  });

  const otherFile = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "other.txt",
    content_base64: Buffer.from("tampered").toString("base64")
  });
  const otherChat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "这个文件存证了吗",
    file_id: otherFile.body.file_id
  });

  assert.equal(otherChat.status, 200);
  assert.equal(otherChat.body.verification.result, "not_preserved");
  assert.equal(otherChat.body.explanation, undefined);
  assert.equal(otherChat.body.file.filename, "other.txt");
  assert.equal(otherChat.body.tool_calls.map((call: { tool_name: string }) => call.tool_name).join(","), "verifyEvidence");
  assert.equal(chronofact.requests.at(-1)?.body.proof_id, undefined);

  const changedSameName = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("tampered").toString("base64")
  });
  const sameNameChat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "这个文件存证了吗",
    file_id: changedSameName.body.file_id
  });

  assert.equal(sameNameChat.status, 200);
  assert.equal(sameNameChat.body.verification.result, "not_preserved");
  assert.equal(sameNameChat.body.verification.agent_classification, "version_candidate");
  assert.equal(sameNameChat.body.explanation, null);
  assert.match(sameNameChat.body.reply, /新版本/);
  assert.notEqual(chronofact.requests.at(-1)?.body.proof_id, "proof_001");

  const versionPreserve = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "确认存证",
    file_id: changedSameName.body.file_id,
    confirmed_action: true
  });

  assert.equal(versionPreserve.status, 200);
  assert.equal(versionPreserve.body.proof.proof_id, "proof_002");
  assert.equal(versionPreserve.body.proof.version.version_no, 2);
  assert.equal(versionPreserve.body.tool_calls[0].tool_name, "preserveEvidenceVersion");
  assert.equal(chronofact.requests.at(-1)?.path, "/assets/asset_001/versions");
  assert.equal(chronofact.requests.at(-1)?.body.sha256, changedSameName.body.sha256);
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
  assert.equal(detail.body.messages[0].metadata.file_id, file.body.file_id);
  assert.equal(detail.body.current_file.file_id, file.body.file_id);
  assert.equal(detail.body.tool_calls.length, 2);
  assert.equal(detail.body.tool_calls.map((call: { tool_name: string }) => call.tool_name).join(","), "uploadFileContext,preserveEvidence");
  assert.equal(detail.body.proof_snapshots.length, 1);
});

test("configured LLM writes the user-facing mismatch explanation", async (t) => {
  const chronofact = await withChronofactStub(t, { mismatchWithoutProof: true });
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
  assert.equal(llmCalls.length, 2);
  const promptText = llmCalls[1].messages.map((message: { content: string }) => message.content).join("\n");
  assert.match(promptText, /用户通常不懂区块链/);
});

test("LLM wording cannot contradict a not_preserved verification result", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, {
    chronofactApiUrl: chronofact.baseUrl,
    env: {
      CHRONOFACT_AGENT_LLM_BASE_URL: "https://mimo.example/v1",
      CHRONOFACT_AGENT_LLM_API_KEY: "secret",
      CHRONOFACT_AGENT_LLM_MODEL: "mimo-v2.5-pro"
    },
    fetchImpl: async (url, options) => {
      if (String(url).startsWith("https://mimo.example/v1")) {
        return Response.json({
          choices: [{ message: { content: "文件内容与存证一致，但该存证记录已失效或过期。" } }]
        });
      }
      return fetch(url, options);
    }
  });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "missing.txt",
    content_base64: Buffer.from("missing").toString("base64")
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "这个文件有没有存证",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.equal(chat.body.verification.result, "not_preserved");
  assert.match(chat.body.reply, /没有找到/);
  assert.doesNotMatch(chat.body.reply, /一致|失效|过期/);
});

test("agent run persists a running assistant message for refresh recovery", async (t) => {
  const chronofact = await withChronofactStub(t, { delayMs: 80 });
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  const started = await postJson(`${baseUrl}/agent/runs`, {
    conversation_id: "conv_001",
    organization_id: "org_001",
    message: "验证这个文件",
    file_id: file.body.file_id
  });

  assert.equal(started.status, 202);
  assert.equal(started.body.run.status, "running");
  assert.equal(started.body.assistant_message.status, "running");

  const running = await getJson(`${baseUrl}/agent/conversations/conv_001`);
  assert.equal(running.body.runs[0].status, "running");
  assert.equal(running.body.messages.at(-1).status, "running");
  assert.match(running.body.messages.at(-1).content, /正在检查/);

  const completed = await waitForCompletedRun(`${baseUrl}/agent/conversations/conv_001`);
  assert.equal(completed.body.runs[0].status, "completed");
  assert.equal(completed.body.messages.at(-1).status, "completed");
  assert.match(completed.body.messages.at(-1).content, /一致/);
});

test("agent can summarize organization document library without a current file", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_source",
    organization_id: "org_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_source",
    organization_id: "org_001",
    message: "确认存证",
    file_id: file.body.file_id,
    confirmed_action: true
  });

  await postJson(`${baseUrl}/agent/conversations`, {
    conversation_id: "conv_summary",
    organization_id: "org_001",
    title: "文件库分析"
  });
  const started = await postJson(`${baseUrl}/agent/runs`, {
    conversation_id: "conv_summary",
    organization_id: "org_001",
    message: "我要看所有文件的存证情况"
  });
  assert.equal(started.status, 202);

  const completed = await waitForCompletedRun(`${baseUrl}/agent/conversations/conv_summary`);
  const assistant = completed.body.messages.at(-1);
  assert.equal(completed.body.runs[0].status, "completed");
  assert.equal(assistant.status, "completed");
  assert.match(assistant.content, /1 个已建档文件/);
  assert.match(assistant.content, /report\.txt/);
  assert.match(assistant.content, /已存证/);
  assert.doesNotMatch(assistant.content, /请先上传/);
  assert.equal(assistant.metadata.action, "library_summary");
  assert.equal(completed.body.tool_calls.at(-1).tool_name, "listDocumentLibrary");
});

test("library overview uses the organization library even when a stale file id is sent", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_mixed",
    organization_id: "org_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_mixed",
    organization_id: "org_001",
    message: "确认存证",
    file_id: file.body.file_id,
    confirmed_action: true
  });

  const fileScoped = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_mixed",
    organization_id: "org_001",
    message: "帮我分析当前空间所有文件的存证情况",
    file_id: file.body.file_id
  });
  assert.equal(fileScoped.status, 200);
  assert.equal(fileScoped.body.action, "library_summary");
  assert.match(fileScoped.body.reply, /1 个已建档文件/);

  const libraryScoped = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_mixed",
    organization_id: "org_001",
    message: "帮我分析当前空间所有文件的存证情况"
  });
  assert.equal(libraryScoped.status, 200);
  assert.equal(libraryScoped.body.action, "library_summary");
  assert.match(libraryScoped.body.reply, /1 个已建档文件/);
});

test("organization document library API lists files across conversations", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_source",
    organization_id: "org_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_source",
    organization_id: "org_001",
    message: "确认存证",
    file_id: file.body.file_id,
    confirmed_action: true
  });
  await postJson(`${baseUrl}/agent/conversations`, {
    conversation_id: "conv_other",
    organization_id: "org_001",
    title: "另一个对话"
  });

  const library = await getJson(`${baseUrl}/agent/documents?organization_id=org_001`);

  assert.equal(library.status, 200);
  assert.equal(library.body.organization_id, "org_001");
  assert.equal(library.body.totals.documents, 1);
  assert.equal(library.body.totals.preserved_documents, 1);
  assert.equal(library.body.documents[0].document.display_name, "report.txt");
  assert.equal(library.body.documents[0].latest_version.proof_id, "proof_001");
});

test("agent treats unpreserved-file questions as organization library queries", async (t) => {
  const chronofact = await withChronofactStub(t);
  const { baseUrl, cleanup } = await withAgent(t, { chronofactApiUrl: chronofact.baseUrl });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_source",
    organization_id: "org_001",
    filename: "report.txt",
    content_base64: Buffer.from("original").toString("base64")
  });
  await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_source",
    organization_id: "org_001",
    message: "确认存证",
    file_id: file.body.file_id,
    confirmed_action: true
  });
  await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_draft",
    organization_id: "org_001",
    filename: "draft.txt",
    content_base64: Buffer.from("not preserved yet").toString("base64")
  });
  for (let index = 2; index <= 6; index += 1) {
    await postJson(`${baseUrl}/agent/files`, {
      conversation_id: `conv_draft_${index}`,
      organization_id: "org_001",
      filename: `draft-${index}.txt`,
      content_base64: Buffer.from(`not preserved yet ${index}`).toString("base64")
    });
  }

  await postJson(`${baseUrl}/agent/conversations`, {
    conversation_id: "conv_cross",
    organization_id: "org_001",
    title: "跨会话文件库"
  });
  const started = await postJson(`${baseUrl}/agent/runs`, {
    conversation_id: "conv_cross",
    organization_id: "org_001",
    message: "帮我看看看有没有文件没有存证"
  });
  assert.equal(started.status, 202);

  const completed = await waitForCompletedRun(`${baseUrl}/agent/conversations/conv_cross`);
  const assistant = completed.body.messages.at(-1);
  assert.equal(assistant.status, "completed");
  assert.equal(assistant.metadata.action, "library_summary");
  assert.match(assistant.content, /1 个已建档文件/);
  assert.match(assistant.content, /report\.txt/);
  assert.match(assistant.content, /draft-6\.txt/);
  assert.match(assistant.content, /已上传但还没有正式存证/);
  assert.match(assistant.content, /还有 1 个待处理文件没有展开/);
  assert.doesNotMatch(assistant.content, /请先上传/);

  await postJson(`${baseUrl}/agent/conversations`, {
    conversation_id: "conv_cross_with_file",
    organization_id: "org_001",
    title: "带当前文件的文件库查询"
  });
  const withCurrentFile = await postJson(`${baseUrl}/agent/runs`, {
    conversation_id: "conv_cross_with_file",
    organization_id: "org_001",
    message: "请分享目前所有存证的文件，有没有有问题的文件",
    file_id: file.body.file_id
  });
  assert.equal(withCurrentFile.status, 202);

  const completedWithFile = await waitForCompletedRun(`${baseUrl}/agent/conversations/conv_cross_with_file`);
  const assistantWithFile = completedWithFile.body.messages.at(-1);
  assert.equal(assistantWithFile.status, "completed");
  assert.equal(assistantWithFile.metadata.action, "library_summary");
  assert.match(assistantWithFile.content, /1 个已建档文件/);
  assert.match(assistantWithFile.content, /待处理文件/);
  assert.doesNotMatch(assistantWithFile.content, /您提交的文件/);
});

test("agent analyzes uploaded text file content without calling evidence verification", async (t) => {
  const llmCalls: any[] = [];
  const { baseUrl, cleanup } = await withAgent(t, {
    env: {
      CHRONOFACT_AGENT_LLM_BASE_URL: "https://mimo.example/v1",
      CHRONOFACT_AGENT_LLM_API_KEY: "secret",
      CHRONOFACT_AGENT_LLM_MODEL: "mimo-v2.5-pro"
    },
    fetchImpl: async (url, options) => {
      if (String(url).startsWith("https://mimo.example/v1")) {
        llmCalls.push(JSON.parse(String(options?.body)));
        return Response.json({
          choices: [{
            message: {
              content: "这份文件主要说明诚信考试承诺，包含考试纪律、责任确认和违规后果。"
            }
          }]
        });
      }
      return fetch(url, options);
    }
  });
  t.after(cleanup);

  const file = await postJson(`${baseUrl}/agent/files`, {
    conversation_id: "conv_analysis",
    filename: "commitment.txt",
    content_base64: Buffer.from("诚信考试承诺书\n本人承诺遵守考试纪律，独立完成考试。").toString("base64"),
    mime_type: "text/plain"
  });
  const chat = await postJson(`${baseUrl}/agent/chat`, {
    conversation_id: "conv_analysis",
    organization_id: "org_001",
    message: "帮我分析这个文件内容",
    file_id: file.body.file_id
  });

  assert.equal(chat.status, 200);
  assert.match(chat.body.reply, /诚信考试承诺/);
  assert.equal(chat.body.action, "file_analysis");
  assert.equal(chat.body.tool_calls[0].tool_name, "analyzeFileContent");
  assert.match(chat.body.tool_calls[0].output.preview, /考试纪律/);
  assert.equal(chat.body.verification, null);
  assert.equal(llmCalls.length, 2);
  assert.ok(llmCalls[0].tools.some((tool: any) => tool.function.name === "analyzeFileContent"));
});

async function withAgent(
  t: { after: (fn: () => Promise<void>) => void },
  options: { chronofactApiUrl?: string; limoraApiUrl?: string; env?: Record<string, string>; fetchImpl?: typeof fetch } = {}
) {
  const dataDir = await mkdtemp(join(tmpdir(), "chronofact-agent-"));
  const { handler, close } = createChronofactAgentApp({
    dataDir,
    env: {
      CHRONOFACT_API_URL: options.chronofactApiUrl ?? "http://chronofact.example.test",
      ...(options.limoraApiUrl ? { CHRONOFACT_AGENT_LIMORA_URL: options.limoraApiUrl } : {}),
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

async function withChronofactStub(
  t: { after: (fn: () => Promise<void>) => void },
  options: { delayMs?: number; mismatchWithoutProof?: boolean; staleVersionAsset?: boolean } = {}
) {
  const requests: Array<{ path: string; body: any; headers: Record<string, string | undefined> }> = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const body = await readJson(request);
    requests.push({ path: url.pathname, body, headers: { cookie: request.headers.cookie, authorization: request.headers.authorization } });

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

    if (url.pathname === "/assets/asset_001/versions") {
      if (options.staleVersionAsset) {
        return sendJson(response, 404, { error: { message: "Asset asset_001 was not found." } });
      }
      return sendJson(response, 201, {
        identity_context: { user_id: "user_001" },
        asset_version: {
          asset_id: "asset_001",
          version_id: "ver_002",
          version_no: 2,
          previous_version_id: "ver_001",
          filename: body.filename,
          sha256: body.sha256
        },
        witness_record: {
          provider: "chronestia",
          fact_id: "fact_002",
          receipt_id: "receipt_002",
          anchor_status: "confirmed",
          tx_hash: "0xdef"
        },
        preservation_record: {
          preservation_id: "proof_002",
          asset_id: "asset_001",
          version_id: "ver_002"
        },
        verification_result: {
          status: "verified",
          receipt_status: "available",
          trace_status: "available"
        }
      });
    }

    if (url.pathname.endsWith("/evidence/verify")) {
      if (options.delayMs) {
        await sleep(options.delayMs);
      }
      const originalSha = "0682c5f2076f099c34cfdd15a9e063849ed437a49677e6fcc5b4198c76575be5";
      const result = body.proof_id
        ? body.sha256 === originalSha ? "preserved" : "mismatch"
        : body.sha256 === originalSha
        ? "preserved"
        : options.mismatchWithoutProof
        ? "mismatch"
        : "not_preserved";
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

async function withLimoraStub(
  t: { after: (fn: () => Promise<void>) => void },
  options: {
    memberships: Array<{ organizationId: string; organizationName: string; permissions: string[] }>;
  }
) {
  const requests: Array<{ path: string; body: any; headers: Record<string, string | undefined> }> = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const body = await readJson(request);
    requests.push({ path: url.pathname, body, headers: { cookie: request.headers.cookie, authorization: request.headers.authorization } });

    if (!request.headers.cookie && !request.headers.authorization) {
      return sendJson(response, 401, { error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    }

    if (url.pathname === "/v1/sessions/current") {
      return sendJson(response, 200, {
        data: {
          session: { id: "session-a", userId: "user-a", expiresAt: "2099-01-01T00:00:00.000Z" },
          identity: { id: "user-a", email: "user@example.com", name: "User A" },
          memberships: options.memberships.map((membership, index) => ({
            id: `membership-${index + 1}`,
            organizationId: membership.organizationId,
            identityId: "user-a",
            permissions: membership.permissions,
            organization: {
              id: membership.organizationId,
              name: membership.organizationName
            }
          }))
        }
      });
    }

    return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "not found" } });
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

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
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

async function waitForCompletedRun(url: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const detail = await getJson(url);
    if (detail.body.runs?.[0]?.status === "completed") {
      return detail;
    }
    await sleep(20);
  }
  throw new Error("Run did not complete");
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
