import { ChronofactError } from "./errors.js";

export function createAiExplanationHttpClient({
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = 3000
}) {
  if (!baseUrl) {
    throw new Error("baseUrl is required for the AI explanation HTTP client");
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    async explain({ verificationResult, assetVersion, scenario }) {
      if (scenario === "ai_unavailable") {
        throw new ChronofactError(
          "ai_explanation_unavailable",
          "AI explanation HTTP service is intentionally unavailable for this scenario.",
          503
        );
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(`${normalizedBaseUrl}/api/ai/explain`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(toEvidencePayload({ verificationResult, assetVersion })),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new ChronofactError(
            "ai_explanation_unavailable",
            `AI explanation HTTP service returned ${response.status}.`,
            503
          );
        }

        return response.json();
      } catch (error) {
        if (error instanceof ChronofactError) {
          throw error;
        }

        throw new ChronofactError(
          "ai_explanation_unavailable",
          `AI explanation HTTP service is unavailable: ${error.message}`,
          503
        );
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

function toEvidencePayload({ verificationResult, assetVersion }) {
  const witness = assetVersion.witness_record ?? {};
  return {
    asset_version: {
      asset_id: assetVersion.asset_id,
      asset_type: assetVersion.asset_type,
      version_id: assetVersion.version_id,
      version_no: assetVersion.version_no,
      previous_version_id: assetVersion.previous_version_id,
      sha256: assetVersion.sha256,
      submitter_id: assetVersion.submitter_id
    },
    receipt: {
      receipt_id: assetVersion.receipt_id,
      status: verificationResult.receipt_status,
      transaction_hash: witness.tx_hash,
      recorded_at: witness.recorded_at
    },
    trace: {
      trace_id: assetVersion.fact_id,
      status: verificationResult.trace_status,
      previous_fact_id: assetVersion.previous_fact_id
    },
    verification_result: verificationResult
  };
}
