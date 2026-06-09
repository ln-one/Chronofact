import {
  ThreadListPrimitive,
  ThreadListItemPrimitive,
} from '@assistant-ui/react'
import {
  Plus,
  MessageSquare,
  Settings,
  Moon,
  Sun,
  Search,
  MoreHorizontal,
  Trash2,
  Pin,
  ShieldCheck,
  GitBranch,
  FileText,
  List,
  Fingerprint,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/context/theme-provider'
import { ChronofactLogo } from './chronofact-logo'

const agentTools = [
  {
    name: 'list_evidence',
    label: '查询存证记录',
    description: '列出工作空间内的存证记录',
    icon: List,
    iconClassName: 'bg-emerald-50 text-emerald-600/80',
  },
  {
    name: 'verify_receipt',
    label: '核验回执',
    description: '检查摘要、回执和链上状态',
    icon: ShieldCheck,
    iconClassName: 'bg-sky-50 text-sky-600/75',
  },
  {
    name: 'get_trace',
    label: '版本链路',
    description: '追踪资产版本历史',
    icon: GitBranch,
    iconClassName: 'bg-violet-50 text-violet-600/75',
  },
  {
    name: 'find_digest',
    label: '指纹查找',
    description: '通过 SHA-256 查找文件',
    icon: Fingerprint,
    iconClassName: 'bg-amber-50 text-amber-600/80',
  },
  {
    name: 'export_review_report',
    label: '导出报告',
    description: '生成带证明来源的报告',
    icon: FileText,
    iconClassName: 'bg-slate-100 text-slate-600/75',
  },
]

export function AgentThreadList() {
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className='flex h-full flex-col'>
      {/* 顶部：品牌 + 新建 */}
      <div className='flex items-center justify-between px-6 pb-4 pt-6'>
        <div className='flex items-center gap-3'>
          <ChronofactLogo size={34} />
          <span className='text-xl font-semibold tracking-tight'>
            Chronofact
          </span>
        </div>
        <ThreadListPrimitive.New asChild>
          <Button
            variant='outline'
            size='icon'
            className='h-11 w-11 rounded-xl shadow-sm'
            title='新建对话'
          >
            <Plus className='h-5 w-5' />
          </Button>
        </ThreadListPrimitive.New>
      </div>

      {/* 搜索栏 */}
      <div className='px-6 pb-5'>
        {searchOpen ? (
          <input
            type='text'
            placeholder='搜索对话...'
            className='h-10 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20'
            autoFocus
            onBlur={() => setSearchOpen(false)}
          />
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className='flex h-10 w-full items-center gap-3 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent'
          >
            <Search className='h-4.5 w-4.5' />
            搜索对话...
          </button>
        )}
      </div>

      <Separator />

      {/* 对话列表：固定为约 3 条历史记录高度，内部滚动 */}
      <div className='px-5 pb-2.5 pt-3'>
        <p className='mb-2 px-1 text-xs font-medium text-muted-foreground/60'>
          最近
        </p>
        <ScrollArea className='h-24 pr-1'>
          <ThreadListPrimitive.Root>
            <ThreadListPrimitive.Items
              components={{ ThreadListItem }}
            />
          </ThreadListPrimitive.Root>
        </ScrollArea>
      </div>

      <Separator className='mx-5 w-auto' />

      {/* 智能体工具：固定区域，保持当前整体左栏大小 */}
      <div className='min-h-0 flex-1 px-5 pb-2 pt-3'>
        <p className='mb-2.5 px-1 text-xs font-medium text-muted-foreground/60'>
          智能体工具
        </p>
        <div className='space-y-1.5'>
          {agentTools.map((tool) => {
            const Icon = tool.icon
            return (
              <div
                key={tool.name}
                className='flex items-start gap-3 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-accent'
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tool.iconClassName}`}
                >
                  <Icon className='h-4.5 w-4.5' />
                </div>
                <div className='min-w-0'>
                  <p className='truncate text-sm font-semibold text-foreground/90'>
                    {tool.label}
                  </p>
                  <p className='line-clamp-1 text-xs leading-5 text-muted-foreground/60'>
                    {tool.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Separator className='mx-3 w-auto' />

      {/* 底部：用户 */}
      <div className='px-3 py-2.5'>
        <div className='flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent/50'>
          <div className='flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'>
            U
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium'>用户</p>
          </div>
          <div className='flex gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7 text-muted-foreground/50 hover:text-foreground'
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
            </Button>
            <Button variant='ghost' size='icon' className='h-7 w-7 text-muted-foreground/50 hover:text-foreground'>
              <Settings className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ThreadListItem() {
  return (
    <ThreadListItemPrimitive.Root className='group relative mb-2.5 flex w-full cursor-pointer items-center gap-3.5 rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent data-[current]:bg-accent'>
      <MessageSquare className='h-4.5 w-4.5 shrink-0 text-muted-foreground/45 group-data-[current]:text-foreground/60' />
      <span className='flex-1 truncate text-muted-foreground group-data-[current]:text-foreground'>
        <ThreadListItemPrimitive.Title fallback='新对话' />
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100'
          >
            <MoreHorizontal className='h-3.5 w-3.5' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-36'>
          <DropdownMenuItem className='gap-2 text-sm'>
            <Pin className='h-3.5 w-3.5' />
            置顶
          </DropdownMenuItem>
          <DropdownMenuItem className='gap-2 text-sm text-destructive'>
            <Trash2 className='h-3.5 w-3.5' />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ThreadListItemPrimitive.Root>
  )
}
