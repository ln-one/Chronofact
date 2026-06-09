import { useState } from 'react'
import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type TextMessagePartComponent,
} from '@assistant-ui/react'
import {
  AlertTriangle,
  ArrowDown,
  ChevronRight,
  FileText,
  Fingerprint,
  GitBranch,
  List,
  Paperclip,
  Plus,
  Puzzle,
  Search,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChronofactLogo, ChronofactMark } from './chronofact-logo'

const PlainText: TextMessagePartComponent = ({ text }) => (
  <div className='whitespace-pre-wrap'>{text}</div>
)

export function AgentChatPanel() {
  const [toolsOpen, setToolsOpen] = useState(false)

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

      {/* 滚动到底部 */}
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
      <div className='border-t px-6 pt-4 pb-6'>
        <div className='relative mx-auto max-w-[760px]'>
          {toolsOpen && (
            <div className='absolute bottom-[calc(100%+0.75rem)] left-0 z-30'>
              <ComposerActionMenu onClose={() => setToolsOpen(false)} />
            </div>
          )}
          <ComposerPrimitive.Root className='flex items-end gap-2 rounded-2xl border bg-background px-4 py-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/20'>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground'
              aria-label={toolsOpen ? '收起智能体工具' : '展开智能体工具'}
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((open) => !open)}
            >
              <Plus
                className={`h-4 w-4 transition-transform ${toolsOpen ? 'rotate-45' : ''}`}
              />
            </Button>
            <ComposerPrimitive.Input
              placeholder='询问存证状态、校验原因、版本关系、复核报告...'
              className='min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-6 focus:outline-none'
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

/* 用户消息 */

function UserMessage() {
  return (
    <MessagePrimitive.Root className='flex justify-end py-3'>
      <div className='max-w-[75%] rounded-2xl rounded-br-md bg-emerald-700 px-5 py-3 text-[15px] leading-relaxed text-white dark:bg-emerald-800'>
        <MessagePrimitive.Content components={{ Text: PlainText }} />
      </div>
    </MessagePrimitive.Root>
  )
}

/* 助手消息 */

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

/* 欢迎页 */

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

function ComposerActionMenu({ onClose }: { onClose: () => void }) {
  const [agentToolsOpen, setAgentToolsOpen] = useState(false)

  return (
    <div className='relative w-[300px]'>
      <div className='w-[300px] rounded-2xl border bg-background p-2 shadow-xl shadow-slate-900/10 dark:shadow-black/30'>
        <button
          type='button'
          className='flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors hover:bg-accent'
        >
          <Paperclip className='h-4 w-4 text-muted-foreground' />
          <span className='font-medium'>添加文件</span>
        </button>

        <div className='my-2 border-t' />

        <div className='space-y-1'>
          <ComposerToggleRow
            icon={Sparkles}
            label='意图识别'
            description='由 Agent 自动选择工具'
            checked
          />
          <ComposerToggleRow
            icon={UserCheck}
            label='人工复核'
            description='需要时保留审批节点'
          />
        </div>

        <div className='my-2 border-t' />

        <button
          type='button'
          aria-expanded={agentToolsOpen}
          onClick={() => setAgentToolsOpen((open) => !open)}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors ${
            agentToolsOpen ? 'bg-accent' : 'hover:bg-accent'
          }`}
        >
          <Puzzle className='h-4 w-4 text-muted-foreground' />
          <span className='flex-1 font-medium'>智能体工具</span>
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              agentToolsOpen ? 'rotate-90' : ''
            }`}
          />
        </button>
      </div>

      {agentToolsOpen && (
        <div className='absolute top-0 left-[calc(100%+1px)] z-40 w-[320px] rounded-2xl border bg-background p-3 shadow-xl shadow-slate-900/10 dark:shadow-black/30'>
          <p className='mb-2 px-2 text-[11px] text-muted-foreground'>
            {agentTools.length} 个可用工具
          </p>
          <div className='space-y-1'>
            {agentTools.map((tool) => {
              const Icon = tool.icon
              return (
                <ThreadPrimitive.Suggestion
                  key={tool.name}
                  prompt={tool.prompt}
                  autoSend
                  asChild
                >
                  <button
                    type='button'
                    onClick={onClose}
                    className='flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent'
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tool.iconClassName}`}
                    >
                      <Icon className='h-3.5 w-3.5' />
                    </span>
                    <span className='min-w-0'>
                      <span className='block truncate text-[13px] font-medium'>
                        {tool.label}
                      </span>
                      <span className='block truncate text-[11px] text-muted-foreground/60'>
                        {tool.description}
                      </span>
                    </span>
                  </button>
                </ThreadPrimitive.Suggestion>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ComposerToggleRow({
  icon: Icon,
  label,
  description,
  checked = false,
}: {
  icon: typeof Sparkles
  label: string
  description: string
  checked?: boolean
}) {
  return (
    <div className='flex items-center gap-2.5 rounded-xl px-3 py-1.5'>
      <Icon className='h-4 w-4 text-muted-foreground' />
      <span className='min-w-0 flex-1'>
        <span className='block text-xs font-medium'>{label}</span>
        <span className='block truncate text-[10px] text-muted-foreground/60'>
          {description}
        </span>
      </span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-emerald-600' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </span>
    </div>
  )
}

const agentTools = [
  {
    name: 'chronofact.list_evidence',
    label: '查询存证记录',
    description: '列出工作空间内的存证记录',
    prompt:
      '列出当前工作空间内的存证记录，并标出 proof missing 和 pending 项。',
    icon: List,
    iconClassName:
      'bg-emerald-50 text-emerald-600/80 dark:bg-emerald-950/30 dark:text-emerald-300/80',
  },
  {
    name: 'chronofact.verify_receipt',
    label: '核验回执',
    description: '检查摘要、回执和链上状态',
    prompt:
      '核验当前文件回执，区分 digest mismatch、proof unavailable 和链访问失败。',
    icon: ShieldCheck,
    iconClassName:
      'bg-sky-50 text-sky-600/75 dark:bg-sky-950/30 dark:text-sky-300/80',
  },
  {
    name: 'chronofact.get_trace',
    label: '版本链路',
    description: '追踪资产版本历史',
    prompt:
      '查询当前资产的版本链路，说明最新版本和 previous version 的关系。',
    icon: GitBranch,
    iconClassName:
      'bg-violet-50 text-violet-600/75 dark:bg-violet-950/30 dark:text-violet-300/80',
  },
  {
    name: 'chronofact.find_digest',
    label: '指纹查找',
    description: '通过 SHA-256 查找文件',
    prompt: '通过 SHA-256 指纹查找这个文件是否已经登记存证。',
    icon: Fingerprint,
    iconClassName:
      'bg-amber-50 text-amber-600/80 dark:bg-amber-950/30 dark:text-amber-300/80',
  },
  {
    name: 'chronofact.export_review_report',
    label: '导出报告',
    description: '生成带证明来源的报告',
    prompt:
      '生成一份复核报告，并为每条结论标明 digest、receipt、trace 或链上交易来源。',
    icon: FileText,
    iconClassName:
      'bg-slate-100 text-slate-600/75 dark:bg-slate-900/60 dark:text-slate-300/80',
  },
]

function WelcomeScreen() {
  return (
    <div className='flex h-full flex-col items-center justify-center px-6'>
      <ChronofactLogo size={56} className='mb-5' />
      <h2 className='text-xl font-semibold tracking-tight'>Chronofact</h2>
      <p className='mb-1.5 text-sm text-muted-foreground'>
        AI 驱动的证据治理智能体
      </p>
      <p className='mb-10 max-w-md text-center text-sm leading-relaxed text-muted-foreground/60'>
        查询存证记录、核验文件完整性、追踪版本链路、发现异常并生成报告。所有结论均标注证明来源。
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
