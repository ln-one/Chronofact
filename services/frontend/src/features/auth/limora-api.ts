const limoraApiBaseUrl = (
  import.meta.env.VITE_LIMORA_API_URL || 'http://127.0.0.1:3002'
).replace(/\/+$/, '')

export const chronofactEvidencePermissions = [
  'chronofact.evidence.create',
  'chronofact.evidence.read',
  'chronofact.evidence.verify',
] as const

export type LimoraIdentity = {
  id: string
  email: string
  name: string
}

export type LimoraOrganization = {
  id: string
  name: string
}

export type LimoraMembership = {
  id: string
  organizationId: string
  identityId: string
  permissions: string[]
  organization?: LimoraOrganization
}

export type LimoraCurrentSession = {
  session: {
    id: string
    userId: string
    expiresAt: string
  }
  identity: LimoraIdentity
  memberships: LimoraMembership[]
}

export async function loginLimora(input: { email: string; password: string }) {
  return requestLimora<{ data: LimoraCurrentSession }>('/v1/auth/login', {
    method: 'POST',
    body: input,
  })
}

export async function registerLimora(input: {
  name: string
  email: string
  password: string
}) {
  return requestLimora<{ data: LimoraCurrentSession }>('/v1/auth/register', {
    method: 'POST',
    body: input,
  })
}

export async function logoutLimora() {
  return requestLimora<{ data: { revoked: boolean } }>('/v1/auth/logout', {
    method: 'POST',
  })
}

export async function getCurrentLimoraSession() {
  const payload = await requestLimora<{ data: LimoraCurrentSession }>(
    '/v1/sessions/current'
  )
  return payload.data
}

export async function ensureChronofactOrganization() {
  let session = await getCurrentLimoraSession()
  let membership = session.memberships[0]

  if (!membership) {
    const created = await requestLimora<{
      data: {
        organization: LimoraOrganization
        membership: LimoraMembership
      }
    }>('/v1/organizations', {
      method: 'POST',
      body: { name: 'Chronofact 演示空间' },
    })
    membership = created.data.membership
    session = await getCurrentLimoraSession()
  }

  const current = session.memberships.find((item) => item.id === membership.id) ?? membership
  const missingPermissions = chronofactEvidencePermissions.filter(
    (permission) => !current.permissions.includes(permission)
  )
  if (missingPermissions.length > 0) {
    await requestLimora(
      `/v1/organizations/${encodeURIComponent(current.organizationId)}/memberships/${encodeURIComponent(current.id)}/permissions`,
      {
        method: 'POST',
        body: { permissions: missingPermissions },
      }
    )
    session = await getCurrentLimoraSession()
  }

  const nextMembership =
    session.memberships.find((item) => item.id === current.id) ??
    session.memberships[0]
  if (!nextMembership) {
    throw new Error('当前账号还没有可用的组织空间。')
  }

  return {
    session,
    membership: nextMembership,
  }
}

export function getLimoraApiBaseUrl() {
  return limoraApiBaseUrl
}

async function requestLimora<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  let response: Response
  try {
    response = await fetch(`${limoraApiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new Error('身份服务暂时不可用，请稍后重试或联系系统管理员。')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(toFriendlyLimoraError(payload, response.status))
  }
  return payload as T
}

function toFriendlyLimoraError(payload: any, status: number) {
  const message = payload?.error?.message || payload?.message || ''
  if (status === 401) return '邮箱或密码不正确，或登录状态已经失效。'
  if (status === 403) return '当前账号没有该空间的操作权限。'
  if (status === 409) return '该邮箱已经注册，请直接登录。'
  return message || '身份服务暂时无法完成请求，请稍后重试。'
}
