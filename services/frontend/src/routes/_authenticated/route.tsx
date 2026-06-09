import { createFileRoute, Outlet } from '@tanstack/react-router'

// Agent-first: 无 sidebar，全屏布局
function AgentLayout() {
  return <Outlet />
}

export const Route = createFileRoute('/_authenticated')({
  component: AgentLayout,
})
