import { toContentBuffer, sha256Hex } from "./digest.js";
import { ChronofactError } from "./errors.js";
import { assertChronofactAdapters } from "./adapters/contracts.js";

export function createChronofactOrchestrator({ store, clients }) {
  clients = assertChronofactAdapters(clients);

  async function createWorkspace({
    title,
    workspace_type = "experiment",
    description = "",
    status = "active",
    scenario
  } = {}) {
    if (!title) {
      throw new ChronofactError("invalid_request", "title is required.", 400);
    }

    const identityContext = await clients.limora.resolveIdentity({ scenario });
    const workspace = store.createWorkspace({
      title,
      workspaceType: workspace_type,
      description,
      status,
      ownerId: identityContext.user_id
    });

    return {
      identity_context: identityContext,
      workspace
    };
  }

  async function updateWorkspaceStatus({ workspace_id, status, scenario } = {}) {
    if (!workspace_id) {
      throw new ChronofactError("invalid_request", "workspace_id is required.", 400);
    }
    if (!status) {
      throw new ChronofactError("invalid_request", "status is required.", 400);
    }

    const identityContext = await clients.limora.resolveIdentity({ scenario });
    const workspace = store.updateWorkspaceStatus({
      workspaceId: workspace_id,
      status,
      actorId: identityContext.user_id
    });

    return {
      identity_context: identityContext,
      workspace
    };
  }

  async function submit({
    workspace_id,
    asset_title,
    filename,
    asset_type = "lab_report",
    content,
    scenario
  } = {}) {
    return createVersion({
      workspace_id,
      asset_title,
      filename,
      asset_type,
      content,
      scenario
    });
  }

  async function createVersion({
    workspace_id,
    asset_id,
    asset_title,
    filename,
    asset_type = "lab_report",
    content,
    scenario
  } = {}) {
    if (!filename) {
      throw new ChronofactError("invalid_request", "filename is required.", 400);
    }

    const contentBuffer = toContentBuffer(content);
    const sha256 = sha256Hex(contentBuffer);
    const identityContext = await clients.limora.resolveIdentity({ scenario });
    const uploadId = store.allocateUploadId();
    const uploadRecord = await clients.dualweave.storeUpload({
      uploadId,
      filename,
      content: contentBuffer,
      sha256,
      scenario
    });
    store.saveUpload(uploadRecord);

    const assetVersion = store.createVersion({
      assetId: asset_id,
      assetType: asset_type,
      workspaceId: workspace_id,
      assetTitle: asset_title,
      uploadRecord,
      sha256,
      submitterId: identityContext.user_id
    });

    const witnessRecord = await clients.chronestia.registerVersion({
      assetVersion,
      previousFactId: assetVersion.previous_fact_id,
      scenario
    });
    const witnessedVersion = store.attachWitness(assetVersion.version_id, witnessRecord);
    const verificationResult = await clients.chronestia.verifyVersion({
      assetVersion: witnessedVersion,
      scenario
    });
    const preservationRecord = store.createPreservationRecord({
      assetVersion: witnessedVersion,
      witnessRecord,
      verificationResult
    });
    const ai = await explainSafely({
      verificationResult,
      assetVersion: witnessedVersion,
      versionHistory: store.listVersions(witnessedVersion.asset_id),
      scenario
    });

    return {
      identity_context: identityContext,
      upload_record: uploadRecord,
      asset_version: witnessedVersion,
      witness_record: witnessRecord,
      preservation_record: preservationRecord,
      verification_result: verificationResult,
      ...ai
    };
  }

  async function verify({ asset_id, version_id, content, scenario } = {}) {
    if (!asset_id && !version_id) {
      throw new ChronofactError("invalid_request", "asset_id or version_id is required.", 400);
    }

    const assetVersion = version_id
      ? store.requireVersion(version_id)
      : store.latestVersion(asset_id);

    if (!assetVersion) {
      throw new ChronofactError("version_not_found", "No version exists for the requested asset.", 404);
    }

    let digestMatch = true;
    let submittedSha256 = assetVersion.sha256;
    if (content !== undefined) {
      submittedSha256 = sha256Hex(toContentBuffer(content));
      digestMatch = submittedSha256 === assetVersion.sha256;
    }

    let verificationResult;
    if (!digestMatch) {
      verificationResult = {
        status: "failed",
        digest_match: false,
        receipt_status: assetVersion.receipt_id ? "available" : "missing",
        trace_status: assetVersion.fact_id ? "available" : "missing",
        failure_reason: "digest_mismatch",
        submitted_sha256: submittedSha256,
        recorded_sha256: assetVersion.sha256
      };
    } else {
      verificationResult = await clients.chronestia.verifyVersion({
        assetVersion,
        scenario
      });
    }

    const ai = await explainSafely({
      verificationResult,
      assetVersion,
      versionHistory: store.listVersions(assetVersion.asset_id),
      scenario
    });
    store.appendAudit({
      workspaceId: store.requireAsset(assetVersion.asset_id).workspace_id,
      assetId: assetVersion.asset_id,
      versionId: assetVersion.version_id,
      actorId: assetVersion.submitter_id,
      action: "asset_version_verified",
      target_type: "asset_version",
      target_id: assetVersion.version_id,
      summary: `Version ${assetVersion.version_no} verification finished with status ${verificationResult.status}.`
    });

    return {
      asset_version: assetVersion,
      verification_result: verificationResult,
      ...ai
    };
  }

  async function explainFact({ asset_id, version_id, scenario } = {}) {
    const assetVersion = resolveVersion({ asset_id, version_id });
    const verificationResult = await clients.chronestia.verifyVersion({
      assetVersion,
      scenario
    });
    const ai = await explainSafely({
      verificationResult,
      assetVersion,
      versionHistory: store.listVersions(assetVersion.asset_id),
      scenario
    });

    return {
      explanation_type: "fact",
      asset_version: assetVersion,
      verification_result: verificationResult,
      ...ai
    };
  }

  async function explainTrace({ asset_id, scenario } = {}) {
    if (!asset_id) {
      throw new ChronofactError("invalid_request", "asset_id is required.", 400);
    }

    const asset = store.describeAsset(asset_id);
    const latestVersion = asset.versions.at(-1);
    if (!latestVersion) {
      throw new ChronofactError("version_not_found", "No version exists for the requested asset.", 404);
    }

    const verificationResult = await clients.chronestia.verifyVersion({
      assetVersion: latestVersion,
      scenario
    });
    const versionHistory = asset.versions.map((version) => ({
      version_id: version.version_id,
      version_no: version.version_no,
      previous_version_id: version.previous_version_id,
      sha256: version.sha256,
      fact_id: version.fact_id,
      receipt_id: version.receipt_id,
      created_at: version.created_at
    }));
    const ai = await explainSafely({
      verificationResult,
      assetVersion: latestVersion,
      versionHistory,
      scenario
    });

    return {
      explanation_type: "trace",
      trace: {
        asset_id,
        version_count: versionHistory.length,
        latest_version_id: latestVersion.version_id,
        versions: versionHistory
      },
      verification_result: verificationResult,
      ...ai
    };
  }

  async function explainRisk({ asset_id, version_id, scenario } = {}) {
    const factExplanation = await explainFact({ asset_id, version_id, scenario });
    const verification = factExplanation.verification_result;
    const severityByStatus = {
      verified: "low",
      pending: "medium",
      unsupported: "medium",
      failed: "high"
    };

    return {
      explanation_type: "risk",
      risk_summary: {
        status: verification.status,
        severity: severityByStatus[verification.status] ?? "unknown",
        failure_reason: verification.failure_reason,
        digest_match: verification.digest_match,
        requires_manual_review: verification.status !== "verified"
      },
      asset_version: factExplanation.asset_version,
      verification_result: verification,
      ai_explanation: factExplanation.ai_explanation,
      ...(factExplanation.ai_explanation_error
        ? { ai_explanation_error: factExplanation.ai_explanation_error }
        : {})
    };
  }

  async function createReview({ version_id, decision, summary = "", notes = "", next_checks = [], scenario } = {}) {
    if (!version_id) {
      throw new ChronofactError("invalid_request", "version_id is required.", 400);
    }
    const allowedDecisions = new Set(["approved", "needs_revision", "rejected", "pending"]);
    if (!allowedDecisions.has(decision)) {
      throw new ChronofactError(
        "invalid_review_decision",
        "decision must be one of approved, needs_revision, rejected, or pending.",
        400
      );
    }

    const identityContext = await clients.limora.resolveIdentity({ scenario });
    const reviewRecord = store.createReviewRecord({
      versionId: version_id,
      reviewerId: identityContext.user_id,
      decision,
      summary,
      notes,
      nextChecks: next_checks
    });

    return {
      identity_context: identityContext,
      review_record: reviewRecord,
      evidence: store.describeEvidence({ versionId: version_id })
    };
  }

  function resolveVersion({ asset_id, version_id } = {}) {
    if (!asset_id && !version_id) {
      throw new ChronofactError("invalid_request", "asset_id or version_id is required.", 400);
    }

    const assetVersion = version_id
      ? store.requireVersion(version_id)
      : store.latestVersion(asset_id);

    if (!assetVersion) {
      throw new ChronofactError("version_not_found", "No version exists for the requested asset.", 404);
    }

    return assetVersion;
  }

  function exportWorkspaceReport(workspaceId) {
    const workspace = store.describeWorkspace(workspaceId);
    const lines = [
      `# ${workspace.title}`,
      "",
      `- Workspace ID: ${workspace.workspace_id}`,
      `- Type: ${workspace.workspace_type}`,
      `- Status: ${workspace.status}`,
      `- Assets: ${workspace.assets.length}`,
      "",
      "## Assets"
    ];

    if (workspace.assets.length === 0) {
      lines.push("", "No assets have been submitted yet.");
    }

    for (const asset of workspace.assets) {
      const latest = asset.latest_version;
      lines.push(
        "",
        `### ${asset.title ?? asset.asset_id}`,
        "",
        `- Asset ID: ${asset.asset_id}`,
        `- Type: ${asset.asset_type}`,
        `- Latest version: ${latest?.version_no ?? "none"}`,
        `- Latest digest: ${latest?.sha256 ?? "none"}`,
        `- Verification: ${latest?.preservation_record?.verification_status ?? "not_verified"}`
      );
    }

    lines.push(
      "",
      "## Audit Timeline",
      "",
      ...workspace.audit_log.map((entry) => `- ${entry.created_at} ${entry.action}: ${entry.summary}`)
    );

    return {
      workspace,
      report: {
        format: "markdown",
        generated_at: new Date().toISOString(),
        content: lines.join("\n")
      }
    };
  }

  function listEvidence(filters = {}) {
    return {
      evidence: store.listPreservationRecords(filters).map((record) => ({
        ...record,
        asset: store.getAsset(record.asset_id),
        asset_version: store.getVersion(record.version_id)
      }))
    };
  }

  function describeEvidence({ version_id, preservation_id } = {}) {
    if (!version_id && !preservation_id) {
      throw new ChronofactError("invalid_request", "version_id or preservation_id is required.", 400);
    }

    const evidence = store.describeEvidence({
      versionId: version_id,
      preservationId: preservation_id
    });

    return {
      evidence
    };
  }

  async function exportVersionReport({ version_id, scenario } = {}) {
    if (!version_id) {
      throw new ChronofactError("invalid_request", "version_id is required.", 400);
    }

    const { evidence } = describeEvidence({ version_id });
    const verificationResult = await clients.chronestia.verifyVersion({
      assetVersion: evidence.asset_version,
      scenario
    });
    const ai = await explainSafely({
      verificationResult,
      assetVersion: evidence.asset_version,
      versionHistory: store.listVersions(evidence.asset.asset_id),
      scenario
    });

    const lines = [
      `# Verification Report: ${evidence.asset.title ?? evidence.asset.asset_id} v${evidence.asset_version.version_no}`,
      "",
      "## Asset",
      "",
      `- Asset ID: ${evidence.asset.asset_id}`,
      `- Workspace ID: ${evidence.asset.workspace_id ?? "none"}`,
      `- Asset type: ${evidence.asset.asset_type}`,
      `- Version ID: ${evidence.asset_version.version_id}`,
      `- Version number: ${evidence.asset_version.version_no}`,
      `- Previous version ID: ${evidence.asset_version.previous_version_id ?? "none"}`,
      "",
      "## Evidence",
      "",
      `- Digest algorithm: ${evidence.preservation_record.digest_algorithm}`,
      `- Digest: ${evidence.preservation_record.digest}`,
      `- Storage ref: ${evidence.preservation_record.storage_ref}`,
      `- Fact ID: ${evidence.preservation_record.fact_id}`,
      `- Receipt ID: ${evidence.preservation_record.receipt_id}`,
      `- Anchor status: ${evidence.preservation_record.anchor_status}`,
      "",
      "## Verification",
      "",
      `- Status: ${verificationResult.status}`,
      `- Digest match: ${verificationResult.digest_match}`,
      `- Receipt status: ${verificationResult.receipt_status}`,
      `- Trace status: ${verificationResult.trace_status}`,
      `- Failure reason: ${verificationResult.failure_reason ?? "none"}`,
      "",
      "## AI Explanation",
      "",
      ai.ai_explanation
        ? ai.ai_explanation.summary
        : `AI explanation unavailable: ${ai.ai_explanation_error?.message ?? "unknown"}`,
      "",
      "## Manual Review",
      "",
      latestReviewLine(evidence.review_records),
      "",
      "## Next Checks",
      "",
      ...(ai.ai_explanation?.next_checks ?? ["Review the structured evidence manually."]).map((check) => `- ${check}`)
    ];

    return {
      evidence,
      verification_result: verificationResult,
      ...ai,
      report: {
        format: "markdown",
        generated_at: new Date().toISOString(),
        content: lines.join("\n")
      }
    };
  }

  function latestReviewLine(reviewRecords = []) {
    const latestReview = reviewRecords.at(-1);
    if (!latestReview) {
      return "No manual review has been recorded yet.";
    }

    return [
      `- Decision: ${latestReview.decision}`,
      `- Reviewer: ${latestReview.reviewer_id}`,
      `- Summary: ${latestReview.summary || "none"}`,
      `- Notes: ${latestReview.notes || "none"}`
    ].join("\n");
  }

  async function explainSafely({ verificationResult, assetVersion, versionHistory = [], scenario }) {
    try {
      return {
        ai_explanation: await clients.ai.explain({
          verificationResult,
          assetVersion,
          versionHistory,
          scenario
        })
      };
    } catch (error) {
      if (error instanceof ChronofactError && error.code === "ai_explanation_unavailable") {
        return {
          ai_explanation: null,
          ai_explanation_error: {
            status: "unavailable",
            failure_reason: "ai_explanation_unavailable",
            message: error.message
          }
        };
      }
      throw error;
    }
  }

  return {
    createWorkspace,
    updateWorkspaceStatus,
    listWorkspaces: (filters) => store.listWorkspaces(filters),
    describeWorkspace: (workspaceId) => store.describeWorkspace(workspaceId),
    submit,
    createVersion,
    verify,
    listAssets: (filters) => store.listAssets(filters),
    exportWorkspaceReport,
    listEvidence,
    describeEvidence,
    exportVersionReport,
    createReview,
    listReviews: (filters) => ({ reviews: store.listReviewRecords(filters) }),
    listAuditLog: (filters) => ({ audit_log: store.listAuditLogs(filters) }),
    explainFact,
    explainTrace,
    explainRisk,
    describeAsset: (assetId) => store.describeAsset(assetId)
  };
}
