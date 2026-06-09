import { useRef, useState, type DragEvent } from 'react'
import {
  AlertTriangle,
  Blocks,
  CheckCircle2,
  Clock,
  Database,
  FileCheck,
  Hash,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

type UploadStatus = 'idle' | 'hashing' | 'ready' | 'preserving' | 'preserved' | 'error'

type SelectedFileState = {
  name: string
  size: number
  type: string
  sha256: string
}

type PreserveResult = {
  proof_id?: string
  status?: string
  proof?: {
    fact_id?: string
    receipt_id?: string
    anchor_status?: string
    verification_status?: string
    failure_reason?: string | null
  }
}

const apiBaseUrl = (
  import.meta.env.VITE_CHRONOFACT_API_BASE_URL ||
  import.meta.env.VITE_CHRONOFACT_API_URL ||
  'http://127.0.0.1:3001'
).replace(/\/+$/, '')

const organizationId =
  import.meta.env.VITE_CHRONOFACT_ORGANIZATION_ID || 'org_001'

const preserveSteps = [
  {
    label: '选择项目空间',
    description: `当前提交到组织空间 ${organizationId}`,
    icon: Blocks,
  },
  {
    label: '选择或拖拽文件',
    description: '浏览器本地读取文件，不把原始文件写入链上',
    icon: Upload,
  },
  {
    label: '计算 SHA-256',
    description: '使用 Web Crypto 在浏览器内生成稳定指纹',
    icon: Hash,
  },
  {
    label: '提交存证记录',
    description: '把文件名和 SHA-256 提交到 Chronofact API',
    icon: Database,
  },
]

export function EvidenceConsole() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<SelectedFileState | null>(null)
  const [preserveResult, setPreserveResult] = useState<PreserveResult | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return

    setStatus('hashing')
    setError(null)
    setPreserveResult(null)

    try {
      const sha256 = await calculateSha256(file)
      setSelectedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        sha256,
      })
      setStatus('ready')
    } catch (cause) {
      setSelectedFile(null)
      setStatus('error')
      setError(cause instanceof Error ? cause.message : '文件指纹计算失败')
    }
  }

  async function preserveFile() {
    if (!selectedFile) return

    setStatus('preserving')
    setError(null)

    try {
      const response = await fetch(
        `${apiBaseUrl}/organizations/${encodeURIComponent(organizationId)}/evidence/preserve`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            filename: selectedFile.name,
            asset_title: selectedFile.name,
            asset_type: 'agent_uploaded_file',
            sha256: selectedFile.sha256,
          }),
        }
      )
      const payload = (await response.json().catch(() => ({}))) as PreserveResult & {
        error?: { message?: string }
      }

      if (!response.ok) {
        throw new Error(payload.error?.message || `Chronofact API 返回 ${response.status}`)
      }

      setPreserveResult(payload)
      setStatus('preserved')
    } catch (cause) {
      setStatus('error')
      setError(cause instanceof Error ? cause.message : '提交存证失败')
    }
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDragging(false)
    void handleFile(event.dataTransfer.files[0])
  }

  return (
    <ScrollArea className='h-full min-h-0 w-full overflow-x-hidden'>
      <div className='min-w-0 overflow-x-hidden p-5 pb-24'>
        <p className='mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50'>
          存证模块
        </p>

        <div className='mb-5'>
          <p className='mb-2 text-xs font-medium text-muted-foreground'>工作空间</p>
          <div className='min-w-0 overflow-hidden rounded-xl border bg-emerald-50/35 p-4 dark:bg-emerald-950/10'>
            <div className='flex items-center gap-2.5'>
              <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/25'>
                <Blocks className='h-4 w-4 text-emerald-600/75 dark:text-emerald-300/70' />
              </div>
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium'>区块链实验报告材料</p>
                <p className='truncate font-mono text-xs text-muted-foreground/50'>
                  {organizationId}
                </p>
              </div>
            </div>
            <div className='mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-xs'>
              <span className='flex min-w-0 items-center gap-1.5 text-emerald-600/80 dark:text-emerald-300/75'>
                <span className='h-2 w-2 rounded-full bg-emerald-400/80' />
                本地指纹计算
              </span>
              <span className='flex min-w-0 items-center gap-1.5 text-amber-600/80 dark:text-amber-300/75'>
                <span className='h-2 w-2 rounded-full bg-amber-400/80' />
                <span className='min-w-0 truncate'>
                  API: {apiBaseUrl.replace(/^https?:\/\//, '')}
                </span>
              </span>
            </div>
          </div>
        </div>

        <Separator />

        <div className='my-5'>
          <p className='mb-2 text-xs font-medium text-muted-foreground'>文件上传与哈希</p>
          <button
            type='button'
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`flex w-full min-w-0 flex-col items-center overflow-hidden rounded-xl border border-dashed p-5 text-center transition ${
              isDragging
                ? 'border-blue-300 bg-blue-50/60 dark:border-blue-800/50 dark:bg-blue-950/20'
                : 'border-blue-100 bg-blue-50/20 hover:border-blue-200 hover:bg-blue-50/40 dark:border-blue-900/20 dark:bg-blue-950/10'
            }`}
          >
            <input
              ref={fileInputRef}
              type='file'
              className='hidden'
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <div className='mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20'>
              {status === 'hashing' ? (
                <Loader2 className='h-5 w-5 animate-spin text-blue-500/65 dark:text-blue-300/65' />
              ) : (
                <Upload className='h-5 w-5 text-blue-500/65 dark:text-blue-300/65' />
              )}
            </div>
            <p className='max-w-full break-words text-sm text-muted-foreground/80'>
              {selectedFile ? selectedFile.name : '点击选择文件，或拖拽文件到这里'}
            </p>
            <p className='mt-1 max-w-full break-words text-xs text-muted-foreground/45'>
              {selectedFile
                ? `${formatBytes(selectedFile.size)} · ${selectedFile.type}`
                : '选择后会立即计算 SHA-256 指纹'}
            </p>
            <StatusBadge status={status} className='mt-2.5' />
          </button>
        </div>

        <Separator />

        <div className='my-5'>
          <p className='mb-2 text-xs font-medium text-muted-foreground'>存证流程</p>
          <div className='space-y-2'>
            {preserveSteps.map((step) => {
              const Icon = step.icon
              return (
                <div key={step.label} className='flex min-w-0 items-start gap-3 overflow-hidden rounded-xl border bg-background/60 p-3'>
                  <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted'>
                    <Icon className='h-4 w-4 text-muted-foreground' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium'>{step.label}</p>
                    <p className='text-xs leading-5 text-muted-foreground/60'>{step.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <Separator />

        <div className='my-5 rounded-xl border bg-background/60 p-4'>
          <div className='mb-3 flex items-center gap-2'>
            <FileCheck className='h-4 w-4 text-muted-foreground' />
            <p className='text-sm font-medium'>本次文件状态</p>
          </div>
          <div className='min-w-0 space-y-2 text-xs text-muted-foreground/70'>
            <StatusRow label='文件' value={selectedFile?.name ?? '未选择'} />
            <StatusRow
              label='SHA-256'
              value={selectedFile?.sha256 ?? '等待计算'}
              monospace
            />
            <StatusRow
              label='proof'
              value={preserveResult?.proof_id ?? '尚未提交'}
              monospace
            />
            <StatusRow
              label='anchor'
              value={preserveResult?.proof?.anchor_status ?? '无'}
            />
          </div>

          <Button
            type='button'
            className='mt-4 w-full'
            disabled={!selectedFile || status === 'hashing' || status === 'preserving'}
            onClick={() => void preserveFile()}
          >
            {status === 'preserving' && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            提交存证
          </Button>

          {error && (
            <div className='mt-3 rounded-lg border border-rose-200/60 bg-rose-50/60 p-3 text-xs leading-relaxed text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300'>
              {error}
            </div>
          )}
        </div>

        <div className='rounded-xl border border-amber-200/40 bg-amber-50/40 p-4 dark:border-amber-900/20 dark:bg-amber-950/10'>
          <div className='flex items-start gap-2.5'>
            <Clock className='mt-0.5 h-4 w-4 shrink-0 text-amber-500/50' />
            <div className='text-xs leading-relaxed text-amber-800/60 dark:text-amber-300/60'>
              <p className='font-medium text-amber-800/80 dark:text-amber-300/80'>实现说明</p>
              <p className='mt-1'>
                当前版本先实现原生文件选择、拖拽和 SHA-256 计算。Uppy 可以在后续替换上传入口，但指纹状态和存证提交逻辑可以继续复用。
              </p>
            </div>
          </div>
        </div>

        <div className='mt-3 rounded-xl border border-muted bg-muted/30 p-4'>
          <div className='flex items-start gap-2.5'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60' />
            <p className='text-xs leading-relaxed text-muted-foreground/70'>
              AI 解释不构成真实性证明。证明来源为 SHA-256 指纹、结构化回执、trace 与链上记录。
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>
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

function StatusBadge({
  status,
  className,
}: {
  status: UploadStatus
  className?: string
}) {
  const config = {
    idle: { label: '待选择', icon: Clock },
    hashing: { label: '计算中', icon: Loader2 },
    ready: { label: '可提交', icon: Hash },
    preserving: { label: '提交中', icon: Loader2 },
    preserved: { label: '已存证', icon: CheckCircle2 },
    error: { label: '失败', icon: XCircle },
  } satisfies Record<UploadStatus, { label: string; icon: typeof Clock }>
  const Icon = config[status].icon

  return (
    <Badge variant='secondary' className={`text-xs font-normal ${className ?? ''}`}>
      <Icon className={`mr-1 h-3 w-3 ${status === 'hashing' || status === 'preserving' ? 'animate-spin' : ''}`} />
      {config[status].label}
    </Badge>
  )
}

async function calculateSha256(file: File) {
  if (!window.crypto?.subtle) {
    throw new Error('当前浏览器不支持 Web Crypto，无法计算 SHA-256')
  }

  const buffer = await file.arrayBuffer()
  const digest = await window.crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}
