export type LimoraAuthContext = {
  identity: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
  session: {
    id?: string | null;
  };
  memberships: Array<{
    organizationId: string;
    organizationName?: string | null;
    permissions: string[];
  }>;
};

export type RequestAuthHeaders = {
  cookie?: string;
  authorization?: string;
};

export type LimoraClient = ReturnType<typeof createLimoraClient>;

export function createLimoraClient({
  baseUrl,
  fetchImpl = globalThis.fetch
}: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    async currentSession(headers: RequestAuthHeaders = {}): Promise<LimoraAuthContext> {
      const payload = await requestJson(fetchImpl, `${normalizedBaseUrl}/v1/sessions/current`, { headers });
      const data = payload?.data ?? payload;
      const identity = data?.identity ?? data?.user ?? {};
      const session = data?.session ?? {};
      const memberships = Array.isArray(data?.memberships) ? data.memberships : [];
      const identityId = identity?.id ?? session?.userId ?? data?.userId;
      if (!identityId) {
        throw httpError(503, "identity_unavailable", "Limora current session did not include an identity.");
      }
      return {
        identity: {
          id: identityId,
          email: identity?.email ?? null,
          name: identity?.name ?? identity?.displayName ?? null
        },
        session: {
          id: session?.id ?? null
        },
        memberships: memberships
          .map((membership: any) => {
            const organization = membership.organization ?? {};
            const organizationId = membership.organizationId ?? organization.id;
            if (!organizationId) return null;
            return {
              organizationId,
              organizationName: organization.name ?? membership.organizationName ?? null,
              permissions: Array.isArray(membership.permissions)
                ? membership.permissions.map((permission: any) => typeof permission === "string" ? permission : permission?.permission).filter(Boolean)
                : []
            };
          })
          .filter(Boolean)
      };
    }
  };
}

async function requestJson(fetchImpl: typeof fetch, url: string, { headers }: { headers: RequestAuthHeaders }) {
  const response = await fetchImpl(url, {
    headers: forwardedHeaders(headers)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? `Limora returned ${response.status}`;
    const code = payload?.error?.code ?? payload?.code ?? "limora_request_failed";
    throw httpError(response.status, code, message);
  }
  return payload;
}

function forwardedHeaders(input: RequestAuthHeaders) {
  const headers: Record<string, string> = {};
  if (input.cookie) headers.cookie = input.cookie;
  if (input.authorization) headers.authorization = input.authorization;
  return headers;
}

function httpError(status: number, code: string, message: string) {
  const error = new Error(message) as Error & { status?: number; code?: string };
  error.status = status;
  error.code = code;
  return error;
}
