import assert from "node:assert/strict";
import test from "node:test";
import { createChronestiaHttpAdapter } from "../src/adapters/chronestiaHttpAdapter.js";

test("Chronestia HTTP adapter registers asset versions as Chronestia facts", async () => {
  let captured;
  let createPayload;
  const requests = [];
  const adapter = createChronestiaHttpAdapter({
    baseUrl: "http://chronestia.example.test/",
    fetchImpl: async (url, options) => {
      requests.push({ url, method: options.method });
      captured = {
        url,
        payload: options.body ? JSON.parse(options.body) : null
      };
      if (url.endsWith("/facts")) {
        createPayload = captured.payload;
      }
      if (url.endsWith("/receipt/refresh")) {
        return Response.json({
          receipt: {
            fact_id: "fact_123",
            anchor_ref: "dev://fact_123",
            anchor_status: "confirmed",
            provider: "dev",
            provider_payload: { transaction_hash: "0xdef" },
            updated_at: "2026-05-13T00:00:02.000Z"
          }
        });
      }
      return Response.json(
        {
          fact_id: "fact_123",
          fact_digest: "factdigest123",
          anchor_status: "recorded",
          registration: {
            status: "accepted",
            accepted_at: "2026-05-13T00:00:00.000Z"
          },
          receipt: {
            fact_id: "fact_123",
            anchor_ref: "dev://fact_123",
            anchor_status: "recorded",
            provider: "dev",
            provider_payload: { tx_hash: "0xabc" },
            updated_at: "2026-05-13T00:00:01.000Z"
          },
          fact: {
            id: "fact_123",
            previous_fact_id: "fact_prev"
          }
        },
        { status: 201 }
      );
    }
  });

  const result = await adapter.registerVersion({
    previousFactId: "fact_prev",
    assetVersion: {
      asset_id: "asset_001",
      version_id: "ver_002",
      version_no: 2,
      previous_version_id: "ver_001",
      sha256: "abc123",
      submitter_id: "demo_user",
      upload_id: "upl_001",
      storage_ref: "dualweave://upl_001"
    }
  });

  assert.equal(requests[0].url, "http://chronestia.example.test/facts");
  assert.equal(requests[1].url, "http://chronestia.example.test/facts/fact_123/receipt/refresh");
  assert.equal(captured.url, "http://chronestia.example.test/facts/fact_123/receipt/refresh");
  assert.equal(createPayload.subject.namespace, "chronofact");
  assert.equal(createPayload.fact.kind, "revised");
  assert.equal(createPayload.fact.previous_fact_id, "fact_prev");
  assert.equal(createPayload.evidence.digest, "abc123");
  assert.equal(result.fact_id, "fact_123");
  assert.equal(result.receipt_id, "dev://fact_123");
  assert.equal(result.anchor_status, "confirmed");
  assert.equal(result.tx_hash, "0xdef");
  assert.equal(result.chain.transaction_hash, "0xdef");
  assert.equal(result.chain.event_name, "FileVersionRegistered");
  assert.equal(result.chain.record_id, "fact_123");
});

test("Chronestia HTTP adapter maps verification states into Chronofact status vocabulary", async () => {
  const adapter = createChronestiaHttpAdapter({
    baseUrl: "http://chronestia.example.test",
    fetchImpl: async () =>
      Response.json({
        statement_signature_status: "not_checked",
        receipt_status: "valid",
        inclusion_proof_status: "unsupported",
        provider_status: "available",
        policy_status: "accepted",
        details: {},
        verified_at: "2026-05-13T00:00:00.000Z"
      })
  });

  const result = await adapter.verifyVersion({
    assetVersion: {
      fact_id: "fact_123"
    }
  });

  assert.equal(result.status, "verified");
  assert.equal(result.failure_reason, null);
  assert.equal(result.receipt_status, "valid");
  assert.equal(result.trace_status, "unsupported");
});
