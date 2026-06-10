import assert from "node:assert/strict";
import test from "node:test";
import { createAiExplanationHttpClient } from "../src/aiHttpClient.js";

test("AI HTTP client sends structured evidence and returns explanation fields", async () => {
  let captured;
  const client = createAiExplanationHttpClient({
    baseUrl: "http://ai.example.test/",
    fetchImpl: async (url, options) => {
      captured = {
        url,
        payload: JSON.parse(options.body)
      };
      return Response.json({
        summary: "ok",
        risks: [],
        next_checks: [],
        confidence_note: "AI is not proof.",
        evidence_basis: ["sha256", "verification_result"]
      });
    }
  });

  const result = await client.explain({
    verificationResult: {
      status: "verified",
      digest_match: true,
      receipt_status: "available",
      trace_status: "available",
      failure_reason: null
    },
    assetVersion: {
      asset_id: "asset_001",
      asset_type: "lab_report",
      version_id: "ver_001",
      version_no: 1,
      previous_version_id: null,
      sha256: "abc123",
      submitter_id: "user_001",
      receipt_id: "rcpt_001",
      fact_id: "fact_001",
      previous_fact_id: null,
      witness_record: {
        tx_hash: "0xabc",
        recorded_at: "2026-05-13T00:00:00.000Z",
        chain: {
          transaction_hash: "0xabc",
          event_name: "FileVersionRegistered",
          record_id: "0xrecord"
        }
      }
    },
    versionHistory: [
      {
        version_id: "ver_001",
        version_no: 1,
        previous_version_id: null,
        sha256: "abc123",
        fact_id: "fact_001",
        receipt_id: "rcpt_001"
      }
    ]
  });

  assert.equal(captured.url, "http://ai.example.test/api/ai/explain");
  assert.equal(captured.payload.asset_version.asset_id, "asset_001");
  assert.equal(captured.payload.verification_result.status, "verified");
  assert.equal(captured.payload.receipt.receipt_id, "rcpt_001");
  assert.equal(captured.payload.chain.transaction_hash, "0xabc");
  assert.equal(captured.payload.receipt.chain.record_id, "0xrecord");
  assert.equal(captured.payload.version_history[0].version_id, "ver_001");
  assert.deepEqual(result.evidence_basis, ["sha256", "verification_result"]);
});

test("AI HTTP client preserves explicit unavailable scenario", async () => {
  const client = createAiExplanationHttpClient({
    baseUrl: "http://ai.example.test",
    fetchImpl: async () => {
      throw new Error("should not be called");
    }
  });

  await assert.rejects(
    () =>
      client.explain({
        scenario: "ai_unavailable",
        verificationResult: {},
        assetVersion: {}
      }),
    {
      code: "ai_explanation_unavailable"
    }
  );
});
