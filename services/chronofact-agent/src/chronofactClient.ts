export type ChronofactClient = ReturnType<typeof createChronofactClient>;

export function createChronofactClient({
  baseUrl,
  fetchImpl = globalThis.fetch
}: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    preserveEvidence(input: {
      organizationId: string;
      filename: string;
      assetTitle?: string;
      assetType?: string;
      sha256: string;
    }) {
      return requestJson(fetchImpl, `${normalizedBaseUrl}/organizations/${encodeURIComponent(input.organizationId)}/evidence/preserve`, {
        method: "POST",
        body: {
          filename: input.filename,
          asset_title: input.assetTitle,
          asset_type: input.assetType,
          sha256: input.sha256
        }
      });
    },

    preserveEvidenceVersion(input: {
      organizationId: string;
      assetId: string;
      filename: string;
      assetType?: string;
      sha256: string;
    }) {
      return requestJson(fetchImpl, `${normalizedBaseUrl}/assets/${encodeURIComponent(input.assetId)}/versions`, {
        method: "POST",
        body: {
          workspace_id: input.organizationId,
          filename: input.filename,
          asset_type: input.assetType,
          sha256: input.sha256
        }
      });
    },

    verifyEvidence(input: { organizationId: string; sha256: string; proofId?: string | null; versionId?: string | null }) {
      return requestJson(fetchImpl, `${normalizedBaseUrl}/organizations/${encodeURIComponent(input.organizationId)}/evidence/verify`, {
        method: "POST",
        body: {
          sha256: input.sha256,
          proof_id: input.proofId ?? undefined,
          version_id: input.versionId ?? undefined
        }
      });
    },

    explainEvidence(input: { assetId?: string | null; versionId?: string | null; scenario?: string | null }) {
      return requestJson(fetchImpl, `${normalizedBaseUrl}/ai/explain/risk`, {
        method: "POST",
        body: {
          asset_id: input.assetId ?? undefined,
          version_id: input.versionId ?? undefined,
          scenario: input.scenario ?? undefined
        }
      });
    },

    findDigest(input: { organizationId: string; sha256: string }) {
      return requestJson(
        fetchImpl,
        `${normalizedBaseUrl}/organizations/${encodeURIComponent(input.organizationId)}/evidence/digests/${encodeURIComponent(input.sha256)}`
      );
    }
  };
}

async function requestJson(fetchImpl: typeof fetch, url: string, options: { method?: string; body?: unknown } = {}) {
  const response = await fetchImpl(url, {
    method: options.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Chronofact API returned ${response.status}`;
    const error = new Error(message) as Error & { status?: number; payload?: unknown };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}
