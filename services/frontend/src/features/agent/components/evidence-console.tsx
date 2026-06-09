import { AlertTriangle, Blocks, Clock, FileCheck, Hash, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

const preserveSteps = [
  {
    label: '选择项目空间',
    description: '把文件归入课程、实验或报告空间',
    icon: Blocks,
  },
  {
    label: '上传文件',
    description: '后续接入文件选择、拖拽和上传控制台',
    icon: Upload,
  },
  {
    label: '计算 SHA-256',
    description: '后续使用 Web Crypto 生成稳定指纹',
    icon: Hash,
  },
]

export function EvidenceConsole() {
  return (
    <ScrollArea className='h-full min-h-0'>
      <div className='p-5 pb-24'>
        <p className='mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50'>
          存证模块
        </p>

        <div className='mb-5'>
          <p className='mb-2 text-xs font-medium text-muted-foreground'>工作空间</p>
          <div className='rounded-xl border bg-emerald-50/35 p-4 dark:bg-emerald-950/10'>
            <div className='flex items-center gap-2.5'>
              <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/25'>
                <Blocks className='h-4 w-4 text-emerald-600/75 dark:text-emerald-300/70' />
              </div>
              <div>
                <p className='text-sm font-medium'>区块链实验报告材料</p>
                <p className='font-mono text-xs text-muted-foreground/50'>ws_001</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className='my-5'>
          <p className='mb-2 text-xs font-medium text-muted-foreground'>文件上传与哈希</p>
          <div className='flex flex-col items-center rounded-xl border border-dashed border-blue-100 bg-blue-50/20 p-5 text-center dark:border-blue-900/20 dark:bg-blue-950/10'>
            <div className='mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20'>
              <Upload className='h-5 w-5 text-blue-500/65 dark:text-blue-300/65' />
            </div>
            <p className='text-sm text-muted-foreground/70'>预留文件上传区域</p>
            <p className='text-xs text-muted-foreground/40'>选择文件后计算 SHA-256 指纹</p>
            <Badge variant='secondary' className='mt-2.5 text-xs font-normal'>
              待接入
            </Badge>
          </div>
        </div>

        <Separator />

        <div className='my-5'>
          <p className='mb-2 text-xs font-medium text-muted-foreground'>存证流程占位</p>
          <div className='space-y-2'>
            {preserveSteps.map((step) => {
              const Icon = step.icon
              return (
                <div key={step.label} className='flex items-start gap-3 rounded-xl border bg-background/60 p-3'>
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
          <div className='space-y-2 text-xs text-muted-foreground/70'>
            <div className='flex items-center justify-between'>
              <span>文件</span>
              <span>未选择</span>
            </div>
            <div className='flex items-center justify-between'>
              <span>SHA-256</span>
              <span>等待计算</span>
            </div>
          </div>
        </div>

        <div className='rounded-xl border border-amber-200/40 bg-amber-50/40 p-4 dark:border-amber-900/20 dark:bg-amber-950/10'>
          <div className='flex items-start gap-2.5'>
            <Clock className='mt-0.5 h-4 w-4 shrink-0 text-amber-500/50' />
            <p className='text-xs leading-relaxed text-amber-800/60 dark:text-amber-300/60'>
              这里后续承接项目空间选择、文件上传、哈希计算、存证提交和核验结果。
            </p>
          </div>
        </div>

        <div className='mt-3 rounded-xl border border-muted bg-muted/30 p-4'>
          <div className='flex items-start gap-2.5'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60' />
            <p className='text-xs leading-relaxed text-muted-foreground/70'>
              AI 解释不构成真实性证明。证明来源为结构化回执与链上记录。
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
