import { createFileRoute } from '@tanstack/react-router'
import AgentWorkspace from '@/features/agent'

export const Route = createFileRoute('/_authenticated/')({
  component: AgentWorkspace,
})
