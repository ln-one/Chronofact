import { withEvidenceBasis } from "./evidence";

export function normalizeScenario({ fallback, base, response, detail }) {
  const source = response || base || {};
  const assetVersion = response?.asset_version || base?.asset_version || fallback.asset_version;
  const verification = response?.verification_result || base?.verification_result || fallback.verification_result;
  const upload = response?.upload_record || base?.upload_record || fallback.upload_record;
  const identity = response?.identity_context || base?.identity_context || fallback.identity_context;
  const witness = response?.witness_record || assetVersion?.witness_record || {};
  const timelineVersions = detail?.versions || base?.versions || [assetVersion];
  const timestamp = witness.recorded_at || assetVersion.created_at || fallback.proof.timestamp;
  const aiExplanation = response?.ai_explanation || base?.ai_explanation || fallback.ai_explanation;
  const aiError = response?.ai_explanation_error;

  return {
    ...fallback,
    identity_context: identity,
    upload_record: upload,
    asset_version: {
      ...fallback.asset_version,
      ...assetVersion,
      timestamp,
    },
    verification_result: verification,
    proof: normalizeProof({ assetVersion, witness, fallback, timestamp }),
    ai_explanation: normalizeAiExplanation({ fallback, assetVersion, verification, witness, timestamp, aiError, aiExplanation }),
    timeline: timelineVersions.map((version) => ({
      version: `v${version.version_no}`,
      digest: shortenDigest(version.sha256),
      status: version.version_id === assetVersion.version_id ? verification.status : "verified",
      time: version.created_at || timestamp,
      previous_version_id: version.previous_version_id || "无",
    })),
    raw_backend_response: source,
  };
}

export function pickAssetDetail(scenario) {
  return {
    identity_context: scenario.identity_context,
    upload_record: scenario.upload_record,
    asset_version: scenario.asset_version,
    verification_result: scenario.verification_result,
    proof: scenario.proof,
    ai_explanation: withEvidenceBasis(scenario),
    timeline: scenario.timeline,
  };
}

function normalizeProof({ assetVersion, witness, fallback, timestamp }) {
  return {
    receipt_id: assetVersion.receipt_id || witness.receipt_id || fallback.proof.receipt_id,
    trace_id: assetVersion.fact_id || fallback.proof.trace_id,
    transaction_hash: witness.tx_hash || fallback.proof.transaction_hash,
    timestamp,
  };
}

function normalizeAiExplanation({ fallback, assetVersion, verification, witness, timestamp, aiError, aiExplanation }) {
  return withEvidenceBasis(
    {
      ...fallback,
      asset_version: {
        ...fallback.asset_version,
        ...assetVersion,
      },
      verification_result: verification,
      proof: normalizeProof({ assetVersion, witness, fallback, timestamp }),
    },
    aiError
      ? {
          summary: aiError.message,
          risks: ["AI explanation is unavailable; structured verification remains the proof source."],
          next_checks: ["Review receipt, trace, digest, and verification result manually."],
          confidence_note: "AI 解释不可用时，证明来源仍然是结构化回执与验证结果。",
        }
      : aiExplanation,
  );
}

function shortenDigest(digest = "") {
  if (digest.length <= 12) {
    return digest || "unknown";
  }
  return `${digest.slice(0, 4)}...${digest.slice(-4)}`;
}
