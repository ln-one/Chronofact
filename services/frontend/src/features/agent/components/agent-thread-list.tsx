import {
  Plus,
  MessageSquare,
  Settings,
  Moon,
  Sun,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useTheme } from '@/context/theme-provider'
import type { AgentConversation } from '../agent-api'
import { ChronofactLogo } from './chronofact-logo'

export function AgentThreadList({
  conversations,
  currentConversationId,
  loading,
  onCreateConversation,
  onSelectConversation,
}: {
  conversations: AgentConversation[]
  currentConversationId: string | null
  loading: boolean
  onCreateConversation: () => void
  onSelectConversation: (conversationId: string) => void
}) {
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const visibleConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return conversations
    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(normalized)
    )
  }, [conversations, query])

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
              visibleConversations.map((conversation) => (
                <button
                  key={conversation.conversation_id}
                  type='button'
                  onClick={() => onSelectConversation(conversation.conversation_id)}
                  className={`group flex w-full items-start gap-3.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                    currentConversationId === conversation.conversation_id ? 'bg-accent' : ''
                  }`}
                >
                  <MessageSquare className='mt-0.5 h-4.5 w-4.5 shrink-0 text-muted-foreground/45 group-hover:text-foreground/60' />
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-foreground/85'>
                      {conversation.title || '新对话'}
                    </span>
                    <span className='mt-0.5 block truncate text-xs text-muted-foreground/45'>
                      {formatRelativeTime(conversation.updated_at)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <Separator className='mx-3 w-auto' />

      <div className='px-3 py-2.5'>
        <div className='flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent/50'>
          <div className='flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'>
            U
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium'>org_001</p>
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
            <Button variant='ghost' size='icon' className='h-7 w-7 text-muted-foreground/50 hover:text-foreground' disabled>
              <Settings className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
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
