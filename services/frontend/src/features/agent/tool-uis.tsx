import { makeAssistantToolUI } from '@assistant-ui/react'
import {
  Clock,
  AlertTriangle,
  WifiOff,
  Link as LinkIcon,
  Search,
  FileText,
  GitBranch,
  List,
  Loader2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

/* ── 共用组件 ── */

type AnchorStatus = 'recorded' | 'pending' | 'missing' | 'unavailable'

const anchorConfig: Record<AnchorStatus, { label: string; icon: LucideIcon }> = {
  recorded: { label: '已上链', icon: LinkIcon },
  pending: { label: '待确认', icon: Clock },
  missing: { label: '未上链', icon: AlertTriangle },
  unavailable: { label: '不可达', icon: WifiOff },
}

function AnchorBadge({ status }: { status?: string }) {
  const s = (status as AnchorStatus) ?? 'missing'
  const c = anchorConfig[s]
  const Icon = c.icon
  const colorMap: Record<AnchorStatus, string> = {
    recorded: 'bg-emerald-50/60 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900',
    pending: 'bg-amber-50/60 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900',
    missing: 'bg-rose-50/60 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900',
    unavailable: 'bg-slate-50/60 text-slate-500 border-slate-100 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${colorMap[s]}`}>
      <Icon className='h-3 w-3' />
      {c.label}
    </span>
  )
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    verified: 'bg-emerald-50/60 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900',
    pending: 'bg-amber-50/60 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900',
    failed: 'bg-rose-50/60 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900',
  }
  const labelMap: Record<string, string> = { verified: '已核验', pending: '待处理', failed: '失败' }
  const cls = map[status ?? ''] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${cls}`}>
      {labelMap[status ?? ''] ?? status ?? '—'}
    </span>
  )
}

function ToolLoading({ label }: { label: string }) {
  return (
    <div className='my-3 flex items-center gap-2.5 rounded-xl border border-dashed px-4 py-3'>
      <Loader2 className='h-4 w-4 animate-spin text-emerald-600/50' />
      <span className='text-sm text-muted-foreground'>{label}...</span>
    </div>
  )
}

function ToolCard({ icon: Icon, title, color, children }: { icon: LucideIcon; title: string; color?: string; children: ReactNode }) {
  return (
    <div className='my-3 overflow-hidden rounded-xl border'>
      <div className='flex items-center gap-2.5 border-b bg-muted/40 px-4 py-2.5'>
        <Icon className={`h-4 w-4 ${color ?? 'text-muted-foreground/60'}`} />
        <span className='text-sm font-medium'>{title}</span>
      </div>
      <div className='px-4 py-3'>{children}</div>
    </div>
  )
}

/* ═══ 1. list_evidence ═══ */

export const ListEvidenceToolUI = makeAssistantToolUI<
  { workspace_id?: string },
  { records: Array<Record<string, unknown>>; total: number }
>({
  toolName: 'chronofact.list_evidence',
  render: ({ result, status }) => {
    if (status.type === 'running') return <ToolLoading label='查询存证记录' />
    const records = result?.records ?? []
    return (
      <ToolCard icon={List} title={`存证记录 · ${result?.total ?? 0} 条`} color='text-muted-foreground'>
        <div className='space-y-2'>
          {records.map((r, i) => (
            <div key={i} className='flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2'>
              <div>
                <p className='font-mono text-xs text-foreground/70'>{String(r.preservation_id)}</p>
                <p className='font-mono text-xs text-muted-foreground/50'>{String(r.sha256)}</p>
              </div>
              <div className='flex items-center gap-1.5'>
                <StatusBadge status={String(r.status)} />
                <AnchorBadge status={String(r.anchor_status)} />
              </div>
            </div>
          ))}
        </div>
      </ToolCard>
    )
  },
})

/* ═══ 2. verify_receipt ═══ */

export const VerifyReceiptToolUI = makeAssistantToolUI<
  { version_id?: string },
  Record<string, unknown>
>({
  toolName: 'chronofact.verify_receipt',
  render: ({ result, status }) => {
    if (status.type === 'running') return <ToolLoading label='核验回执' />
    return (
      <ToolCard icon={ShieldCheck} title='核验结果' color='text-muted-foreground'>
        <div className='grid grid-cols-2 gap-x-6 gap-y-2 text-sm'>
          <div>
            <span className='text-muted-foreground'>摘要匹配</span>
            <span className='ml-2 font-medium'>{result?.digest_match ? '✓ 一致' : '✗ 不一致'}</span>
          </div>
          <div>
            <span className='text-muted-foreground'>回执状态</span>
            <span className='ml-2'>{String(result?.receipt_status ?? '—')}</span>
          </div>
          <div>
            <span className='text-muted-foreground'>事实ID</span>
            <span className='ml-2 font-mono text-xs'>{String(result?.fact_id ?? '—')}</span>
          </div>
          <div>
            <span className='text-muted-foreground'>交易哈希</span>
            <span className='ml-2 font-mono text-xs'>{String(result?.tx_hash ?? '—')}</span>
          </div>
        </div>
        <div className='mt-3 flex gap-2'>
          <StatusBadge status={String(result?.status)} />
          <AnchorBadge status={String(result?.anchor_status)} />
        </div>
      </ToolCard>
    )
  },
})

/* ═══ 3. get_trace ═══ */

export const GetTraceToolUI = makeAssistantToolUI<
  { asset_id?: string },
  { asset_id: string; versions: Array<Record<string, unknown>> }
>({
  toolName: 'chronofact.get_trace',
  render: ({ result, status }) => {
    if (status.type === 'running') return <ToolLoading label='追踪版本链' />
    const versions = result?.versions ?? []
    return (
      <ToolCard icon={GitBranch} title={`版本链路 · ${result?.asset_id ?? ''}`} color='text-muted-foreground'>
        <div className='relative space-y-3 pl-4'>
          <div className='absolute bottom-1 left-[5px] top-1 w-px bg-border' />
          {versions.map((v, i) => (
            <div key={i} className='relative flex items-start gap-2.5'>
              <div className='absolute -left-2.5 top-2 h-2 w-2 rounded-full bg-emerald-600 ring-2 ring-background' />
              <div className='pl-1 text-sm'>
                <span className='font-medium'>v{String(v.version_no)}</span>
                <span className='ml-2'><StatusBadge status={String(v.status)} /></span>
                <p className='font-mono text-xs text-muted-foreground/50'>{String(v.sha256)}</p>
              </div>
            </div>
          ))}
        </div>
      </ToolCard>
    )
  },
})

/* ═══ 4. find_digest ═══ */

export const FindDigestToolUI = makeAssistantToolUI<
  { sha256?: string },
  { sha256: string; matches: Array<Record<string, unknown>> }
>({
  toolName: 'chronofact.find_digest',
  render: ({ args, result, status }) => {
    if (status.type === 'running') return <ToolLoading label='查找指纹' />
    const matches = result?.matches ?? []
    return (
      <ToolCard icon={Search} title='指纹查找' color='text-muted-foreground'>
        <p className='mb-2 font-mono text-xs text-muted-foreground/50'>SHA-256: {args.sha256}</p>
        {matches.length === 0 ? (
          <p className='text-sm text-muted-foreground'>未找到匹配记录</p>
        ) : (
          <div className='space-y-2'>
            {matches.map((m, i) => (
              <div key={i} className='rounded-lg bg-muted/40 px-3 py-2 text-sm'>
                <p className='font-medium'>{String(m.filename)}</p>
                <p className='font-mono text-xs text-muted-foreground/50'>
                  {String(m.asset_id)} / {String(m.version_id)}
                </p>
                <StatusBadge status={String(m.status)} />
              </div>
            ))}
          </div>
        )}
      </ToolCard>
    )
  },
})

/* ═══ 5. export_review_report ═══ */

export const ExportReportToolUI = makeAssistantToolUI<
  { asset_id?: string; version_id?: string },
  { report_id: string; title: string; content_preview: string; generated_at: string }
>({
  toolName: 'chronofact.export_review_report',
  render: ({ result, status }) => {
    if (status.type === 'running') return <ToolLoading label='生成报告' />
    return (
      <ToolCard icon={FileText} title={result?.title ?? '复核报告'} color='text-muted-foreground'>
        <pre className='max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground/70'>
          {result?.content_preview}
        </pre>
        <p className='mt-2 text-xs text-muted-foreground/50'>
          生成于 {result?.generated_at}
        </p>
      </ToolCard>
    )
  },
})
