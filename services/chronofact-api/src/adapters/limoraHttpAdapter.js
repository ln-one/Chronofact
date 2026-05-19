import { ChronofactError } from "../errors.js";
import { normalizeBaseUrl } from "./http.js";

export function createLimoraHttpAdapter({
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = 3000
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, "Limora HTTP adapter");

  return {
    async resolveIdentity({ requestHeaders } = {}) {
      const payload = await requestLimora({
        url: `${normalizedBaseUrl}/v1/sessions/current`,
        fetchImpl,
        timeoutMs,
        requestHeaders,
        unavailableCode: "identity_unavailable",
        unavailableMessage: "Limora identity service is unavailable"
      });
      return identityContextFromSession(payload);
    },

    async requirePermission({ organizationId, permission, requestHeaders } = {}) {
      if (!organizationId) {
        throw new ChronofactError("invalid_request", "organizationId is required.", 400);
      }
      if (!permission) {
        throw new ChronofactError("invalid_request", "permission is required.", 400);
      }

      const payload = await requestLimora({
        url: `${normalizedBaseUrl}/v1/organizations/${encodeURIComponent(organizationId)}/permissions/check`,
        fetchImpl,
        timeoutMs,
        method: "POST",
        requestHeaders,
        body: JSON.stringify({ permissions: [permission] }),
        unavailableCode: "permission_provider_unavailable",
        unavailableMessage: "Limora permission service is unavailable"
      });
      const check = payload.data?.permissionCheck ?? payload.permissionCheck ?? {};
      if (!check.allowed) {
        throw new ChronofactError(
          "permission_denied",
          "Current identity does not have the required Chronofact permission.",
          403,
          {
            permission,
            missing_permissions: check.missingPermissions ?? [permission]
          }
        );
      }
      return check;
    }
  };
}

async function requestLimora({
  url,
  fetchImpl,
  timeoutMs,
  method = "GET",
  requestHeaders = {},
  body,
  unavailableCode,
  unavailableMessage
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method,
      headers: forwardedHeaders(requestHeaders, body !== undefined),
      body,
      signal: controller.signal
    });
    const payload = await readPayload(response);

    if (!response.ok) {
      throw toChronofactHttpError(response.status, payload, unavailableCode);
    }

    return payload;
  } catch (error) {
    if (error instanceof ChronofactError) {
      throw error;
    }

    throw new ChronofactError(
      unavailableCode,
      `${unavailableMessage}: ${error.message}`,
      503
    );
  } finally {
    clearTimeout(timeout);
  }
}

function forwardedHeaders(requestHeaders, hasJsonBody) {
  const headers = {};
  const cookie = headerValue(requestHeaders, "cookie");
  const authorization = headerValue(requestHeaders, "authorization");
  if (cookie) headers.cookie = cookie;
  if (authorization) headers.authorization = authorization;
  if (hasJsonBody) headers["content-type"] = "application/json";
  return headers;
}

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") {
    return headers.get(name);
  }
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value.join("; ");
  return value ?? null;
}

async function readPayload(response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw_body: text };
  }
}

function toChronofactHttpError(status, payload, unavailableCode) {
  const code = payload.error?.code ?? payload.code;
  const message = payload.error?.message ?? payload.message ?? `Limora request failed with HTTP ${status}.`;

  if (status === 401) {
    return new ChronofactError("unauthorized", message, 401);
  }
  if (status === 403) {
    return new ChronofactError("permission_denied", message, 403);
  }
  if (status === 404) {
    return new ChronofactError("organization_not_found", message, 404);
  }
  if (status >= 500) {
    return new ChronofactError(unavailableCode, message, 503);
  }
  return new ChronofactError(code ?? "limora_request_failed", message, status);
}

function identityContextFromSession(payload) {
  const current = payload.data?.currentSession ?? payload.currentSession ?? payload.data ?? payload;
  const identity = current.identity ?? current.user ?? current.session?.user ?? current.session?.userId;
  const session = current.session ?? {};
  const identityId =
    identity?.id ??
    identity?.identityId ??
    current.identityId ??
    current.userId ??
    session.userId;

  if (!identityId) {
    throw new ChronofactError(
      "identity_unavailable",
      "Limora current session did not include an identity id.",
      503
    );
  }

  return {
    user_id: identityId,
    display_name: identity?.name ?? identity?.email ?? identityId,
    email: identity?.email ?? null,
    session_id: session.id ?? current.sessionId ?? null,
    limora_session: current
  };
}
