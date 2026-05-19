export function scenarioToVerificationScenario(scenarioKey) {
  return {
    missingProof: "proof_missing",
    chainUnavailable: "chain_unavailable",
    aiExplanationUnavailable: "ai_unavailable",
  }[scenarioKey];
}
