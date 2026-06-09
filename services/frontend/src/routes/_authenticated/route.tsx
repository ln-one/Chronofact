import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getCurrentLimoraSession } from '@/features/auth/limora-api'

// Agent-first: 无 sidebar，全屏布局
function AgentLayout() {
  return <Outlet />
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    try {
      await getCurrentLimoraSession()
    } catch {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
  },
  component: AgentLayout,
})
