import { ChronofactError } from "../errors.js";
import { normalizeBaseUrl } from "./http.js";

export function createDualweaveHttpAdapter({
  baseUrl,
  execution,
  fetchImpl = globalThis.fetch,
  timeoutMs = 30000
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, "Dualweave HTTP adapter");
  const executionSnapshot = normalizeExecution(execution);

  return {
    async storeUpload({ uploadId, filename, content, sha256, scenario }) {
      if (scenario === "upload_failed") {
        throw new ChronofactError(
          "upload_failed",
          "Dualweave HTTP adapter is intentionally unavailable for this scenario.",
          502
        );
      }

      const form = new FormData();
      form.append("file", new Blob([content]), filename);
      form.append("execution", executionSnapshot);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(`${normalizedBaseUrl}/uploads`, {
          method: "POST",
          body: form,
          signal: controller.signal
        });
        const result = await readJson(response);

        if (!response.ok) {
          throw new ChronofactError(
            "upload_failed",
            uploadErrorMessage(result, response.status),
            502
          );
        }

        if (result.error) {
          throw new ChronofactError(
            "upload_failed",
            result.error.message ?? "Dualweave upload failed.",
            502
          );
        }

        if (
          result.content_hash &&
          result.content_hash_algorithm === "sha256" &&
          result.content_hash !== sha256
        ) {
          throw new ChronofactError(
            "upload_digest_mismatch",
            "Dualweave reported a content hash that does not match Chronofact's SHA-256 digest.",
            502
          );
        }

        const remoteUploadId = result.upload_id || uploadId;
        return {
          upload_id: remoteUploadId,
          requested_upload_id: uploadId,
          storage_ref: `dualweave://${remoteUploadId}`,
          filename,
          sha256,
          status: toChronofactUploadStatus(result),
          dualweave_result: result
        };
      } catch (error) {
        if (error instanceof ChronofactError) {
          throw error;
        }

        throw new ChronofactError(
          "upload_failed",
          `Dualweave HTTP upload service is unavailable: ${error.message}`,
          502
        );
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

function normalizeExecution(execution) {
  if (!execution) {
    throw new Error("Dualweave HTTP adapter requires an execution spec.");
  }

  if (typeof execution === "string") {
    JSON.parse(execution);
    return execution;
  }

  return JSON.stringify(execution);
}

async function readJson(response) {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw_body: text };
  }
}

function uploadErrorMessage(result, status) {
  if (result?.error?.message) {
    return result.error.message;
  }
  if (typeof result?.error === "string") {
    return result.error;
  }
  return `Dualweave upload service returned HTTP ${status}.`;
}

function toChronofactUploadStatus(result) {
  if (result.status === "completed") {
    return "stored";
  }
  if (result.status === "pending_remote" || result.status === "degraded") {
    return result.status;
  }
  return result.status || "stored";
}

