import { toContentBuffer, sha256Hex } from "./digest.js";
import { ChronofactError } from "./errors.js";

export function createChronofactOrchestrator({ store, clients }) {
  async function submit({ filename, asset_type = "lab_report", content, scenario } = {}) {
    return createVersion({
      filename,
      asset_type,
      content,
      scenario
    });
  }

  async function createVersion({ asset_id, filename, asset_type = "lab_report", content, scenario } = {}) {
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

    return {
      asset_version: assetVersion,
      verification_result: verificationResult,
      ...ai
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
    submit,
    createVersion,
    verify,
    describeAsset: (assetId) => store.describeAsset(assetId)
  };
}
