import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ChronofactError } from "../errors.js";
import { MOCK_CONTRACT } from "../mockContract.js";

function cleanFilename(filename) {
  return String(filename || "upload.bin").replace(/[^\w.\-]+/g, "_");
}

export function createDemoLimoraAdapter() {
  return {
    async resolveIdentity({ scenario } = {}) {
      if (scenario === "identity_unavailable") {
        throw new ChronofactError(
          "identity_unavailable",
          "Demo identity context is unavailable.",
          503
        );
      }

      return { ...MOCK_CONTRACT.identity_context };
    }
  };
}

export function createDualweaveMockAdapter({ storageDir }) {
  return {
    async storeUpload({ uploadId, filename, content, sha256, scenario }) {
      if (scenario === "upload_failed") {
        throw new ChronofactError(
          "upload_failed",
          "Dualweave mock upload failed before off-chain storage completed.",
          502
        );
      }

      await mkdir(storageDir, { recursive: true });
      const storedName = `${uploadId}-${cleanFilename(filename)}`;
      await writeFile(join(storageDir, storedName), content);

      return {
        upload_id: uploadId,
        storage_ref: `dualweave://${uploadId}`,
        filename,
        sha256,
        status: "stored"
      };
    }
  };
}

export function createChronestiaMockAdapter({ clock = () => new Date() } = {}) {
  return {
    async registerVersion({ assetVersion, previousFactId, scenario }) {
      if (scenario === "chain_unavailable") {
        throw new ChronofactError(
          "chain_unavailable",
          "Chronestia mock chain adapter is unavailable.",
          503
        );
      }

      const factId = `fact_${assetVersion.version_id}`;
      return {
        fact_id: factId,
        receipt_id: `rcpt_${assetVersion.version_id}`,
        anchor_status: "recorded",
        tx_hash: `0xmock${assetVersion.version_id.replace(/[^\da-z]/gi, "").padEnd(8, "0")}`,
        recorded_at: clock().toISOString(),
        previous_fact_id: previousFactId ?? null
      };
    },

    async verifyVersion({ assetVersion, scenario }) {
      if (scenario === "chain_unavailable") {
        return {
          status: "unsupported",
          digest_match: true,
          receipt_status: "unknown",
          trace_status: "unknown",
          failure_reason: "chain_unavailable"
        };
      }

      if (scenario === "proof_missing" || !assetVersion.receipt_id) {
        return {
          status: "pending",
          digest_match: true,
          receipt_status: "missing",
          trace_status: "missing",
          failure_reason: "proof_missing"
        };
      }

      return {
        status: "verified",
        digest_match: true,
        receipt_status: "available",
        trace_status: "available",
        failure_reason: null
      };
    }
  };
}

export function createAiExplanationMockAdapter() {
  return {
    async explain({ verificationResult, assetVersion, versionHistory = [], scenario }) {
      if (scenario === "ai_unavailable") {
        throw new ChronofactError(
          "ai_explanation_unavailable",
          "AI explanation mock service is unavailable.",
          503
        );
      }

      const basis = [
        "sha256 digest",
        "asset version record",
        "receipt status",
        "trace status",
        "verification result"
      ];
      if (versionHistory.length > 0) {
        basis.push("version history");
      }

      const versionContext = versionHistory.length > 1
        ? ` The asset has ${versionHistory.length} linked versions in its trace.`
        : "";

      if (verificationResult.failure_reason === "digest_mismatch") {
        return {
          summary: `Version ${assetVersion.version_no} digest does not match the recorded value.${versionContext}`,
          risks: ["The submitted file may have been modified after registration."],
          next_checks: ["Ask a reviewer to compare the file with the originally submitted artifact."],
          confidence_note: "AI explanation is not proof; proof comes from structured receipts and verification results.",
          evidence_basis: basis
        };
      }

      if (verificationResult.failure_reason === "proof_missing") {
        return {
          summary: `Version ${assetVersion.version_no} has no available proof yet.${versionContext}`,
          risks: ["The record cannot be treated as fully witnessed until proof is available."],
          next_checks: ["Retry verification after the witness service returns a receipt or trace."],
          confidence_note: "AI explanation is not proof; proof comes from structured receipts and verification results.",
          evidence_basis: basis
        };
      }

      if (verificationResult.failure_reason === "chain_unavailable") {
        return {
          summary: `Version ${assetVersion.version_no} cannot be verified because the chain adapter is unavailable.${versionContext}`,
          risks: ["The current result is an access failure, not a successful notarization."],
          next_checks: ["Check the chain or Chronestia adapter and retry verification."],
          confidence_note: "AI explanation is not proof; proof comes from structured receipts and verification results.",
          evidence_basis: basis
        };
      }

      return {
        summary: `Version ${assetVersion.version_no} is registered and the current digest matches the recorded value.${versionContext}`,
        risks: [],
        next_checks: ["A human reviewer should still check whether the file content satisfies submission requirements."],
        confidence_note: "AI explanation is not proof; proof comes from structured receipts and verification results.",
        evidence_basis: basis
      };
    }
  };
}
