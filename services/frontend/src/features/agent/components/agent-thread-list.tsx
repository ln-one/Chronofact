import { useEffect, useState } from 'react'
import {
  ThreadListPrimitive,
  ThreadListItemPrimitive,
  useAuiState,
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
} from 'lucide-react'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  isThreadPinned,
  THREAD_LIST_CHANGED_EVENT,
  togglePinnedThread,
} from '../thread-list-adapter'
import { ChronofactLogo } from './chronofact-logo'

export function AgentThreadList() {
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className='flex h-full flex-col'>
      {/* 顶部：品牌 + 新建 */}
      <div className='flex items-center justify-between px-6 pt-6 pb-4'>
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
            className='h-10 w-full rounded-lg border bg-background px-3 text-sm focus:ring-2 focus:ring-ring/20 focus:outline-none'
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

      {/* 对话列表 */}
      <div className='min-h-0 flex-1 px-5 pt-3 pb-2.5'>
        <p className='mb-2 px-1 text-xs font-medium text-muted-foreground/60'>
          最近
        </p>
        <ScrollArea className='h-full pr-1'>
          <ThreadListPrimitive.Root>
            <ThreadListPrimitive.Items components={{ ThreadListItem }} />
          </ThreadListPrimitive.Root>
        </ScrollArea>
      </div>

      <Separator className='mx-5 w-auto' />

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
            >
              <Settings className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ThreadListItem() {
  const remoteId = useAuiState((state) => state.threadListItem.remoteId)
  const [pinned, setPinned] = useState(() => isThreadPinned(remoteId))

  useEffect(() => {
    setPinned(isThreadPinned(remoteId))

    const updatePinnedState = () => setPinned(isThreadPinned(remoteId))
    window.addEventListener(THREAD_LIST_CHANGED_EVENT, updatePinnedState)
    return () => {
      window.removeEventListener(THREAD_LIST_CHANGED_EVENT, updatePinnedState)
    }
  }, [remoteId])

  return (
    <ThreadListItemPrimitive.Root className='group relative mb-2.5 flex w-full items-center gap-1 rounded-lg text-sm transition-colors hover:bg-accent data-[current]:bg-accent'>
      <ThreadListItemPrimitive.Trigger className='flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 rounded-lg px-3 py-1.5 text-left'>
        <MessageSquare className='h-4.5 w-4.5 shrink-0 text-muted-foreground/45 group-data-[current]:text-foreground/60' />
        <span className='flex-1 truncate text-muted-foreground group-data-[current]:text-foreground'>
          <ThreadListItemPrimitive.Title fallback='新对话' />
        </span>
      </ThreadListItemPrimitive.Trigger>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='mr-1 h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100'
          >
            <MoreHorizontal className='h-3.5 w-3.5' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-36'>
          <DropdownMenuItem
            className='gap-2 text-sm'
            onClick={() => togglePinnedThread(remoteId)}
          >
            <Pin className='h-3.5 w-3.5' />
            {pinned ? '取消置顶' : '置顶'}
          </DropdownMenuItem>
          <ThreadListItemPrimitive.Delete asChild>
            <DropdownMenuItem className='gap-2 text-sm text-destructive'>
              <Trash2 className='h-3.5 w-3.5' />
              删除
            </DropdownMenuItem>
          </ThreadListItemPrimitive.Delete>
        </DropdownMenuContent>
      </DropdownMenu>
    </ThreadListItemPrimitive.Root>
  )
}
