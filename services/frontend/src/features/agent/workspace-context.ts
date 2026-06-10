import type { ChronofactWorkspace } from '@/services/chronofact-api'

export const AGENT_WORKSPACE_CHANGED_EVENT =
  'chronofact:agent:workspace-changed'

const CURRENT_WORKSPACE_KEY = 'chronofact:agent:current-workspace'
const CONVERSATION_WORKSPACES_KEY = 'chronofact:agent:conversation-workspaces'

export type CurrentAgentWorkspace = Pick<
  ChronofactWorkspace,
  'workspace_id' | 'title' | 'workspace_type' | 'status' | 'description'
>

export function getCurrentAgentWorkspace() {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(CURRENT_WORKSPACE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as CurrentAgentWorkspace
  } catch {
    return null
  }
}

export function getCurrentAgentWorkspaceId() {
  return getCurrentAgentWorkspace()?.workspace_id ?? ''
}

export function setCurrentAgentWorkspace(workspace: ChronofactWorkspace) {
  if (typeof window === 'undefined') return
  const value: CurrentAgentWorkspace = {
    workspace_id: workspace.workspace_id,
    title: workspace.title,
    workspace_type: workspace.workspace_type,
    status: workspace.status,
    description: workspace.description,
  }
  window.localStorage.setItem(CURRENT_WORKSPACE_KEY, JSON.stringify(value))
  window.dispatchEvent(new Event(AGENT_WORKSPACE_CHANGED_EVENT))
}

export function clearCurrentAgentWorkspace() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(CURRENT_WORKSPACE_KEY)
  window.dispatchEvent(new Event(AGENT_WORKSPACE_CHANGED_EVENT))
}

export function getConversationWorkspaceId(conversationId: string) {
  return readConversationWorkspaces()[conversationId] ?? ''
}

export function linkAgentConversationToWorkspace(
  conversationId: string,
  workspaceId: string
) {
  if (typeof window === 'undefined' || !conversationId || !workspaceId) return
  const mapping = readConversationWorkspaces()
  mapping[conversationId] = workspaceId
  window.localStorage.setItem(CONVERSATION_WORKSPACES_KEY, JSON.stringify(mapping))
}

function readConversationWorkspaces() {
  if (typeof window === 'undefined') return {} as Record<string, string>
  const raw = window.localStorage.getItem(CONVERSATION_WORKSPACES_KEY)
  if (!raw) return {} as Record<string, string>

  try {
    const value = JSON.parse(raw)
    return typeof value === 'object' && value !== null
      ? (value as Record<string, string>)
      : {}
  } catch {
    return {}
  }
}
