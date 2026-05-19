import { ChronofactError } from "../errors.js";
import { fetchJson, normalizeBaseUrl } from "./http.js";

export function createChronestiaHttpAdapter({
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, "Chronestia HTTP adapter");

  return {
    async registerVersion({ assetVersion, previousFactId, scenario }) {
      if (scenario === "chain_unavailable") {
        throw new ChronofactError(
          "chain_unavailable",
          "Chronestia HTTP adapter is intentionally unavailable for this scenario.",
          503
        );
      }

      const payload = toChronestiaFactRequest({ assetVersion, previousFactId });
      const result = await fetchJson({
        url: `${normalizedBaseUrl}/facts`,
        fetchImpl,
        timeoutMs,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        unavailableCode: "chain_unavailable",
        unavailableMessage: "Chronestia HTTP service is unavailable",
        responseErrorCode: "witness_registration_failed"
      });

      return toWitnessRecord(result, previousFactId);
    },

    async verifyVersion({ assetVersion, scenario }) {
      if (scenario === "chain_unavailable") {
        return chainUnavailableResult();
      }
      if (scenario === "proof_missing" || !assetVersion.fact_id) {
        return proofMissingResult();
      }

      try {
        const result = await fetchJson({
          url: `${normalizedBaseUrl}/facts/${encodeURIComponent(assetVersion.fact_id)}/verify`,
          fetchImpl,
          timeoutMs,
          method: "POST",
          unavailableCode: "chain_unavailable",
          unavailableMessage: "Chronestia HTTP service is unavailable",
          responseErrorCode: "chain_unavailable",
          responseErrorStatus: 503
        });
        return toVerificationResult(result);
      } catch (error) {
        if (error instanceof ChronofactError && error.code === "chain_unavailable") {
          return chainUnavailableResult();
        }
        throw error;
      }
    }
  };
}

function toChronestiaFactRequest({ assetVersion, previousFactId }) {
  return {
    subject: {
      namespace: "chronofact",
      type: "experiment_asset",
      id: assetVersion.asset_id
    },
    fact: {
      kind: assetVersion.version_no === 1 ? "registered" : "revised",
      sequence: assetVersion.version_no,
      previous_fact_id: previousFactId ?? undefined,
      actor: assetVersion.submitter_id
    },
    issuer: {
      id: assetVersion.submitter_id,
      type: "demo_identity",
      display_name: "Chronofact Demo Identity"
    },
    statement_type: "chronofact.asset_version",
    evidence: {
      digest: assetVersion.sha256,
      digest_algorithm: "sha256",
      canonicalization: "chronofact-file-bytes-v1",
      external_refs: [
        {
          kind: "dualweave_upload",
          uri: assetVersion.storage_ref,
          digest: assetVersion.sha256
        }
      ]
    },
    evidence_refs: [
      {
        kind: "dualweave_upload",
        uri: assetVersion.storage_ref,
        digest: assetVersion.sha256,
        name: assetVersion.upload_id
      }
    ]
  };
}

function toWitnessRecord(result, previousFactId) {
  const receipt = result.receipt ?? {};
  const registration = result.registration ?? {};
  const fact = result.fact ?? {};

  return {
    fact_id: result.fact_id ?? fact.id,
    receipt_id: receipt.anchor_ref ?? receipt.fact_id ?? result.fact_id ?? fact.id,
    anchor_status: result.anchor_status ?? receipt.anchor_status ?? registration.status ?? "unknown",
    tx_hash: receipt.provider_payload?.tx_hash ?? receipt.anchor_ref ?? null,
    recorded_at: registration.accepted_at ?? receipt.updated_at ?? fact.created_at ?? new Date().toISOString(),
    previous_fact_id: fact.previous_fact_id ?? previousFactId ?? null,
    fact_digest: result.fact_digest ?? receipt.fact_digest ?? fact.fact_digest,
    provider: receipt.provider,
    provider_payload: receipt.provider_payload ?? {}
  };
}

function toVerificationResult(result) {
  if (result.provider_status === "unavailable" || result.provider_status === "error") {
    return chainUnavailableResult();
  }

  if (result.receipt_status === "missing") {
    return proofMissingResult();
  }

  if (result.receipt_status === "invalid" || result.inclusion_proof_status === "invalid" || result.policy_status === "rejected") {
    return {
      status: "failed",
      digest_match: true,
      receipt_status: result.receipt_status ?? "invalid",
      trace_status: result.inclusion_proof_status ?? "invalid",
      failure_reason: "proof_invalid",
      chronestia_verification: result
    };
  }

  const isVerified =
    result.receipt_status === "valid" &&
    ["valid", "unsupported", "available", "pending"].includes(result.inclusion_proof_status ?? "unsupported") &&
    ["accepted", "not_checked", undefined].includes(result.policy_status);

  return {
    status: isVerified ? "verified" : "pending",
    digest_match: true,
    receipt_status: result.receipt_status ?? "unknown",
    trace_status: result.inclusion_proof_status ?? "unknown",
    failure_reason: isVerified ? null : "proof_missing",
    chronestia_verification: result
  };
}

function proofMissingResult() {
  return {
    status: "pending",
    digest_match: true,
    receipt_status: "missing",
    trace_status: "missing",
    failure_reason: "proof_missing"
  };
}

function chainUnavailableResult() {
  return {
    status: "unsupported",
    digest_match: true,
    receipt_status: "unknown",
    trace_status: "unknown",
    failure_reason: "chain_unavailable"
  };
}

