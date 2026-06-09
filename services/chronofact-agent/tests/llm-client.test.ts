import assert from "node:assert/strict";
import test from "node:test";
import { createAgentLlmClient } from "../src/llmClient.ts";

test("LLM client uses Chronofact-specific OpenAI-compatible env vars", async () => {
  const captures: Array<{ url: string; body: any; authorization: string | null }> = [];
  const client = createAgentLlmClient({
    env: {
      CHRONOFACT_AGENT_LLM_BASE_URL: "https://mimo.example/v1",
      CHRONOFACT_AGENT_LLM_API_KEY: "secret",
      CHRONOFACT_AGENT_LLM_MODEL: "mimo-v2.5-pro"
    },
    fetchImpl: async (url, options) => {
      captures.push({
        url: String(url),
        body: JSON.parse(String(options?.body)),
        authorization: new Headers(options?.headers).get("authorization")
      });
      return Response.json({
        choices: [{ message: { content: "已完成。" } }]
      });
    }
  });

  const result = await client.complete({ system: "system", user: "user" });

  assert.equal(result, "已完成。");
  assert.equal(client.configured, true);
  assert.equal(client.model, "mimo-v2.5-pro");
  const seen = captures[0];
  assert.ok(seen);
  assert.equal(seen.url, "https://mimo.example/v1/chat/completions");
  assert.equal(seen.body.model, "mimo-v2.5-pro");
  assert.equal(seen.authorization, "Bearer secret");
});

test("LLM client falls back to NeoSpectra-style LLM env vars", () => {
  const client = createAgentLlmClient({
    env: {
      LLM_BASE_URL: "https://token-plan-cn.xiaomimimo.com/v1",
      LLM_API_KEY: "secret",
      LLM_MODEL: "mimo-v2.5-pro"
    }
  });

  assert.equal(client.configured, true);
  assert.equal(client.model, "mimo-v2.5-pro");
});
