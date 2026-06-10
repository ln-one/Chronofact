export const chronofactApiBaseUrl = (
  import.meta.env.VITE_CHRONOFACT_API_URL || 'http://127.0.0.1:3001'
).replace(/\/+$/, '')

export type WorkspaceStatus = 'active' | 'under_review' | 'archived'

export type WorkspaceType = 'experiment' | 'course_project' | 'assignment'

export type ChronofactWorkspace = {
  workspace_id: string
  title: string
  workspace_type: WorkspaceType | string
  status: WorkspaceStatus | string
  description?: string
  created_at?: string
  updated_at?: string
}

type ChronofactErrorEnvelope = {
  error?: {
    code?: string
    message?: string
  }
  message?: string
}

export async function requestChronofact<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  let response: Response

  try {
    response = await fetch(`${chronofactApiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new Error(`Chronofact API 暂时不可用，请确认服务已启动：${chronofactApiBaseUrl}`)
  }

  const payload = (await response.json().catch(() => ({}))) as T & ChronofactErrorEnvelope
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `Chronofact API 返回 ${response.status}`)
  }
  return payload
}

export function listWorkspaces(filters: { q?: string; status?: string } = {}) {
  return requestChronofact<{ workspaces: ChronofactWorkspace[] }>(
    withQuery('/workspaces', filters)
  )
}

export function createWorkspace(input: {
  title: string
  workspace_type: WorkspaceType
  description?: string
}) {
  return requestChronofact<{ workspace: ChronofactWorkspace }>('/workspaces', {
    method: 'POST',
    body: input,
  })
}

export function updateWorkspaceStatus(input: {
  workspaceId: string
  status: WorkspaceStatus
}) {
  return requestChronofact<{ workspace: ChronofactWorkspace }>(
    `/workspaces/${encodeURIComponent(input.workspaceId)}/status`,
    {
      method: 'POST',
      body: { status: input.status },
    }
  )
}

export function deleteWorkspace(workspaceId: string) {
  return requestChronofact<{ workspace: ChronofactWorkspace }>(
    `/workspaces/${encodeURIComponent(workspaceId)}`,
    {
      method: 'DELETE',
    }
  )
}

function withQuery(path: string, params: Record<string, unknown>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })

  const queryString = query.toString()
  return queryString ? `${path}?${queryString}` : path
}
