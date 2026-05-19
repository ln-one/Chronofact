import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createChronofactOrchestrator } from "../src/orchestrator.js";
import { createInMemoryStore } from "../src/store.js";
import {
  createAiExplanationMockAdapter,
  createChronestiaMockAdapter,
  createDemoLimoraAdapter,
  createDualweaveMockAdapter
} from "../src/adapters/mockAdapters.js";
import { sha256Hex } from "../src/digest.js";

async function createTestOrchestrator() {
  const storageDir = await mkdtemp(join(tmpdir(), "chronofact-api-"));
  const orchestrator = createChronofactOrchestrator({
    store: createInMemoryStore({
      clock: () => new Date("2026-05-13T00:00:00.000Z")
    }),
    clients: {
      limora: createDemoLimoraAdapter(),
      dualweave: createDualweaveMockAdapter({ storageDir }),
      chronestia: createChronestiaMockAdapter({
        clock: () => new Date("2026-05-13T00:00:00.000Z")
      }),
      ai: createAiExplanationMockAdapter()
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

test("workspaces group assets and expose preservation timeline data", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const createdWorkspace = await orchestrator.createWorkspace({
    title: "Experiment 1 Delivery",
    workspace_type: "course_project",
    description: "Final report and evidence package"
  });
  const submitted = await orchestrator.submit({
    workspace_id: createdWorkspace.workspace.workspace_id,
    asset_title: "Final report",
    filename: "report.pdf",
    content: { content_text: "report content" }
  });

  assert.equal(submitted.preservation_record.digest_algorithm, "sha256");
  assert.equal(submitted.preservation_record.verification_status, "verified");
  assert.equal(submitted.asset_version.workspace_id, createdWorkspace.workspace.workspace_id);

  const detail = orchestrator.describeWorkspace(createdWorkspace.workspace.workspace_id);
  assert.equal(detail.assets.length, 1);
  assert.equal(detail.assets[0].title, "Final report");
  assert.equal(detail.assets[0].latest_version.preservation_record.verification_status, "verified");
  assert.ok(detail.audit_log.some((entry) => entry.action === "workspace_created"));
  assert.ok(detail.audit_log.some((entry) => entry.action === "preservation_record_created"));
});

test("workspace reports summarize assets, digests, verification, and audit events", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const createdWorkspace = await orchestrator.createWorkspace({
    title: "Lab Report Review"
  });
  await orchestrator.submit({
    workspace_id: createdWorkspace.workspace.workspace_id,
    filename: "lab.md",
    content: { content_text: "lab report" }
  });

  const report = orchestrator.exportWorkspaceReport(createdWorkspace.workspace.workspace_id);
  assert.equal(report.report.format, "markdown");
  assert.match(report.report.content, /# Lab Report Review/);
  assert.match(report.report.content, /Latest digest:/);
  assert.match(report.report.content, /preservation_record_created/);
});

test("AI explanation endpoints explain facts, traces, and risk from structured evidence", async (t) => {
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

  const fact = await orchestrator.explainFact({
    version_id: v2.asset_version.version_id
  });
  assert.equal(fact.explanation_type, "fact");
  assert.equal(fact.verification_result.status, "verified");
  assert.match(fact.ai_explanation.summary, /Version 2/);

  const trace = await orchestrator.explainTrace({
    asset_id: v1.asset_version.asset_id
  });
  assert.equal(trace.explanation_type, "trace");
  assert.equal(trace.trace.version_count, 2);
  assert.equal(trace.trace.versions[1].previous_version_id, v1.asset_version.version_id);
  assert.ok(trace.ai_explanation.evidence_basis.includes("version history"));

  const risk = await orchestrator.explainRisk({
    version_id: v2.asset_version.version_id,
    scenario: "proof_missing"
  });
  assert.equal(risk.explanation_type, "risk");
  assert.equal(risk.risk_summary.severity, "medium");
  assert.equal(risk.risk_summary.requires_manual_review, true);
});

test("evidence search returns preservation records with asset and version context", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const workspace = await orchestrator.createWorkspace({
    title: "Evidence Search"
  });
  const created = await orchestrator.submit({
    workspace_id: workspace.workspace.workspace_id,
    filename: "report.pdf",
    content: { content_text: "report" }
  });

  const listed = orchestrator.listEvidence({
    workspaceId: workspace.workspace.workspace_id,
    verificationStatus: "verified",
    createdFrom: "2026-05-13T00:00:00.000Z",
    createdTo: "2026-05-13T00:00:00.000Z"
  });
  assert.equal(listed.evidence.length, 1);
  assert.equal(listed.evidence[0].asset_version.version_id, created.asset_version.version_id);

  const detail = orchestrator.describeEvidence({
    version_id: created.asset_version.version_id
  });
  assert.equal(detail.evidence.preservation_record.digest, created.asset_version.sha256);
  assert.equal(detail.evidence.witness_record.fact_id, created.witness_record.fact_id);
});

test("version reports export verification conclusion with evidence and AI next checks", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const created = await orchestrator.submit({
    filename: "report.pdf",
    content: { content_text: "report" }
  });
  const report = await orchestrator.exportVersionReport({
    version_id: created.asset_version.version_id
  });

  assert.equal(report.report.format, "markdown");
  assert.equal(report.verification_result.status, "verified");
  assert.match(report.report.content, /# Verification Report:/);
  assert.match(report.report.content, /## Evidence/);
  assert.match(report.report.content, /## Verification/);
  assert.match(report.report.content, /## AI Explanation/);
  assert.match(report.report.content, new RegExp(created.asset_version.sha256));
});

test("manual reviews are separate from AI explanations and appear in reports", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const workspace = await orchestrator.createWorkspace({
    title: "Manual Review"
  });
  const created = await orchestrator.submit({
    workspace_id: workspace.workspace.workspace_id,
    filename: "report.pdf",
    content: { content_text: "report" }
  });

  const review = await orchestrator.createReview({
    version_id: created.asset_version.version_id,
    decision: "needs_revision",
    summary: "Missing result screenshot",
    notes: "Ask the student to upload the screenshot evidence.",
    next_checks: ["Upload screenshot", "Re-run verification report"]
  });
  assert.equal(review.review_record.decision, "needs_revision");
  assert.equal(review.evidence.review_records.length, 1);

  const reviews = orchestrator.listReviews({
    workspaceId: workspace.workspace.workspace_id,
    decision: "needs_revision"
  });
  assert.equal(reviews.reviews.length, 1);

  const audit = orchestrator.listAuditLog({
    workspaceId: workspace.workspace.workspace_id,
    action: "review_record_created"
  });
  assert.equal(audit.audit_log.length, 1);

  const report = await orchestrator.exportVersionReport({
    version_id: created.asset_version.version_id
  });
  assert.match(report.report.content, /## Manual Review/);
  assert.match(report.report.content, /Decision: needs_revision/);
  assert.match(report.report.content, /Missing result screenshot/);
});

test("workspace status updates are audited", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const workspace = await orchestrator.createWorkspace({
    title: "Status Flow"
  });
  const updated = await orchestrator.updateWorkspaceStatus({
    workspace_id: workspace.workspace.workspace_id,
    status: "under_review"
  });

  assert.equal(updated.workspace.status, "under_review");
  const audit = orchestrator.listAuditLog({
    workspaceId: workspace.workspace.workspace_id,
    action: "workspace_status_updated"
  });
  assert.equal(audit.audit_log.length, 1);
});

test("demo seed creates a complete course delivery workflow", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const seeded = await orchestrator.seedDemoScenario();

  assert.equal(seeded.scenario, "course_delivery");
  assert.equal(seeded.workspace.status, "under_review");
  assert.equal(seeded.primary_asset.version_count, 2);
  assert.equal(seeded.pending_asset.failure_reason, "proof_missing");
  assert.equal(seeded.created.versions.length, 3);
  assert.equal(seeded.created.reviews.length, 2);
  assert.match(seeded.demo_links.workspace_report, new RegExp(seeded.workspace.workspace_id));

  const workspace = orchestrator.describeWorkspace(seeded.workspace.workspace_id);
  assert.equal(workspace.assets.length, 2);

  const evidence = orchestrator.listEvidence({
    workspaceId: seeded.workspace.workspace_id
  });
  assert.equal(evidence.evidence.length, 3);

  const audit = orchestrator.listAuditLog({
    workspaceId: seeded.workspace.workspace_id
  });
  assert.ok(audit.audit_log.some((entry) => entry.action === "workspace_status_updated"));
  assert.ok(audit.audit_log.some((entry) => entry.action === "review_record_created"));
});

test("workspace overview aggregates evidence, reviews, activity, and attention items", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const seeded = await orchestrator.seedDemoScenario();
  const overview = orchestrator.describeWorkspaceOverview(seeded.workspace.workspace_id);

  assert.equal(overview.summary.asset_count, 2);
  assert.equal(overview.summary.version_count, 3);
  assert.equal(overview.summary.evidence_count, 3);
  assert.equal(overview.summary.review_count, 2);
  assert.equal(overview.summary.verification_status_counts.verified, 2);
  assert.equal(overview.summary.verification_status_counts.pending, 1);
  assert.equal(overview.summary.failure_reason_counts.proof_missing, 1);
  assert.equal(overview.summary.review_decision_counts.approved, 1);
  assert.equal(overview.summary.review_decision_counts.needs_revision, 1);
  assert.ok(overview.attention_items.some((item) => item.kind === "verification"));
  assert.ok(overview.attention_items.some((item) => item.kind === "manual_review"));
  assert.ok(overview.latest_activity.length > 0);
  assert.match(overview.links.overview, new RegExp(seeded.workspace.workspace_id));
});

test("audit log entries form a verifiable hash chain", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const seeded = await orchestrator.seedDemoScenario();
  const audit = orchestrator.listAuditLog({
    workspaceId: seeded.workspace.workspace_id
  });
  assert.ok(audit.audit_log.length > 0);
  assert.equal(audit.audit_log[0].previous_hash, null);
  assert.match(audit.audit_log[0].entry_hash, /^[a-f0-9]{64}$/);
  assert.equal(audit.audit_log[1].previous_hash, audit.audit_log[0].entry_hash);

  const integrity = orchestrator.verifyAuditLog({
    workspaceId: seeded.workspace.workspace_id
  });
  assert.equal(integrity.audit_integrity.valid, true);
  assert.equal(integrity.audit_integrity.scoped_count, audit.audit_log.length);
  assert.equal(integrity.audit_integrity.latest_entry_hash, audit.audit_log.at(-1).entry_hash);

  const overview = orchestrator.describeWorkspaceOverview(seeded.workspace.workspace_id);
  assert.equal(overview.summary.audit_chain_valid, true);
  assert.equal(overview.summary.latest_audit_hash, audit.audit_log.at(-1).entry_hash);
});

test("workspace audit hash chains stay scoped when workspaces interleave", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const first = await orchestrator.createWorkspace({ title: "First Workspace" });
  const second = await orchestrator.createWorkspace({ title: "Second Workspace" });
  await orchestrator.submit({
    workspace_id: first.workspace.workspace_id,
    filename: "first.md",
    content: { content_text: "first" }
  });
  await orchestrator.submit({
    workspace_id: second.workspace.workspace_id,
    filename: "second.md",
    content: { content_text: "second" }
  });
  await orchestrator.updateWorkspaceStatus({
    workspace_id: first.workspace.workspace_id,
    status: "under_review"
  });

  const firstAudit = orchestrator.listAuditLog({
    workspaceId: first.workspace.workspace_id
  }).audit_log;
  const secondAudit = orchestrator.listAuditLog({
    workspaceId: second.workspace.workspace_id
  }).audit_log;

  assert.equal(firstAudit[0].previous_hash, null);
  assert.equal(firstAudit[1].previous_hash, firstAudit[0].entry_hash);
  assert.equal(firstAudit.at(-1).previous_hash, firstAudit.at(-2).entry_hash);
  assert.equal(secondAudit[0].previous_hash, null);

  const firstIntegrity = orchestrator.verifyAuditLog({
    workspaceId: first.workspace.workspace_id
  }).audit_integrity;
  const secondIntegrity = orchestrator.verifyAuditLog({
    workspaceId: second.workspace.workspace_id
  }).audit_integrity;
  assert.equal(firstIntegrity.valid, true);
  assert.equal(firstIntegrity.checked_count, firstAudit.length);
  assert.equal(firstIntegrity.latest_entry_hash, firstAudit.at(-1).entry_hash);
  assert.equal(secondIntegrity.valid, true);
  assert.equal(secondIntegrity.checked_count, secondAudit.length);
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

test("organization evidence preserve and digest verification follow the hash main path", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const preserved = await orchestrator.preserveEvidence({
    organization_id: "org-1",
    filename: "report.pdf",
    content: { content_text: "original" }
  });

  assert.equal(preserved.status, "preserved");
  assert.equal(preserved.sha256, sha256Hex(Buffer.from("original")));
  assert.equal(preserved.asset.organization_id, "org-1");
  assert.equal(preserved.proof_id, "prv_001");

  const found = await orchestrator.verifyEvidence({
    organization_id: "org-1",
    content: { content_text: "original" }
  });
  assert.equal(found.result, "preserved");
  assert.equal(found.matched, true);
  assert.equal(found.matches.length, 1);
  assert.equal(found.matches[0].proof_id, preserved.proof_id);

  const missing = await orchestrator.verifyEvidence({
    organization_id: "org-1",
    content: { content_text: "changed" }
  });
  assert.equal(missing.result, "not_preserved");
  assert.equal(missing.matched, false);

  const mismatch = await orchestrator.verifyEvidence({
    organization_id: "org-1",
    proof_id: preserved.proof_id,
    content: { content_text: "changed" }
  });
  assert.equal(mismatch.result, "mismatch");
  assert.equal(mismatch.proof.failure_reason, "digest_mismatch");
});

test("organization evidence preserve accepts explicit sha256 without file content", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));
  const digest = sha256Hex(Buffer.from("precomputed"));

  const preserved = await orchestrator.preserveEvidence({
    organization_id: "org-1",
    filename: "report.pdf",
    sha256: digest
  });

  assert.equal(preserved.sha256, digest);
  assert.equal(preserved.version.size, null);
});

test("organization evidence validation rejects missing and malformed digest input", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  await assert.rejects(
    () =>
      orchestrator.preserveEvidence({
        organization_id: "org-1",
        filename: "report.pdf"
      }),
    {
      code: "invalid_request",
      statusCode: 400
    }
  );

  await assert.rejects(
    () =>
      orchestrator.verifyEvidence({
        organization_id: "org-1",
        sha256: "not-a-digest"
      }),
    {
      code: "invalid_sha256",
      statusCode: 400
    }
  );
});

test("organization evidence verification maps proof states to user-facing results", async (t) => {
  const { orchestrator, storageDir } = await createTestOrchestrator();
  t.after(() => rm(storageDir, { recursive: true, force: true }));

  const preserved = await orchestrator.preserveEvidence({
    organization_id: "org-1",
    filename: "report.pdf",
    content: { content_text: "original" }
  });

  const pending = await orchestrator.verifyEvidence({
    organization_id: "org-1",
    proof_id: preserved.proof_id,
    content: { content_text: "original" },
    scenario: "proof_missing"
  });
  assert.equal(pending.result, "pending");

  const unavailable = await orchestrator.verifyEvidence({
    organization_id: "org-1",
    proof_id: preserved.proof_id,
    content: { content_text: "original" },
    scenario: "chain_unavailable"
  });
  assert.equal(unavailable.result, "proof_unavailable");
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
