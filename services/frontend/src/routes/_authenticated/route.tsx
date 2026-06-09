import { createFileRoute, Outlet, useMatches } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

function AuthenticatedRouteLayout() {
  const matches = useMatches()
  const isImmersiveRoute = matches.some((match) =>
    match.pathname.startsWith('/agent')
  )
  const currentMatch = matches[matches.length - 1]
  const isLandingRoute = currentMatch?.pathname === '/'

  if (isLandingRoute || isImmersiveRoute) {
    return <Outlet />
  }

  return <AuthenticatedLayout />
}

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedRouteLayout,
})
