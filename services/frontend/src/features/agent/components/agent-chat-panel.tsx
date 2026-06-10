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
  ShieldCheck,
  Paperclip,
  X,
  Loader2,
  CheckCircle2,
  FileUp,
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
  const dragDepthRef = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
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

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToBottom(scrollContainerRef.current, messages.length > 0 ? 'smooth' : 'auto')
    })
  }, [messages, sending])

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
      <div ref={scrollContainerRef} data-agent-scroll className='flex-1 overflow-y-auto'>
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
          scrollToBottom(scrollContainerRef.current, 'smooth')
        }}
      >
        <ArrowDown className='h-4 w-4' />
      </Button>

      <div className='border-t px-6 pb-6 pt-4'>
        <div className='mx-auto max-w-[800px]'>
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

          <div className='flex items-end gap-2 rounded-2xl border bg-background px-4 py-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/20'>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-9 w-9 shrink-0 rounded-xl'
              aria-label='添加文件'
              onClick={open}
            >
              <Paperclip className='h-4 w-4' />
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

function scrollToBottom(scroller: HTMLDivElement | null, behavior: ScrollBehavior) {
  if (!scroller) return
  scroller.scrollTo({ top: scroller.scrollHeight, behavior })
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
