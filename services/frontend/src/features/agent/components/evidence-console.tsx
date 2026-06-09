import { useDropzone } from 'react-dropzone'
import {
  AlertTriangle,
  Blocks,
  CheckCircle2,
  FileCheck,
  Loader2,
  Upload,
  XCircle,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type {
  AgentActionRequired,
  AgentConversationDetail,
  AgentFileContext,
  AgentToolCall,
} from '../agent-api'
import { getAgentApiBaseUrl } from '../agent-api'

export function EvidenceConsole({
  detail,
  selectedFileId,
  busy,
  pendingAction,
  onSelectFile,
  onUploadFile,
  onConfirmPreserve,
}: {
  detail: AgentConversationDetail | null
  selectedFileId: string | null
  busy: boolean
  pendingAction: AgentActionRequired | null
  onSelectFile: (fileId: string) => void
  onUploadFile: (file: File) => void
  onConfirmPreserve: (action: AgentActionRequired) => void
}) {
  const {
    getRootProps,
    getInputProps,
    open,
    isDragActive,
  } = useDropzone({
    multiple: false,
    noClick: true,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (file) onUploadFile(file)
    },
  })
  const selectedFile =
    detail?.files.find((file) => file.file_id === selectedFileId) ??
    detail?.current_file ??
    null
  const proofSnapshot = latestProofForFile(detail, selectedFile?.file_id)
  const relatedToolCalls = relatedTools(detail?.tool_calls ?? [], selectedFile)

  return (
    <ScrollArea className='h-full min-h-0 w-full overflow-x-hidden'>
      <div className='min-w-0 overflow-x-hidden p-5 pb-24'>
        <p className='mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50'>
          文件与证明
        </p>

        <div className='mb-5'>
          <p className='mb-2 text-xs font-medium text-muted-foreground'>工作空间</p>
          <div className='min-w-0 overflow-hidden rounded-xl border bg-emerald-50/35 p-4 dark:bg-emerald-950/10'>
            <div className='flex items-center gap-2.5'>
              <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/25'>
                <Blocks className='h-4 w-4 text-emerald-600/75 dark:text-emerald-300/70' />
              </div>
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium'>Chronofact 演示空间</p>
                <p className='truncate font-mono text-xs text-muted-foreground/50'>
                  org_001
                </p>
              </div>
            </div>
            <div className='mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-xs'>
              <span className='flex min-w-0 items-center gap-1.5 text-emerald-600/80 dark:text-emerald-300/75'>
                <span className='h-2 w-2 rounded-full bg-emerald-400/80' />
                后端会话状态
              </span>
              <span className='flex min-w-0 items-center gap-1.5 text-amber-600/80 dark:text-amber-300/75'>
                <span className='h-2 w-2 rounded-full bg-amber-400/80' />
                <span className='min-w-0 truncate'>
                  Agent: {getAgentApiBaseUrl().replace(/^https?:\/\//, '')}
                </span>
              </span>
            </div>
          </div>
        </div>

        <Separator />

        <div className='my-5'>
          <p className='mb-2 text-xs font-medium text-muted-foreground'>上传入口</p>
          <button
            {...getRootProps({
              type: 'button',
              onClick: open,
              className: `flex w-full min-w-0 flex-col items-center overflow-hidden rounded-xl border border-dashed p-5 text-center transition ${
                isDragActive
                  ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
                  : 'border-blue-100 bg-blue-50/20 hover:border-blue-200 hover:bg-blue-50/40 dark:border-blue-900/20 dark:bg-blue-950/10'
              }`,
            })}
          >
            <input {...getInputProps()} />
            <div className='mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20'>
              {busy ? (
                <Loader2 className='h-5 w-5 animate-spin text-blue-500/65 dark:text-blue-300/65' />
              ) : (
                <Upload className='h-5 w-5 text-blue-500/65 dark:text-blue-300/65' />
              )}
            </div>
            <p className='max-w-full break-words text-sm text-muted-foreground/80'>
              也可以把文件直接拖进中间对话框
            </p>
            <p className='mt-1 max-w-full break-words text-xs text-muted-foreground/45'>
              文件进入 Agent 上下文后才会被验证或存证
            </p>
          </button>
        </div>

        <Separator />

        <div className='my-5'>
          <p className='mb-2 text-xs font-medium text-muted-foreground'>当前文件</p>
          {selectedFile ? (
            <div className='rounded-xl border bg-background/60 p-4'>
              <div className='mb-3 flex items-center gap-2'>
                <FileCheck className='h-4 w-4 text-muted-foreground' />
                <p className='min-w-0 truncate text-sm font-medium'>{selectedFile.filename}</p>
              </div>
              <div className='min-w-0 space-y-2 text-xs text-muted-foreground/70'>
                <StatusRow label='文件ID' value={selectedFile.file_id} monospace />
                <StatusRow label='大小' value={formatBytes(selectedFile.size)} />
                <StatusRow label='SHA-256' value={selectedFile.sha256} monospace />
                <StatusRow label='proof' value={selectedFile.proof_id ?? proofSnapshot?.proof_id ?? '尚未存证'} monospace />
                <StatusRow label='anchor' value={anchorStatus(proofSnapshot)} />
              </div>
              {pendingAction?.file_id === selectedFile.file_id && (
                <Button
                  type='button'
                  className='mt-4 w-full bg-emerald-700 hover:bg-emerald-600'
                  onClick={() => onConfirmPreserve(pendingAction)}
                  disabled={busy}
                >
                  {busy ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <ShieldCheck className='mr-2 h-4 w-4' />}
                  确认存证
                </Button>
              )}
            </div>
          ) : (
            <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground/70'>
              还没有文件。把文件拖进对话框，然后直接问它有没有存证。
            </div>
          )}
        </div>

        {detail?.files.length ? (
          <>
            <Separator />
            <div className='my-5'>
              <p className='mb-2 text-xs font-medium text-muted-foreground'>本会话文件</p>
              <div className='space-y-2'>
                {detail.files.map((file) => (
                  <button
                    key={file.file_id}
                    type='button'
                    onClick={() => onSelectFile(file.file_id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition hover:bg-accent ${
                      selectedFile?.file_id === file.file_id ? 'bg-accent' : 'bg-background/60'
                    }`}
                  >
                    <span className='block truncate font-medium'>{file.filename}</span>
                    <span className='mt-1 block break-all font-mono text-xs text-muted-foreground/55'>
                      {shortSha(file.sha256)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        <Separator />

        <div className='my-5'>
          <p className='mb-2 text-xs font-medium text-muted-foreground'>系统为你做了什么</p>
          {relatedToolCalls.length === 0 ? (
            <div className='rounded-xl border border-dashed p-4 text-xs leading-relaxed text-muted-foreground/65'>
              还没有检查步骤。发送问题后，这里会显示读取文件、查询存证、验证结果等步骤。
            </div>
          ) : (
            <div className='space-y-2'>
              {relatedToolCalls.map((call) => (
                <ToolStep key={call.tool_call_id} call={call} />
              ))}
            </div>
          )}
        </div>

        <div className='mt-3 rounded-xl border border-muted bg-muted/30 p-4'>
          <div className='flex items-start gap-2.5'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60' />
            <p className='text-xs leading-relaxed text-muted-foreground/70'>
              AI 只负责解释结果，不证明文件内容真实。可信结论来自文件指纹、存证记录和验证结果。
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}

function ToolStep({ call }: { call: AgentToolCall }) {
  const ok = call.status === 'completed'
  return (
    <details className='rounded-xl border bg-background/60 p-3 text-sm'>
      <summary className='flex cursor-pointer list-none items-center gap-2'>
        {ok ? (
          <CheckCircle2 className='h-4 w-4 shrink-0 text-emerald-600/70' />
        ) : (
          <XCircle className='h-4 w-4 shrink-0 text-rose-600/70' />
        )}
        <span className='min-w-0 flex-1 truncate'>{toolLabel(call)}</span>
        <Badge variant='secondary' className='text-xs font-normal'>
          {ok ? '完成' : '失败'}
        </Badge>
      </summary>
      <pre className='mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground'>
        {JSON.stringify({ input: call.input, output: call.output }, null, 2)}
      </pre>
    </details>
  )
}

function StatusRow({
  label,
  value,
  monospace = false,
}: {
  label: string
  value: string
  monospace?: boolean
}) {
  return (
    <div className='grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-3'>
      <span>{label}</span>
      <span className={`min-w-0 break-all text-right ${monospace ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function relatedTools(toolCalls: AgentToolCall[], file: AgentFileContext | null) {
  if (!file) return toolCalls.slice(-6)
  return toolCalls.filter((call) => {
    const input = call.input || {}
    const output = call.output || {}
    return (
      input.file_id === file.file_id ||
      output.file_id === file.file_id ||
      input.sha256 === file.sha256 ||
      output.sha256 === file.sha256
    )
  }).slice(-8)
}

function latestProofForFile(detail: AgentConversationDetail | null, fileId?: string | null) {
  if (!detail || !fileId) return null
  return [...detail.proof_snapshots].reverse().find((snapshot) => snapshot.file_id === fileId) ?? null
}

function anchorStatus(snapshot: ReturnType<typeof latestProofForFile>) {
  const proof = snapshot?.snapshot?.proof as Record<string, unknown> | undefined
  return String(proof?.anchor_status ?? proof?.anchorStatus ?? '无')
}

function toolLabel(call: AgentToolCall) {
  if (call.tool_name === 'uploadFileContext') return '读取文件并计算指纹'
  if (call.tool_name === 'preserveEvidence') return '提交文件存证'
  if (call.tool_name === 'preserveEvidenceVersion') return '提交为新版本存证'
  if (call.tool_name === 'verifyEvidence') {
    const result = call.output?.result ?? call.output?.status
    if (call.output?.agent_classification === 'possible_new_version') {
      return '检查结果：发现旧版本，可作为新版本'
    }
    if (result === 'preserved') return '检查结果：文件和存证版本一致'
    if (result === 'mismatch') return '检查结果：文件和存证版本不一致'
    if (result === 'not_preserved') return '检查结果：没有找到存证'
    return '检查文件存证状态'
  }
  if (call.tool_name === 'explainEvidence') return '整理风险说明和下一步建议'
  return '完成系统检查'
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
