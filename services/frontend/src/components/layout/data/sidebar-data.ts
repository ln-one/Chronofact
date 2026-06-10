import { Bot, ShieldCheck } from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Chronofact',
    email: 'dev@chronofact.local',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Chronofact',
      logo: ShieldCheck,
      plan: 'Agent workspace',
    },
  ],
  navGroups: [
    {
      title: 'Workspace',
      items: [
        {
          title: 'Agent',
          url: '/agent',
          badge: 'Beta',
          icon: Bot,
        },
      ],
    },
  ],
}
