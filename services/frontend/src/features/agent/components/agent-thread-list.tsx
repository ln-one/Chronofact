import { useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useTheme } from '@/context/theme-provider'
import type { CurrentAgentWorkspace } from '@/features/agent/workspace-context'
import type {
  LimoraIdentity,
  LimoraOrganization,
} from '@/features/auth/limora-api'
import type { AgentConversation } from '../agent-api'
import { ChronofactLogo } from './chronofact-logo'

const PINNED_CONVERSATIONS_KEY = 'chronofact:agent:pinned-conversations'

export function AgentThreadList({
  conversations,
  currentConversationId,
  loading,
  identity,
  organization,
  workspace,
  onCreateConversation,
  onSelectConversation,
  onSwitchWorkspace,
}: {
  conversations: AgentConversation[]
  currentConversationId: string | null
  loading: boolean
  identity: LimoraIdentity | null
  organization: LimoraOrganization | null
  workspace: CurrentAgentWorkspace | null
  onCreateConversation: () => void
  onSelectConversation: (conversationId: string) => void
  onSwitchWorkspace: () => void
}) {
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pinnedConversationIds, setPinnedConversationIds] = useState(() =>
    readPinnedConversationIds()
  )

  const visibleConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const filtered = normalized
      ? conversations.filter((conversation) =>
          conversation.title.toLowerCase().includes(normalized)
        )
      : conversations

    return [...filtered].sort((a, b) => {
      const aPinned = pinnedConversationIds.includes(a.conversation_id)
      const bPinned = pinnedConversationIds.includes(b.conversation_id)
      if (aPinned !== bPinned) return aPinned ? -1 : 1
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
    })
  }, [conversations, pinnedConversationIds, query])

  function togglePinnedConversation(conversationId: string) {
    setPinnedConversationIds((current) => {
      const next = current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [conversationId, ...current]
      writePinnedConversationIds(next)
      return next
    })
  }

  return (
    <div className='flex h-full flex-col'>
      <div className='flex items-center justify-between px-6 pb-4 pt-6'>
        <div className='flex items-center gap-3'>
          <ChronofactLogo size={34} />
          <span className='text-xl font-semibold tracking-tight'>
            Chronofact
          </span>
        </div>
        <Button
          variant='outline'
          size='icon'
          className='h-11 w-11 rounded-xl shadow-sm'
          title='新建对话'
          onClick={onCreateConversation}
          disabled={loading}
        >
          <Plus className='h-5 w-5' />
        </Button>
      </div>

      <div className='px-6 pb-5'>
        <button
          type='button'
          onClick={onSwitchWorkspace}
          className='mb-3 flex w-full items-center gap-3 rounded-xl border bg-background/70 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent'
        >
          <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'>
            <ArrowLeftRight className='h-4 w-4' />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='block truncate font-medium'>
              {workspace?.title ?? '未选择项目'}
            </span>
            <span className='block truncate text-xs text-muted-foreground/60'>
              点击切换项目空间
            </span>
          </span>
        </button>

        {searchOpen ? (
          <input
            type='text'
            placeholder='搜索对话...'
            className='h-10 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20'
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onBlur={() => {
              if (!query) setSearchOpen(false)
            }}
          />
        ) : (
          <button
            type='button'
            onClick={() => setSearchOpen(true)}
            className='flex h-10 w-full items-center gap-3 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent'
          >
            <Search className='h-4.5 w-4.5' />
            搜索对话...
          </button>
        )}
      </div>

      <Separator />

      <div className='min-h-0 flex-1 px-5 pb-2.5 pt-3'>
        <p className='mb-2 px-1 text-xs font-medium text-muted-foreground/60'>
          最近
        </p>
        <ScrollArea className='h-full pr-1'>
          <div className='space-y-2'>
            {visibleConversations.length === 0 ? (
              <p className='px-2 py-4 text-sm text-muted-foreground/60'>
                {loading ? '正在加载...' : '暂无对话'}
              </p>
            ) : (
              visibleConversations.map((conversation) => {
                const pinned = pinnedConversationIds.includes(
                  conversation.conversation_id
                )
                return (
                  <div
                    key={conversation.conversation_id}
                    className={`group flex w-full items-start gap-1 rounded-lg text-sm transition-colors hover:bg-accent ${
                      currentConversationId === conversation.conversation_id
                        ? 'bg-accent'
                        : ''
                    }`}
                  >
                    <button
                      type='button'
                      onClick={() =>
                        onSelectConversation(conversation.conversation_id)
                      }
                      className='flex min-w-0 flex-1 items-start gap-3.5 rounded-lg px-3 py-2 text-left'
                    >
                      <MessageSquare className='mt-0.5 h-4.5 w-4.5 shrink-0 text-muted-foreground/45 group-hover:text-foreground/60' />
                      <span className='min-w-0 flex-1'>
                        <span className='flex min-w-0 items-center gap-1.5'>
                          {pinned && (
                            <Pin className='h-3.5 w-3.5 shrink-0 text-emerald-600/70' />
                          )}
                          <span className='block truncate text-foreground/85'>
                            {conversation.title || '新对话'}
                          </span>
                        </span>
                        <span className='mt-0.5 block truncate text-xs text-muted-foreground/45'>
                          {formatRelativeTime(conversation.updated_at)}
                        </span>
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='mr-1 mt-1 h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100'
                        >
                          <MoreHorizontal className='h-3.5 w-3.5' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end' className='w-36'>
                        <DropdownMenuItem
                          className='gap-2 text-sm'
                          onClick={() =>
                            togglePinnedConversation(
                              conversation.conversation_id
                            )
                          }
                        >
                          <Pin className='h-3.5 w-3.5' />
                          {pinned ? '取消置顶' : '置顶'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className='gap-2 text-sm text-muted-foreground'
                          disabled
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <Separator className='mx-3 w-auto' />

      <div className='px-3 py-2.5'>
        <div className='flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent/50'>
          <div className='flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'>
            {initials(identity?.name || identity?.email || 'U')}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium'>
              {organization?.name ?? 'Chronofact'}
            </p>
            <p className='truncate text-xs text-muted-foreground/55'>
              {identity?.email ?? '未登录'}
            </p>
          </div>
          <div className='flex gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7 text-muted-foreground/50 hover:text-foreground'
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <Sun className='h-4 w-4' />
              ) : (
                <Moon className='h-4 w-4' />
              )}
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7 text-muted-foreground/50 hover:text-foreground'
              disabled
            >
              <Settings className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function initials(value: string) {
  return [...value.trim()].slice(0, 1).join('').toUpperCase() || 'U'
}

function readPinnedConversationIds() {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(PINNED_CONVERSATIONS_KEY)
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function writePinnedConversationIds(conversationIds: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    PINNED_CONVERSATIONS_KEY,
    JSON.stringify(conversationIds)
  )
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}
