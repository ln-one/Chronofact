import { fileToText, requestJson } from "./backendClient";
import { withEvidenceBasis } from "./evidence";
import { scenarioToVerificationScenario } from "./scenarioMapping";
import { normalizeScenario, pickAssetDetail } from "./scenarioNormalizer";

export function createLiveScenarioSession({ getFallbackScenario }) {
  let liveScenarioKey = null;
  let liveScenarioData = null;
  let liveAssetId = null;
  let liveVersionId = null;
  let liveSubmittedContentText = null;

  return {
    getScenario(key) {
      if (liveScenarioKey === key && liveScenarioData) {
        return liveScenarioData;
      }
      return getFallbackScenario(key);
    },

    async submitUpload(file, scenarioKey) {
      const fallback = getFallbackScenario(scenarioKey);
      liveScenarioKey = scenarioKey;
      liveScenarioData = null;
      liveAssetId = null;
      liveVersionId = null;
      liveSubmittedContentText = await fileToText(file);

      try {
        const response = await submitScenarioUpload({ file, scenarioKey, fallback, contentText: liveSubmittedContentText });
        liveSubmittedContentText = response.contentText;
        liveAssetId = response.assetId;
        liveVersionId = response.versionId;
        liveScenarioData = response.scenarioData;
      } catch (error) {
        liveScenarioData = normalizeErrorFallback({ fallback, error });
      }

      return {
        upload_record: liveScenarioData.upload_record,
        asset_version: liveScenarioData.asset_version,
        scenarioData: liveScenarioData,
      };
    },

    async getAssetDetail(scenarioKey) {
      if (!liveAssetId || liveScenarioKey !== scenarioKey) {
        return null;
      }

      const detail = await requestJson(`/assets/${liveAssetId}`);
      liveScenarioData = normalizeScenario({
        fallback: getFallbackScenario(scenarioKey),
        base: liveScenarioData,
        detail,
      });
      return {
        ...pickAssetDetail(liveScenarioData),
        scenarioData: liveScenarioData,
      };
    },

    async getVerificationResult(scenarioKey) {
      if (!liveVersionId || liveScenarioKey !== scenarioKey) {
        return null;
      }

      const verifyScenario = scenarioToVerificationScenario(scenarioKey);
      const content_text =
        scenarioKey === "tamperedFile"
          ? `${liveSubmittedContentText || "chronofact"} tampered`
          : liveSubmittedContentText;
      const verified = await requestJson("/verify", {
        method: "POST",
        body: {
          version_id: liveVersionId,
          content_text,
          ...(verifyScenario ? { scenario: verifyScenario } : {}),
        },
      });

      liveScenarioData = normalizeScenario({
        fallback: getFallbackScenario(scenarioKey),
        base: liveScenarioData,
        response: verified,
      });
      return {
        verification_result: liveScenarioData.verification_result,
        proof: liveScenarioData.proof,
        scenarioData: liveScenarioData,
      };
    },

    getAiExplanation(scenarioKey) {
      if (liveScenarioKey !== scenarioKey || !liveScenarioData) {
        return null;
      }
      return {
        ...withEvidenceBasis(liveScenarioData),
        scenarioData: liveScenarioData,
      };
    },
  };
}

async function submitScenarioUpload({ file, scenarioKey, fallback, contentText }) {
  if (scenarioKey === "multiVersion") {
    return submitMultiVersionUpload({ file, fallback, contentText });
  }

  const response = await requestJson("/assets", {
    method: "POST",
    body: {
      filename: file?.name || fallback.upload_record.filename,
      asset_type: fallback.asset_version.asset_type,
      content_text: contentText,
      ...(scenarioKey === "uploadFailed" ? { scenario: "upload_failed" } : {}),
    },
  });

  return {
    contentText,
    assetId: response.asset_version.asset_id,
    versionId: response.asset_version.version_id,
    scenarioData: normalizeScenario({ fallback, response }),
  };
}

async function submitMultiVersionUpload({ file, fallback, contentText }) {
  const first = await requestJson("/assets", {
    method: "POST",
    body: {
      filename: `${stripExtension(file?.name || "report.txt")}-v1.txt`,
      asset_type: fallback.asset_version.asset_type,
      content_text: `${contentText}\nversion 1`,
    },
  });
  const secondContent = `${contentText}\nversion 2`;
  const second = await requestJson(`/assets/${first.asset_version.asset_id}/versions`, {
    method: "POST",
    body: {
      filename: file?.name || fallback.upload_record.filename,
      content_text: secondContent,
    },
  });
  const detail = await requestJson(`/assets/${second.asset_version.asset_id}`);

  return {
    contentText: secondContent,
    assetId: second.asset_version.asset_id,
    versionId: second.asset_version.version_id,
    scenarioData: normalizeScenario({ fallback, response: second, detail }),
  };
}

function normalizeErrorFallback({ fallback, error }) {
  return {
    ...fallback,
    verification_result: {
      ...fallback.verification_result,
      failure_reason: error.code || fallback.verification_result.failure_reason,
    },
    ai_explanation: {
      ...fallback.ai_explanation,
      summary: error.message || fallback.ai_explanation.summary,
    },
  };
}

function stripExtension(filename) {
  return filename.replace(/\.[^.]+$/, "");
}
