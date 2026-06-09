export const chronofactApiBaseUrl =
  (import.meta.env.VITE_CHRONOFACT_API_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
export const defaultOrganizationId =
  import.meta.env.VITE_CHRONOFACT_ORGANIZATION_ID || "org_001";
const organizationRequestCredentials =
  import.meta.env.VITE_CHRONOFACT_WITH_CREDENTIALS === "false" ? undefined : "include";

export async function requestJson(path, options = {}) {
  const response = await fetch(`${chronofactApiBaseUrl}${path}`, {
    method: options.method || "GET",
    credentials: options.credentials ?? organizationRequestCredentials,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(toFriendlyApiError(payload, response.status));
    error.code = payload.error?.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function health() {
  return requestJson("/health");
}

export function seedDemo() {
  return requestJson("/demo/seed", { method: "POST", body: {} });
}

export function listWorkspaces(filters = {}) {
  return requestJson(withQuery("/workspaces", filters));
}

export function getWorkspace(workspaceId) {
  return requestJson(`/workspaces/${workspaceId}`);
}

export function getWorkspaceOverview(workspaceId) {
  return requestJson(`/workspaces/${workspaceId}/overview`);
}

export function createWorkspace(body) {
  return requestJson("/workspaces", { method: "POST", body });
}

export function updateWorkspaceStatus(workspaceId, body) {
  return requestJson(`/workspaces/${workspaceId}/status`, { method: "POST", body });
}

export function listAssets(filters = {}) {
  return requestJson(withQuery("/assets", filters));
}

export function getAsset(assetId) {
  return requestJson(`/assets/${assetId}`);
}

export function submitAsset(body) {
  return requestJson("/assets", { method: "POST", body });
}

export function submitWorkspaceAsset(workspaceId, body) {
  return requestJson(`/workspaces/${workspaceId}/assets`, { method: "POST", body });
}

export function submitAssetVersion(assetId, body) {
  return requestJson(`/assets/${assetId}/versions`, { method: "POST", body });
}

export function verifyVersion(body) {
  return requestJson("/verify", { method: "POST", body });
}

export function preserveOrganizationEvidence(organizationId, body) {
  return requestJson(`/organizations/${organizationId}/evidence/preserve`, {
    method: "POST",
    credentials: organizationRequestCredentials,
    body,
  });
}

export function verifyOrganizationEvidence(organizationId, body) {
  return requestJson(`/organizations/${organizationId}/evidence/verify`, {
    method: "POST",
    credentials: organizationRequestCredentials,
    body,
  });
}

export function listOrganizationEvidence(organizationId) {
  return requestJson(`/organizations/${organizationId}/evidence`, {
    credentials: organizationRequestCredentials,
  });
}

export function findOrganizationEvidenceByDigest(organizationId, sha256) {
  return requestJson(`/organizations/${organizationId}/evidence/digests/${sha256}`, {
    credentials: organizationRequestCredentials,
  });
}

export function listEvidence(filters = {}) {
  return requestJson(withQuery("/evidence", filters));
}

export function getVersionEvidence(versionId) {
  return requestJson(`/versions/${versionId}/evidence`);
}

export function getVersionReport(versionId) {
  return requestJson(`/versions/${versionId}/report`);
}

export function getWorkspaceReport(workspaceId) {
  return requestJson(`/workspaces/${workspaceId}/report`);
}

export function explainRisk(body) {
  return requestJson("/ai/explain/risk", { method: "POST", body });
}

export function explainFact(body) {
  return requestJson("/ai/explain/fact", { method: "POST", body });
}

export function explainTrace(body) {
  return requestJson("/ai/explain/trace", { method: "POST", body });
}

export function createReview(versionId, body) {
  return requestJson(`/versions/${versionId}/reviews`, { method: "POST", body });
}

export function listReviews(filters = {}) {
  return requestJson(withQuery("/reviews", filters));
}

export function listAuditLog(filters = {}) {
  return requestJson(withQuery("/audit-log", filters));
}

export function verifyAuditLog(filters = {}) {
  return requestJson(withQuery("/audit-log/verify", filters));
}

function withQuery(path, params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const value = query.toString();
  return value ? `${path}?${value}` : path;
}

function toFriendlyApiError(payload, status) {
  const code = payload.error?.code;
  const message = payload.error?.message;
  if (code === "organization_not_found" || message === "Organization not found") {
    return "当前登录账号不属于这个项目空间，或缺少该空间的存证权限。请重新选择项目空间后再提交。";
  }
  if (code === "permission_denied") {
    return "当前登录账号缺少执行该操作的存证权限。";
  }
  if (code === "unauthorized" || status === 401) {
    return "请先登录后再进行存证或校验。";
  }
  return message || `存证核验服务暂时不可用，请稍后重试（${status}）`;
}
