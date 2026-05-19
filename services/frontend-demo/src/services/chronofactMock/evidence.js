export function createEvidenceBasis(scenario) {
  const factId =
    scenario.asset_version.fact_id ||
    scenario.asset_version.version_id ||
    scenario.proof.trace_id ||
    `${scenario.asset_version.asset_id}:v${scenario.asset_version.version_no}`;
  const subjectId = scenario.asset_version.asset_id || "subject_uncreated";
  const anchorStatus =
    scenario.verification_result.receipt_status === "available"
      ? "anchored"
      : scenario.verification_result.receipt_status || "unknown";

  return {
    fact_id: factId,
    subject_id: subjectId,
    receipt_provider: scenario.proof.receipt_id === "unavailable" ? "unavailable" : "chronestia",
    anchor_status: anchorStatus,
    verification_status: scenario.verification_result.status,
    sources: ["sha256 digest", "receipt", "trace", "verification result"],
  };
}

export function withEvidenceBasis(scenario, aiExplanation = scenario.ai_explanation) {
  return {
    ...aiExplanation,
    evidence_basis: aiExplanation.evidence_basis || createEvidenceBasis(scenario),
  };
}
