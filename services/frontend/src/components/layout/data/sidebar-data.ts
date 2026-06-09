import {
  Bot,
  Brain,
  FileText,
  FolderOpen,
  Folders,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Upload,
  UserCog,
  Palette,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Chronofact',
    email: 'evidence@chronofact.local',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Chronofact',
      logo: ShieldCheck,
      plan: '证据治理系统',
    },
  ],
  navGroups: [
    {
      title: '存证管理',
      items: [
        {
          title: '概览',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: '项目空间',
          url: '/workspaces',
          icon: Folders,
        },
        {
          title: '文件提交',
          url: '/submit',
          icon: Upload,
        },
        {
          title: '文件库',
          url: '/assets',
          icon: FolderOpen,
        },
        {
          title: '核验中心',
          url: '/verify',
          icon: ShieldCheck,
        },
      ],
    },
    {
      title: 'AI 与报告',
      items: [
        {
          title: 'AI 解释',
          url: '/ai',
          icon: Brain,
        },
        {
          title: 'Agent 工作台',
          url: '/agent',
          badge: 'Beta',
          icon: Bot,
        },
        {
          title: '报告导出',
          url: '/reports',
          icon: FileText,
        },
      ],
    },
    {
      title: '其他',
      items: [
        {
          title: '设置',
          icon: Settings,
          items: [
            {
              title: '个人资料',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: '外观',
              url: '/settings/appearance',
              icon: Palette,
            },
          ],
        },
      ],
    },
  ],
}
