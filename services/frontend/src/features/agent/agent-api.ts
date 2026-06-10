const agentApiBaseUrl = (
  import.meta.env.VITE_CHRONOFACT_AGENT_API_URL || 'http://127.0.0.1:3003'
).replace(/\/+$/, '')

export type AgentConversation = {
  conversation_id: string
  organization_id?: string
  title: string
  created_at: string
  updated_at: string
}

export type AgentMessage = {
  message_id: string
  conversation_id: string
  role: 'user' | 'assistant' | string
  content: string
  status?: 'completed' | 'running' | 'failed' | string
  metadata: {
    file_id?: string | null
    action?: string | null
    action_required?: AgentActionRequired | null
    tool_call_ids?: string[]
  } | null
  created_at: string
}

export type AgentFileContext = {
  conversation_id?: string
  organization_id?: string
  file_id: string
  filename: string
  sha256: string
  size: number
  mime_type?: string | null
  proof_id?: string | null
  document_id?: string | null
  document_version_id?: string | null
  document?: AgentDocument | null
  version?: AgentDocumentVersion | null
  created_at?: string
}

export type AgentDocument = {
  document_id: string
  organization_id: string
  display_name: string
  normalized_name: string
  latest_version_id?: string | null
  created_at: string
  updated_at: string
}

export type AgentDocumentVersion = {
  document_version_id: string
  document_id: string
  file_id: string
  sha256: string
  version_no: number
  proof_id?: string | null
  asset_id?: string | null
  chronofact_version_id?: string | null
  created_at: string
}

export type AgentToolCall = {
  tool_call_id: string
  conversation_id?: string
  tool_name: string
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  status: 'completed' | 'failed' | string
  created_at: string
}

export type AgentProofSnapshot = {
  proof_snapshot_id: string
  conversation_id: string
  file_id?: string | null
  proof_id?: string | null
  sha256?: string | null
  snapshot: Record<string, unknown>
  created_at: string
}

export type AgentRun = {
  run_id: string
  conversation_id: string
  user_message_id: string
  assistant_message_id: string
  file_id?: string | null
  action?: string | null
  status: 'running' | 'completed' | 'failed' | string
  error?: string | null
  created_at: string
  updated_at: string
  completed_at?: string | null
}

export type AgentActionRequired = {
  type: 'confirm_preserve'
  label: string
  file_id: string
}

export type AgentConversationDetail = {
  conversation: AgentConversation
  messages: AgentMessage[]
  files: AgentFileContext[]
  tool_calls: AgentToolCall[]
  proof_snapshots: AgentProofSnapshot[]
  runs: AgentRun[]
  current_file: AgentFileContext | null
}

export type AgentDocumentLibrary = {
  organization_id: string
  totals: {
    documents: number
    preserved_documents: number
    unpreserved_documents: number
    versions: number
    uploaded_unversioned_files: number
  }
  documents: Array<{
    document: AgentDocument
    latest_version: AgentDocumentVersion | null
    versions: Array<{
      version: AgentDocumentVersion
      file: AgentFileContext | null
    }>
  }>
  unversioned_files: AgentFileContext[]
}

export type AgentHealth = {
  status: string
  service: string
  llm?: {
    configured: boolean
    model: string | null
  }
  limora?: {
    configured: boolean
  }
  chronofact_api?: {
    url: string
    reachable: boolean
    status: string
    service: string | null
    runtime: {
      chronestia?: RuntimeAdapterStatus
      limora?: RuntimeAdapterStatus
      dualweave?: RuntimeAdapterStatus
      ai?: RuntimeAdapterStatus
    } | null
  }
}

export type RuntimeAdapterStatus = {
  mode: string
  url: string | null
}

export type AgentChatResponse = {
  conversation_id: string
  reply: string
  user_message?: AgentMessage
  assistant_message?: AgentMessage
  tool_calls?: AgentToolCall[]
  proof?: Record<string, unknown> | null
  verification?: Record<string, unknown> | null
  explanation?: Record<string, unknown> | null
  file?: AgentFileContext | null
  action?: string
  action_required?: AgentActionRequired | null
}

export async function listAgentConversations(organizationId: string) {
  const payload = await requestJson<{ conversations: AgentConversation[] }>(
    `/agent/conversations?organization_id=${encodeURIComponent(organizationId)}`
  )
  return payload.conversations
}

export async function getAgentHealth() {
  return requestJson<AgentHealth>('/health')
}

export async function createAgentConversation(input: { title?: string; organizationId: string }) {
  const payload = await requestJson<{ conversation: AgentConversation }>('/agent/conversations', {
    method: 'POST',
    body: { title: input.title ?? '新对话', organization_id: input.organizationId },
  })
  return payload.conversation
}

export async function getAgentConversation(conversationId: string, organizationId: string) {
  return requestJson<AgentConversationDetail>(
    `/agent/conversations/${encodeURIComponent(conversationId)}?organization_id=${encodeURIComponent(organizationId)}`
  )
}

export async function getAgentDocumentLibrary(organizationId: string) {
  return requestJson<AgentDocumentLibrary>(
    `/agent/documents?organization_id=${encodeURIComponent(organizationId)}`
  )
}

export async function uploadAgentFile(input: {
  conversationId: string
  organizationId: string
  file: File
  contentBase64: string
  mimeType?: string
}) {
  return requestJson<AgentFileContext & { tool_call?: AgentToolCall }>('/agent/files', {
    method: 'POST',
    body: {
      conversation_id: input.conversationId,
      organization_id: input.organizationId,
      filename: input.file.name,
      content_base64: input.contentBase64,
      mime_type: input.mimeType || input.file.type || 'application/octet-stream',
    },
  })
}

export async function chatWithAgent(input: {
  conversationId: string
  organizationId: string
  message: string
  fileId?: string | null
  confirmedAction?: boolean
}) {
  return requestJson<AgentChatResponse>('/agent/chat', {
    method: 'POST',
    body: {
      conversation_id: input.conversationId,
      organization_id: input.organizationId,
      message: input.message,
      file_id: input.fileId ?? undefined,
      confirmed_action: input.confirmedAction ?? false,
    },
  })
}

export async function startAgentRun(input: {
  conversationId: string
  organizationId: string
  message: string
  fileId?: string | null
  confirmedAction?: boolean
}) {
  return requestJson<{
    conversation_id: string
    run: AgentRun
    user_message: AgentMessage
    assistant_message: AgentMessage
    current_file: AgentFileContext | null
  }>('/agent/runs', {
    method: 'POST',
    body: {
      conversation_id: input.conversationId,
      organization_id: input.organizationId,
      message: input.message,
      file_id: input.fileId ?? undefined,
      confirmed_action: input.confirmedAction ?? false,
    },
  })
}

export function getAgentApiBaseUrl() {
  return agentApiBaseUrl
}

async function requestJson<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  const response = await fetch(`${agentApiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Agent 请求失败：${response.status}`)
  }
  return payload as T
}
