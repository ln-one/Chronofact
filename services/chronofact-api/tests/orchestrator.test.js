import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createChronofactOrchestrator } from "../src/orchestrator.js";
import { createInMemoryStore } from "../src/store.js";
import {
  createAiExplanationMock,
  createChronestiaMock,
  createDualweaveMock,
  createLimoraMock
} from "../src/mockClients.js";
import { sha256Hex } from "../src/digest.js";

async function createTestOrchestrator() {
  const storageDir = await mkdtemp(join(tmpdir(), "chronofact-api-"));
  const orchestrator = createChronofactOrchestrator({
    store: createInMemoryStore({
      clock: () => new Date("2026-05-13T00:00:00.000Z")
    }),
    clients: {
      limora: createLimoraMock(),
      dualweave: createDualweaveMock({ storageDir }),
      chronestia: createChronestiaMock({
        clock: () => new Date("2026-05-13T00:00:00.000Z")
      }),
      ai: createAiExplanationMock()
    }
  });

  return { orchestrator, storageDir };
}

test("submission stores the file off-chain and records a sha256-backed version", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const result = await orchestrator.submit({
    filename: "report.pdf",
    content: { content_text: "phase one report" }
  });

  assert.equal(result.upload_record.status, "stored");
  assert.equal(result.asset_version.version_no, 1);
  assert.equal(result.asset_version.previous_version_id, null);
  assert.equal(result.asset_version.sha256, sha256Hex(Buffer.from("phase one report")));
  assert.equal(result.verification_result.status, "verified");

  const stored = await readFile(join(storageDir, "upl_001-report.pdf"), "utf8");
  assert.equal(stored, "phase one report");
});

test("new versions preserve previous-version links and previous fact references", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const v1 = await orchestrator.submit({
    filename: "report-v1.pdf",
    content: { content_text: "v1" }
  });
  const v2 = await orchestrator.createVersion({
    asset_id: v1.asset_version.asset_id,
    filename: "report-v2.pdf",
    content: { content_text: "v2" }
  });

  assert.equal(v2.asset_version.version_no, 2);
  assert.equal(v2.asset_version.previous_version_id, v1.asset_version.version_id);
  assert.equal(v2.asset_version.previous_fact_id, v1.asset_version.fact_id);

  const asset = orchestrator.describeAsset(v1.asset_version.asset_id);
  assert.equal(asset.versions.length, 2);
});

test("verification detects digest mismatch without treating it as proof success", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const created = await orchestrator.submit({
    filename: "report.pdf",
    content: { content_text: "original" }
  });
  const result = await orchestrator.verify({
    version_id: created.asset_version.version_id,
    content: { content_text: "tampered" }
  });

  assert.equal(result.verification_result.status, "failed");
  assert.equal(result.verification_result.digest_match, false);
  assert.equal(result.verification_result.failure_reason, "digest_mismatch");
  assert.match(result.ai_explanation.summary, /does not match/);
});

test("verification distinguishes missing proof from chain access failure", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const created = await orchestrator.submit({
    filename: "report.pdf",
    content: { content_text: "original" }
  });

  const missing = await orchestrator.verify({
    version_id: created.asset_version.version_id,
    scenario: "proof_missing"
  });
  assert.equal(missing.verification_result.status, "pending");
  assert.equal(missing.verification_result.failure_reason, "proof_missing");

  const unavailable = await orchestrator.verify({
    version_id: created.asset_version.version_id,
    scenario: "chain_unavailable"
  });
  assert.equal(unavailable.verification_result.status, "unsupported");
  assert.equal(unavailable.verification_result.failure_reason, "chain_unavailable");
});

test("AI explanation failure is explicit and does not change verification status", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const created = await orchestrator.submit({
    filename: "report.pdf",
    content: { content_text: "original" }
  });
  const result = await orchestrator.verify({
    version_id: created.asset_version.version_id,
    scenario: "ai_unavailable"
  });

  assert.equal(result.verification_result.status, "verified");
  assert.equal(result.ai_explanation, null);
  assert.equal(result.ai_explanation_error.failure_reason, "ai_explanation_unavailable");
});

test("upload failure is surfaced before notarization succeeds", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  await assert.rejects(
    () =>
      orchestrator.submit({
        filename: "report.pdf",
        content: { content_text: "original" },
        scenario: "upload_failed"
      }),
    {
      code: "upload_failed"
    }
  );
});
