import { apiBaseUrl, isLiveApiEnabled } from "./chronofactMock/backendClient";
import { withEvidenceBasis } from "./chronofactMock/evidence";
import { createLiveScenarioSession } from "./chronofactMock/liveScenarioSession";
import { getFallbackScenario, scenarios } from "./chronofactMock/scenarios";
import { pickAssetDetail } from "./chronofactMock/scenarioNormalizer";

const liveSession = createLiveScenarioSession({ getFallbackScenario });

export { isLiveApiEnabled };

export function listScenarios() {
  return Object.entries(scenarios).map(([key, value]) => ({
    key,
    label: value.label,
    status: value.verification_result.status,
    failure_reason: value.verification_result.failure_reason,
  }));
}

export function getScenario(key) {
  if (apiBaseUrl) {
    return liveSession.getScenario(key);
  }
  return getFallbackScenario(key);
}

export async function submitUpload(file, scenarioKey) {
  if (apiBaseUrl) {
    return liveSession.submitUpload(file, scenarioKey);
  }

  const scenario = getFallbackScenario(scenarioKey);
  return {
    upload_record: {
      ...scenario.upload_record,
      filename: file?.name || scenario.upload_record.filename,
      size: file?.size || null,
    },
    asset_version: scenario.asset_version,
  };
}

export async function getAssetDetail(scenarioKey) {
  if (apiBaseUrl) {
    const liveDetail = await liveSession.getAssetDetail(scenarioKey);
    if (liveDetail) {
      return liveDetail;
    }
  }

  return pickAssetDetail(getFallbackScenario(scenarioKey));
}

export async function getVerificationResult(scenarioKey) {
  if (apiBaseUrl) {
    const liveVerification = await liveSession.getVerificationResult(scenarioKey);
    if (liveVerification) {
      return liveVerification;
    }
  }

  const scenario = getFallbackScenario(scenarioKey);
  return {
    verification_result: scenario.verification_result,
    proof: scenario.proof,
  };
}

export async function getAiExplanation(scenarioKey) {
  if (apiBaseUrl) {
    const liveExplanation = liveSession.getAiExplanation(scenarioKey);
    if (liveExplanation) {
      return liveExplanation;
    }
  }

  return withEvidenceBasis(getFallbackScenario(scenarioKey));
}
