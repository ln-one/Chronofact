import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  type TextMessagePartComponent,
} from '@assistant-ui/react'
import {
  SendHorizontal,
  ArrowDown,
  Search,
  GitBranch,
  FileText,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChronofactLogo, ChronofactMark } from './chronofact-logo'

const PlainText: TextMessagePartComponent = ({ text }) => (
  <div className='whitespace-pre-wrap'>{text}</div>
)

export function AgentChatPanel() {
  return (
    <ThreadPrimitive.Root className='flex h-full flex-col'>
      <ThreadPrimitive.Viewport className='flex-1 overflow-y-auto'>
        <ThreadPrimitive.Empty>
          <WelcomeScreen />
        </ThreadPrimitive.Empty>

        <div className='mx-auto max-w-[760px] px-6 py-6'>
          <ThreadPrimitive.Messages
            components={{ UserMessage, AssistantMessage }}
          />
        </div>
      </ThreadPrimitive.Viewport>

      {/* 滚动到底 */}
      <ThreadPrimitive.ScrollToBottom asChild>
        <Button
          variant='outline'
          size='icon'
          className='absolute bottom-32 left-1/2 z-10 h-9 w-9 -translate-x-1/2 rounded-full shadow-sm'
        >
          <ArrowDown className='h-4 w-4' />
        </Button>
      </ThreadPrimitive.ScrollToBottom>

      {/* 输入区 */}
      <div className='border-t px-6 pb-6 pt-4'>
        <div className='mx-auto max-w-[760px]'>
          <ComposerPrimitive.Root className='flex items-end gap-2 rounded-2xl border bg-background px-4 py-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/20'>
            <ComposerPrimitive.Input
              placeholder='询问存证状态、校验原因、版本关系、复核报告...'
              className='min-h-[44px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed focus:outline-none'
              autoFocus
            />
            <ComposerPrimitive.Send asChild>
              <Button
                size='icon'
                className='h-9 w-9 shrink-0 rounded-xl bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-800 dark:hover:bg-emerald-700'
              >
                <SendHorizontal className='h-4 w-4' />
              </Button>
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
          <p className='mt-2 text-center text-xs text-muted-foreground/40'>
            AI 解释不构成真实性证明 · 证明来源为结构化回执与链上记录
          </p>
        </div>
      </div>
    </ThreadPrimitive.Root>
  )
}

/* ── 用户消息 ── */

function UserMessage() {
  return (
    <MessagePrimitive.Root className='flex justify-end py-3'>
      <div className='max-w-[75%] rounded-2xl rounded-br-md bg-emerald-700 px-5 py-3 text-[15px] leading-relaxed text-white dark:bg-emerald-800'>
        <MessagePrimitive.Content components={{ Text: PlainText }} />
      </div>
    </MessagePrimitive.Root>
  )
}

/* ── 助手消息 ── */

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className='flex gap-3 py-3'>
      <div className='mt-1 flex h-7 w-7 shrink-0 items-center justify-center'>
        <ChronofactMark size={22} />
      </div>
      <div className='min-w-0 flex-1'>
        <p className='mb-1 text-xs font-medium text-emerald-700 dark:text-emerald-400'>
          Chronofact
        </p>
        <div className='text-[15px] leading-relaxed text-foreground/90'>
          <MessagePrimitive.Content components={{ Text: PlainText }} />
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

/* ── 欢迎页 ── */

const quickActions = [
  {
    icon: AlertTriangle,
    label: '哪些还没有链上确认？',
    prompt: '这批材料里哪些还没有链上确认？',
  },
  {
    icon: ShieldCheck,
    label: '为什么校验失败？',
    prompt: '为什么这次校验失败？',
  },
  {
    icon: GitBranch,
    label: '哪个版本是最新的？',
    prompt: '哪个版本是最新的？',
  },
  {
    icon: FileText,
    label: '生成一份复核报告',
    prompt: '帮我生成一份复核报告，标明证明来源',
  },
  {
    icon: Search,
    label: '查找文件存证',
    prompt: '这个文件有没有被存证？',
  },
]

function WelcomeScreen() {
  return (
    <div className='flex h-full flex-col items-center justify-center px-6'>
      <ChronofactLogo size={56} className='mb-5' />
      <h2 className='text-xl font-semibold tracking-tight'>
        Chronofact
      </h2>
      <p className='mb-1.5 text-sm text-muted-foreground'>
        AI 驱动的证据治理智能体
      </p>
      <p className='mb-10 max-w-md text-center text-sm leading-relaxed text-muted-foreground/60'>
        查询存证记录、核验文件完整性、追踪版本链路、发现异常并生成报告。所有结论均标注证据来源。
      </p>

      <div className='grid w-full max-w-xl grid-cols-2 gap-2.5 sm:grid-cols-3'>
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <ThreadPrimitive.Suggestion
              key={action.prompt}
              prompt={action.prompt}
              autoSend
              asChild
            >
              <button className='flex items-start gap-2.5 rounded-xl border p-3.5 text-left transition-colors hover:bg-accent'>
                <Icon className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                <span className='text-sm leading-snug text-foreground/70'>
                  {action.label}
                </span>
              </button>
            </ThreadPrimitive.Suggestion>
          )
        })}
      </div>
    </div>
  )
}
