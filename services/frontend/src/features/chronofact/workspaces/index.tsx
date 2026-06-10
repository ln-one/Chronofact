import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Archive,
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  FileText,
  FolderPlus,
  Grid2X2,
  LayoutList,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { setCurrentAgentWorkspace } from '@/features/agent/workspace-context'
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  updateWorkspaceStatus,
  type ChronofactWorkspace,
  type WorkspaceStatus,
  type WorkspaceType,
} from '@/services/chronofact-api'

const workspaceTypes: Array<{
  value: WorkspaceType
  label: string
  icon: typeof BookOpen
}> = [
  { value: 'course_project', label: '课程项目', icon: BookOpen },
  { value: 'experiment', label: '实验空间', icon: ShieldCheck },
  { value: 'assignment', label: '作业提交', icon: FileText },
]

const featuredTemplates = [
  {
    label: '推荐流程',
    title: '教学文件存证',
    description: '适合课程报告、作业与实验材料的指纹计算、登记和后续核验。',
    workspaceType: 'course_project' as WorkspaceType,
    workspaceTitle: '教学文件存证项目',
    workspaceDescription:
      '用于课程报告、作业和实验材料的文件摘要计算、存证与核验。',
    className: 'from-white via-emerald-50 to-slate-100',
  },
  {
    label: '版本追踪',
    title: '实验报告版本链',
    description: '围绕 previous version 记录多次提交与版本关系。',
    workspaceType: 'experiment' as WorkspaceType,
    workspaceTitle: '实验报告版本追踪',
    workspaceDescription: '用于管理实验报告多次提交、版本链路和前后版本核验。',
    className: 'from-white via-amber-50 to-emerald-50',
  },
  {
    label: '复核辅助',
    title: '课程材料核验台',
    description: '聚合 digest、回执、链上状态与异常原因，方便展示与检查。',
    workspaceType: 'course_project' as WorkspaceType,
    workspaceTitle: '课程材料核验项目',
    workspaceDescription: '用于复核课程材料的摘要、回执、链上状态和异常原因。',
    className: 'from-white via-sky-50 to-slate-100',
  },
  {
    label: '报告导出',
    title: '存证说明工作区',
    description: '整理课程展示所需的说明文字、核验结论和追溯材料。',
    workspaceType: 'assignment' as WorkspaceType,
    workspaceTitle: '存证说明整理项目',
    workspaceDescription: '用于整理课程展示所需的存证说明、复核结论和追溯材料。',
    className: 'from-white via-stone-50 to-lime-50',
  },
]

const filterTabs = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'archived', label: '已归档' },
]

type WorkspaceActionType = 'archive' | 'restore' | 'delete'

type WorkspaceAction = {
  type: WorkspaceActionType
  workspace: ChronofactWorkspace
}

export function WorkspacesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<WorkspaceAction | null>(null)
  const [form, setForm] = useState({
    title: '',
    workspace_type: 'course_project' as WorkspaceType,
    description: '',
  })

  const workspacesQuery = useQuery({
    queryKey: ['chronofact-workspaces'] as const,
    queryFn: () => listWorkspaces(),
  })

  const createWorkspaceMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: async ({ workspace }) => {
      await queryClient.invalidateQueries({ queryKey: ['chronofact-workspaces'] })
      setDialogOpen(false)
      setForm({ title: '', workspace_type: 'course_project', description: '' })
      enterWorkspace(workspace)
      toast.success(`已创建项目空间：${workspace.title}`)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '创建项目空间失败')
    },
  })

  const updateWorkspaceStatusMutation = useMutation({
    mutationFn: (input: { workspaceId: string; status: WorkspaceStatus }) =>
      updateWorkspaceStatus(input),
    onSuccess: async ({ workspace }) => {
      await queryClient.invalidateQueries({ queryKey: ['chronofact-workspaces'] })
      setPendingAction(null)
      toast.success(
        workspace.status === 'archived'
          ? `已归档项目空间：${workspace.title}`
          : `已恢复项目空间：${workspace.title}`
      )
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '项目空间状态更新失败')
    },
  })

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (workspaceId: string) => deleteWorkspace(workspaceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['chronofact-workspaces'] })
      setPendingAction(null)
      toast.success('项目空间已删除')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '删除项目空间失败')
    },
  })

  const workspaces = workspacesQuery.data?.workspaces ?? []
  const visibleWorkspaces = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return workspaces.filter((workspace) => {
      const matchesFilter = filter === 'all' || workspace.status === filter
      const matchesQuery =
        !normalized ||
        [workspace.title, workspace.description, workspace.workspace_type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized))
      return matchesFilter && matchesQuery
    })
  }, [filter, query, workspaces])

  function enterWorkspace(workspace: ChronofactWorkspace) {
    setCurrentAgentWorkspace(workspace)
    void navigate({ to: '/agent' })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = form.title.trim()
    if (!title) return

    createWorkspaceMutation.mutate({
      title,
      workspace_type: form.workspace_type,
      description: form.description.trim() || undefined,
    })
  }

  function useTemplate(template: (typeof featuredTemplates)[number]) {
    setForm({
      title: template.workspaceTitle,
      workspace_type: template.workspaceType,
      description: template.workspaceDescription,
    })
    setDialogOpen(true)
  }

  function confirmWorkspaceAction() {
    if (!pendingAction) return

    if (pendingAction.type === 'delete') {
      deleteWorkspaceMutation.mutate(pendingAction.workspace.workspace_id)
      return
    }

    updateWorkspaceStatusMutation.mutate({
      workspaceId: pendingAction.workspace.workspace_id,
      status: pendingAction.type === 'archive' ? 'archived' : 'active',
    })
  }

  const actionIsPending =
    updateWorkspaceStatusMutation.isPending || deleteWorkspaceMutation.isPending

  return (
    <main className='min-h-svh bg-[#f7faf9] text-slate-950'>
      <div className='pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_6%,rgba(16,185,129,0.15),transparent_28%),radial-gradient(circle_at_88%_10%,rgba(14,165,233,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,249,0.96))]' />
      <div className='relative mx-auto min-h-svh w-full max-w-7xl px-6 py-6 lg:px-10'>
        <header className='mb-10 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm'>
              <ShieldCheck className='h-5 w-5' />
            </div>
            <div className='flex items-baseline gap-3'>
              <p className='text-lg font-semibold tracking-tight'>Chronofact</p>
              <span className='text-xs text-slate-400'>项目空间</span>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Button variant='ghost' size='icon' className='rounded-full'>
              <Grid2X2 className='h-4 w-4' />
            </Button>
            <Button variant='ghost' size='icon' className='rounded-full'>
              <LayoutList className='h-4 w-4' />
            </Button>
            <div className='flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white shadow-sm'>
              C
            </div>
          </div>
        </header>

        <section className='mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='inline-flex w-fit rounded-2xl bg-slate-100 p-1 shadow-inner'>
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                type='button'
                onClick={() => setFilter(tab.value)}
                className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
                  filter === tab.value
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
            <div className='relative w-full sm:w-72'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='搜索项目空间...'
                className='h-11 rounded-2xl border-0 bg-slate-100 pl-9 shadow-none'
              />
            </div>
            <Button
              className='h-11 rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800'
              onClick={() => setDialogOpen(true)}
            >
              <Plus className='h-4 w-4' />
              新建
            </Button>
          </div>
        </section>

        <section className='mb-12'>
          <div className='mb-5 flex items-center justify-between'>
            <h1 className='text-2xl font-semibold tracking-tight'>精选项目模板</h1>
            <span className='text-sm text-slate-500'>点击后可预填创建信息</span>
          </div>
          <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
            {featuredTemplates.map((template) => (
              <button
                key={template.title}
                type='button'
                onClick={() => useTemplate(template)}
                className={`min-h-32 rounded-3xl border border-white/70 bg-gradient-to-br ${template.className} p-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-[0_18px_36px_rgba(15,23,42,0.1)]`}
              >
                <div className='flex items-start justify-between'>
                  <span className='rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-600'>
                    {template.label}
                  </span>
                  <BookOpen className='h-4 w-4 text-slate-500' />
                </div>
                <h2 className='mt-6 text-base font-semibold'>{template.title}</h2>
                <p className='mt-1.5 text-sm leading-5 text-slate-600'>
                  {template.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className='mb-5 flex items-center justify-between'>
            <h2 className='text-2xl font-semibold tracking-tight'>最近打开的项目</h2>
            <span className='text-sm text-slate-500'>共 {workspaces.length} 个</span>
          </div>

          {workspacesQuery.error && (
            <div className='mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
              {workspacesQuery.error instanceof Error
                ? workspacesQuery.error.message
                : '项目空间读取失败'}
            </div>
          )}

          <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
            <CreateWorkspaceCard onClick={() => setDialogOpen(true)} />
            {workspacesQuery.isLoading ? (
              <LoadingCard />
            ) : (
              visibleWorkspaces.map((workspace, index) => (
                <WorkspaceCard
                  key={workspace.workspace_id}
                  workspace={workspace}
                  index={index}
                  onEnter={() => enterWorkspace(workspace)}
                  onAction={(type) => setPendingAction({ type, workspace })}
                />
              ))
            )}
          </div>
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='rounded-3xl sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>创建项目空间</DialogTitle>
            <DialogDescription>
              新建后会直接进入该项目对应的 Agent 工作台。
            </DialogDescription>
          </DialogHeader>
          <form className='space-y-5' onSubmit={submit}>
            <div className='space-y-2'>
              <Label htmlFor='workspace-title'>项目名称</Label>
              <Input
                id='workspace-title'
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder='例如：区块链实验教学材料存证'
                className='h-11 rounded-xl'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='workspace-type'>空间类型</Label>
              <Select
                value={form.workspace_type}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    workspace_type: value as WorkspaceType,
                  }))
                }
              >
                <SelectTrigger id='workspace-type' className='h-11 w-full rounded-xl'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspaceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='workspace-description'>说明</Label>
              <Textarea
                id='workspace-description'
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder='写下提交范围、课程要求或复核说明'
                className='min-h-28 rounded-xl'
              />
            </div>
            <DialogFooter>
              <Button
                type='submit'
                className='h-11 rounded-xl bg-emerald-700 hover:bg-emerald-600'
                disabled={createWorkspaceMutation.isPending || !form.title.trim()}
              >
                {createWorkspaceMutation.isPending && (
                  <Loader2 className='h-4 w-4 animate-spin' />
                )}
                创建并进入空间
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null)
          }
        }}
        title={getActionDialogTitle(pendingAction)}
        desc={getActionDialogDescription(pendingAction)}
        confirmText={getActionConfirmText(pendingAction)}
        cancelBtnText='取消'
        destructive={pendingAction?.type === 'delete'}
        isLoading={actionIsPending}
        handleConfirm={confirmWorkspaceAction}
      />
    </main>
  )
}

function CreateWorkspaceCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='flex min-h-40 flex-col items-center justify-center rounded-3xl border border-dashed border-sky-200 bg-white/45 text-center text-slate-500 transition hover:border-sky-300 hover:bg-white/70'
    >
      <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600'>
        <FolderPlus className='h-5 w-5' />
      </div>
      <p className='font-medium text-slate-700'>新建项目空间</p>
    </button>
  )
}

function LoadingCard() {
  return (
    <div className='flex min-h-40 items-center justify-center rounded-3xl bg-white/60 text-sm text-slate-500'>
      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
      正在读取项目空间...
    </div>
  )
}

function WorkspaceCard({
  workspace,
  index,
  onEnter,
  onAction,
}: {
  workspace: ChronofactWorkspace
  index: number
  onEnter: () => void
  onAction: (type: WorkspaceActionType) => void
}) {
  const type = workspaceTypes.find((item) => item.value === workspace.workspace_type)
  const Icon = type?.icon ?? Boxes
  const gradients = [
    'from-emerald-100 via-cyan-50 to-sky-200',
    'from-lime-100 via-emerald-50 to-teal-200',
    'from-sky-100 via-slate-50 to-emerald-200',
    'from-amber-100 via-lime-50 to-emerald-100',
  ]
  const isArchived = workspace.status === 'archived'

  return (
    <div
      className={`group min-h-40 rounded-3xl bg-gradient-to-br ${gradients[index % gradients.length]} p-5 text-left shadow-[0_16px_36px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(15,23,42,0.12)]`}
    >
      <div className='flex items-start justify-between gap-3'>
        <span className='rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-600'>
          {type?.label ?? workspace.workspace_type}
        </span>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={onEnter}
            aria-label={`进入${workspace.title}`}
            className='rounded-full bg-white/55 p-1.5 text-slate-500 transition hover:bg-white/80 hover:text-emerald-700'
          >
            <ArrowRight className='h-4 w-4' />
          </button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                aria-label={`${workspace.title} 更多操作`}
                className='rounded-full bg-white/55 p-1.5 text-slate-500 transition hover:bg-white/80 hover:text-slate-900'
              >
                <MoreHorizontal className='h-4 w-4' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-40 rounded-xl'>
              {isArchived ? (
                <DropdownMenuItem onClick={() => onAction('restore')}>
                  <RotateCcw className='h-4 w-4' />
                  恢复
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onAction('archive')}>
                  <Archive className='h-4 w-4' />
                  归档
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                onClick={() => onAction('delete')}
              >
                <Trash2 className='h-4 w-4' />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <button
        type='button'
        onClick={onEnter}
        className='mt-8 block w-full text-left'
      >
        <div className='flex items-end justify-between gap-4'>
          <div className='min-w-0'>
            <h3 className='truncate text-lg font-semibold'>{workspace.title}</h3>
            <p className='mt-1 line-clamp-2 text-sm leading-5 text-slate-600'>
              {workspace.description || '进入后创建项目相关的 Agent 对话与工作内容'}
            </p>
          </div>
          <Icon className='h-5 w-5 shrink-0 text-slate-500' />
        </div>
        <div className='mt-5 flex items-center gap-1.5 text-xs text-slate-500'>
          <CheckCircle2 className='h-3.5 w-3.5 text-emerald-600' />
          {displayStatus(workspace.status)}
        </div>
      </button>
    </div>
  )
}

function displayStatus(status: string | undefined) {
  if (status === 'active') return '可用'
  if (status === 'under_review') return '审核中'
  if (status === 'archived') return '已归档'
  return status || '状态未知'
}

function getActionDialogTitle(action: WorkspaceAction | null) {
  if (!action) return ''
  if (action.type === 'archive') return '确认归档这个项目空间？'
  if (action.type === 'restore') return '确认恢复这个项目空间？'
  return '确认删除这个项目空间？'
}

function getActionDialogDescription(action: WorkspaceAction | null) {
  if (!action) return ''

  if (action.type === 'archive') {
    return `项目“${action.workspace.title}”会从默认列表移到归档分组，但历史内容仍然保留。`
  }

  if (action.type === 'restore') {
    return `项目“${action.workspace.title}”会重新回到可用列表，方便继续处理和查看。`
  }

  return `删除后将无法在前端列表中继续看到“${action.workspace.title}”。后端同学接入真实接口后，可以把这里对齐为最终删除语义。`
}

function getActionConfirmText(action: WorkspaceAction | null) {
  if (!action) return '确认'
  if (action.type === 'archive') return '确认归档'
  if (action.type === 'restore') return '确认恢复'
  return '确认删除'
}
