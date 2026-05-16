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

  async function explainSafely({ verificationResult, assetVersion, scenario }) {
    try {
      return {
        ai_explanation: await clients.ai.explain({
          verificationResult,
          assetVersion,
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
    listWorkspaces: (filters) => store.listWorkspaces(filters),
    describeWorkspace: (workspaceId) => store.describeWorkspace(workspaceId),
    submit,
    createVersion,
    verify,
    listAssets: (filters) => store.listAssets(filters),
    exportWorkspaceReport,
    describeAsset: (assetId) => store.describeAsset(assetId)
  };
}
