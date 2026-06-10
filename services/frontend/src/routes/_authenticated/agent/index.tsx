import { createFileRoute, redirect } from '@tanstack/react-router'
import AgentWorkspace from '@/features/agent'
import { getCurrentAgentWorkspaceId } from '@/features/agent/workspace-context'

export const Route = createFileRoute('/_authenticated/agent/')({
  beforeLoad: () => {
    if (!getCurrentAgentWorkspaceId()) {
      throw redirect({ to: '/workspaces', replace: true })
    }
  },
  component: AgentWorkspace,
})
