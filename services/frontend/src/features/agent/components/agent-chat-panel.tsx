import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useDropzone } from 'react-dropzone'
import ReactMarkdown from 'react-markdown'
import {
  SendHorizontal,
  ArrowDown,
  Search,
  GitBranch,
  FileText,
  AlertTriangle,
  ChevronRight,
  Fingerprint,
  List,
  Plus,
  Puzzle,
  ShieldCheck,
  Paperclip,
  Sparkles,
  UserCheck,
  X,
  Loader2,
  CheckCircle2,
  FileUp,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type {
  AgentActionRequired,
  AgentFileContext,
  AgentMessage,
  AgentToolCall,
} from '../agent-api'
import { ChronofactLogo, ChronofactMark } from './chronofact-logo'

export function AgentChatPanel({
  messages,
  files,
  toolCalls,
  loading,
  sending,
  onSend,
  onConfirmPreserve,
}: {
  messages: AgentMessage[]
  files: AgentFileContext[]
  toolCalls: AgentToolCall[]
  loading: boolean
  sending: boolean
  onSend: (input: { message: string; file?: File | null }) => void
  onConfirmPreserve: (action: AgentActionRequired) => void
}) {
  const [message, setMessage] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const dragDepthRef = useRef(0)
  const [showDropOverlay, setShowDropOverlay] = useState(false)
  const resetDropOverlay = useCallback(() => {
    dragDepthRef.current = 0
    setShowDropOverlay(false)
  }, [])
  const {
    getRootProps,
    getInputProps,
    open,
  } = useDropzone({
    multiple: false,
    noClick: true,
    onDrop: (acceptedFiles) => {
      resetDropOverlay()
      const file = acceptedFiles[0]
      if (file) setPendingFile(file)
    },
  })

  useEffect(() => {
    window.addEventListener('drop', resetDropOverlay, true)
    window.addEventListener('dragend', resetDropOverlay, true)
    window.addEventListener('blur', resetDropOverlay)
    return () => {
      window.removeEventListener('drop', resetDropOverlay, true)
      window.removeEventListener('dragend', resetDropOverlay, true)
      window.removeEventListener('blur', resetDropOverlay)
    }
  }, [resetDropOverlay])

  function submit() {
    const text = message.trim()
    if (!text && !pendingFile) return
    onSend({
      message: text || '这个文件怎么样，有没有存证？',
      file: pendingFile,
    })
    setMessage('')
    setPendingFile(null)
  }

  function applyToolPrompt(prompt: string) {
    setMessage(prompt)
    setToolsOpen(false)
  }

  return (
    <div
      {...getRootProps({
        className: `relative flex h-full flex-col ${showDropOverlay ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''}`,
        onDragEnter: (event) => {
          if (!hasDraggedFiles(event)) return
          dragDepthRef.current += 1
          setShowDropOverlay(true)
        },
        onDragLeave: (event) => {
          if (!hasDraggedFiles(event)) return
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
          if (dragDepthRef.current === 0) setShowDropOverlay(false)
        },
        onDrop: resetDropOverlay,
        onKeyDown: (event) => {
          if (event.key === 'Escape') resetDropOverlay()
        },
      })}
    >
      <input {...getInputProps()} />
      <div className='flex-1 overflow-y-auto'>
        {loading ? (
          <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
            正在恢复会话...
          </div>
        ) : messages.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <div className='mx-auto max-w-[800px] px-6 py-6'>
            {messages.map((item) => (
              <ConversationMessage
                key={item.message_id}
                message={item}
                file={files.find((file) => file.file_id === item.metadata?.file_id)}
                toolCalls={toolCalls.filter((call) =>
                  item.metadata?.tool_call_ids?.includes(call.tool_call_id)
                )}
                onConfirmPreserve={onConfirmPreserve}
              />
            ))}
            {sending && !messages.some((item) => item.status === 'running') && <AssistantThinking />}
          </div>
        )}
      </div>

      <Button
        variant='outline'
        size='icon'
        className='absolute bottom-36 left-1/2 z-10 h-9 w-9 -translate-x-1/2 rounded-full shadow-sm'
        onClick={() => {
          const scroller = document.querySelector('[data-agent-scroll]')
          scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
        }}
      >
        <ArrowDown className='h-4 w-4' />
      </Button>

      <div className='border-t px-6 pb-6 pt-4'>
        <div className='relative mx-auto max-w-[800px]'>
          {pendingFile && (
            <div className='mb-2 flex max-w-full items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3 py-2 text-sm'>
              <span className='flex min-w-0 items-center gap-2'>
                <FileUp className='h-4 w-4 shrink-0 text-emerald-600/70' />
                <span className='truncate'>{pendingFile.name}</span>
                <span className='shrink-0 text-xs text-muted-foreground'>
                  {formatBytes(pendingFile.size)}
                </span>
              </span>
              <Button
                variant='ghost'
                size='icon'
                className='h-7 w-7 shrink-0'
                onClick={() => setPendingFile(null)}
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
          )}

          {toolsOpen && (
            <div className='absolute bottom-[calc(100%+0.75rem)] left-0 z-30'>
              <ComposerActionMenu
                onAttachFile={() => {
                  open()
                  setToolsOpen(false)
                }}
                onSelectPrompt={applyToolPrompt}
              />
            </div>
          )}

          <div className='flex items-end gap-2 rounded-2xl border bg-background px-4 py-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/20'>
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
            <textarea
              placeholder='把文件拖进来，然后问：这个文件怎么样？有没有存证？'
              className='min-h-[44px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed focus:outline-none'
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  submit()
                }
              }}
              autoFocus
            />
            <Button
              size='icon'
              className='h-9 w-9 shrink-0 rounded-xl bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-800 dark:hover:bg-emerald-700'
              aria-label='发送消息'
              disabled={sending || (!message.trim() && !pendingFile)}
              onClick={submit}
            >
              {sending ? <Loader2 className='h-4 w-4 animate-spin' /> : <SendHorizontal className='h-4 w-4' />}
            </Button>
          </div>
          <p className='mt-2 text-center text-xs text-muted-foreground/40'>
            AI 只解释结果；证明来自文件指纹、结构化回执和链上记录
          </p>
        </div>
      </div>

      {showDropOverlay && (
        <div className='pointer-events-none absolute inset-4 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/70 text-sm font-medium text-emerald-700 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'>
          松开后把文件加入本轮对话
        </div>
      )}
    </div>
  )
}

function hasDraggedFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes('Files')
}

function ConversationMessage({
  message,
  file,
  toolCalls,
  onConfirmPreserve,
}: {
  message: AgentMessage
  file?: AgentFileContext
  toolCalls: AgentToolCall[]
  onConfirmPreserve: (action: AgentActionRequired) => void
}) {
  if (message.role === 'user') {
    return (
      <div className='flex justify-end py-3'>
        <div className='max-w-[75%] rounded-2xl rounded-br-md bg-emerald-700 px-5 py-3 text-[15px] leading-relaxed text-white dark:bg-emerald-800'>
          {file && <MessageFilePill file={file} tone='dark' />}
          <div className='whitespace-pre-wrap'>{message.content}</div>
        </div>
      </div>
    )
  }

  const actionRequired = message.metadata?.action_required
  const isRunning = message.status === 'running'

  return (
    <div className='flex gap-3 py-3'>
      <div className='mt-1 flex h-7 w-7 shrink-0 items-center justify-center'>
        <ChronofactMark size={22} />
      </div>
      <div className='min-w-0 flex-1'>
        <p className='mb-1 text-xs font-medium text-emerald-700 dark:text-emerald-400'>
          Chronofact
        </p>
        <div className='space-y-3 text-[15px] leading-relaxed text-foreground/90'>
          {file && <MessageFilePill file={file} />}
          {toolCalls.length > 0 && <ReadableToolSteps toolCalls={toolCalls} />}
          {isRunning ? (
            <div className='flex items-center gap-2 rounded-2xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' />
              {message.content || '正在检查文件和存证记录...'}
            </div>
          ) : (
            <MarkdownMessage content={message.content} />
          )}
          {actionRequired?.type === 'confirm_preserve' && !file?.proof_id && (
            <Button
              className='rounded-xl bg-emerald-700 hover:bg-emerald-600'
              onClick={() => onConfirmPreserve(actionRequired)}
            >
              <ShieldCheck className='mr-2 h-4 w-4' />
              {actionRequired.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className='mb-2 last:mb-0'>{children}</p>,
        ul: ({ children }) => <ul className='my-2 list-disc space-y-1 pl-5'>{children}</ul>,
        ol: ({ children }) => <ol className='my-2 list-decimal space-y-1 pl-5'>{children}</ol>,
        li: ({ children }) => <li className='pl-1'>{children}</li>,
        strong: ({ children }) => <strong className='font-semibold'>{children}</strong>,
        code: ({ children }) => (
          <code className='rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]'>
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function MessageFilePill({
  file,
  tone = 'light',
}: {
  file: AgentFileContext
  tone?: 'light' | 'dark'
}) {
  return (
    <div
      className={`mb-2 rounded-xl border px-3 py-2 text-xs ${
        tone === 'dark'
          ? 'border-white/20 bg-white/10 text-white/90'
          : 'border-border bg-muted/40 text-muted-foreground'
      }`}
    >
      <div className='flex min-w-0 items-center gap-2'>
        <FileText className='h-3.5 w-3.5 shrink-0' />
        <span className='truncate font-medium'>{file.filename}</span>
        <span className='shrink-0'>{formatBytes(file.size)}</span>
      </div>
      <div className='mt-1 break-all font-mono opacity-75'>
        {shortSha(file.sha256)}
      </div>
    </div>
  )
}

function ReadableToolSteps({ toolCalls }: { toolCalls: AgentToolCall[] }) {
  return (
    <div className='space-y-1.5 rounded-xl border bg-muted/30 p-3'>
      {toolCalls.map((call) => (
        <div key={call.tool_call_id} className='flex items-center gap-2 text-sm'>
          <CheckCircle2 className='h-4 w-4 shrink-0 text-emerald-600/70' />
          <span>{toolLabel(call.tool_name, call.output)}</span>
        </div>
      ))}
    </div>
  )
}

function AssistantThinking() {
  return (
    <div className='flex gap-3 py-3'>
      <div className='mt-1 flex h-7 w-7 shrink-0 items-center justify-center'>
        <ChronofactMark size={22} />
      </div>
      <div className='flex items-center gap-2 rounded-2xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground'>
        <Loader2 className='h-4 w-4 animate-spin' />
        正在检查文件和存证记录...
      </div>
    </div>
  )
}

const quickActions = [
  {
    icon: ShieldCheck,
    label: '检查文件有没有存证',
    prompt: '这个文件怎么样，有没有存证？',
  },
  {
    icon: AlertTriangle,
    label: '看有没有问题',
    prompt: '这个文件有什么问题吗？',
  },
  {
    icon: Search,
    label: '验证文件',
    prompt: '验证这个文件',
  },
  {
    icon: GitBranch,
    label: '说明下一步',
    prompt: '如果文件不一致，我下一步该怎么办？',
  },
  {
    icon: FileText,
    label: '帮我存证',
    prompt: '帮我存证这个文件',
  },
]

function ComposerActionMenu({
  onAttachFile,
  onSelectPrompt,
}: {
  onAttachFile: () => void
  onSelectPrompt: (prompt: string) => void
}) {
  const [agentToolsOpen, setAgentToolsOpen] = useState(false)

  return (
    <div className='relative w-[300px]'>
      <div className='w-[300px] rounded-2xl border bg-background p-2 shadow-xl shadow-slate-900/10 dark:shadow-black/30'>
        <button
          type='button'
          className='flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors hover:bg-accent'
          onClick={onAttachFile}
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
        <div className='absolute left-[calc(100%+1px)] top-0 z-40 w-[320px] rounded-2xl border bg-background p-3 shadow-xl shadow-slate-900/10 dark:shadow-black/30'>
          <p className='mb-2 px-2 text-[11px] text-muted-foreground'>
            {agentTools.length} 个可用工具
          </p>
          <div className='space-y-1'>
            {agentTools.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.name}
                  type='button'
                  onClick={() => onSelectPrompt(tool.prompt)}
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
  icon: LucideIcon
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
    prompt: '查询当前资产的版本链路，说明最新版本和 previous version 的关系。',
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
] satisfies Array<{
  name: string
  label: string
  description: string
  prompt: string
  icon: LucideIcon
  iconClassName: string
}>

function WelcomeScreen() {
  return (
    <div className='flex h-full flex-col items-center justify-center px-6'>
      <ChronofactLogo size={56} className='mb-5' />
      <h2 className='text-xl font-semibold tracking-tight'>
        Chronofact
      </h2>
      <p className='mb-1.5 text-sm text-muted-foreground'>
        把文件拖进来，直接问它有没有问题
      </p>
      <p className='mb-10 max-w-md text-center text-sm leading-relaxed text-muted-foreground/60'>
        我会读取文件指纹，查询存证记录，必要时提交存证或验证是否一致。你不用理解区块链细节。
      </p>

      <div className='grid w-full max-w-xl grid-cols-2 gap-2.5 sm:grid-cols-3'>
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.prompt}
              className='flex items-start gap-2.5 rounded-xl border p-3.5 text-left transition-colors hover:bg-accent'
              type='button'
              disabled
            >
              <Icon className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
              <span className='text-sm leading-snug text-foreground/70'>
                {action.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function toolLabel(toolName: string, output: Record<string, unknown> | null) {
  if (toolName === 'uploadFileContext') return '已读取文件并计算指纹'
  if (toolName === 'preserveEvidence') return '已提交存证记录'
  if (toolName === 'preserveEvidenceVersion') return '已提交为新版本'
  if (toolName === 'verifyEvidence') {
    const result = output?.result ?? output?.status
    if (output?.agent_classification === 'version_candidate') {
      return '发现已有文档，当前文件可作为新版本'
    }
    if (result === 'preserved') return '已确认文件和存证版本一致'
    if (result === 'mismatch') return '已发现文件和存证版本不一致'
    if (result === 'not_preserved') return '没有找到这份文件的存证记录'
    return '已检查存证记录'
  }
  if (toolName === 'explainEvidence') return '已整理风险说明'
  return '已完成一步检查'
}

function shortSha(sha256?: string) {
  if (!sha256) return ''
  return `${sha256.slice(0, 10)}...${sha256.slice(-6)}`
}

function formatBytes(bytes?: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}
