import { ChronofactError } from "../errors.js";

export function normalizeBaseUrl(baseUrl, label) {
  const normalized = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new Error(`${label} baseUrl is required`);
  }
  return normalized;
}

export async function fetchJson({
  url,
  fetchImpl = globalThis.fetch,
  timeoutMs = 3000,
  method = "GET",
  headers,
  body,
  unavailableCode,
  unavailableMessage,
  responseErrorCode = unavailableCode,
  responseErrorStatus = 502
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });
    const payload = await readResponsePayload(response);

    if (!response.ok) {
      const message = problemMessage(payload) ?? `${unavailableMessage} HTTP ${response.status}.`;
      throw new ChronofactError(responseErrorCode, message, responseErrorStatus);
    }

    return payload;
  } catch (error) {
    if (error instanceof ChronofactError) {
      throw error;
    }

    throw new ChronofactError(
      unavailableCode,
      `${unavailableMessage}: ${error.message}`,
      responseErrorStatus
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponsePayload(response) {
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

function problemMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (typeof payload.detail === "string" && payload.detail) {
    return payload.detail;
  }
  if (typeof payload.error === "string" && payload.error) {
    return payload.error;
  }
  if (payload.error && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return null;
}

