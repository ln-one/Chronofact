import { useEffect, useMemo, useRef, useState } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createAgentConversation,
  getAgentDocumentLibrary,
  getAgentHealth,
  getAgentConversation,
  listAgentConversations,
  startAgentRun,
  uploadAgentFile,
  type AgentActionRequired,
  type AgentConversationDetail,
} from './agent-api'
import { ensureChronofactOrganization } from '@/features/auth/limora-api'
import { useChronofactAssistantRuntime } from './agent-runtime'
import { AgentThreadList } from './components/agent-thread-list'
import { AgentChatPanel } from './components/agent-chat-panel'
import { EvidenceConsole } from './components/evidence-console'

const queryKeys = {
  health: ['chronofact-agent', 'health'] as const,
  library: (organizationId: string | null) =>
    ['chronofact-agent', 'documents', organizationId] as const,
  conversations: ['chronofact-agent', 'conversations'] as const,
  detail: (conversationId: string | null) =>
    ['chronofact-agent', 'conversation', conversationId] as const,
}

export default function AgentWorkspace() {
  const queryClient = useQueryClient()
  const bootstrappedRef = useRef(false)
  const activeOrganizationRef = useRef<string | null>(null)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)

  const limoraQuery = useQuery({
    queryKey: ['limora', 'chronofact-organization'] as const,
    queryFn: ensureChronofactOrganization,
    staleTime: 30_000,
  })

  const activeMembership = limoraQuery.data?.membership ?? null
  const activeOrganizationId = activeMembership?.organizationId ?? null
  const identity = limoraQuery.data?.session.identity ?? null

  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: getAgentHealth,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })

  const libraryQuery = useQuery({
    queryKey: queryKeys.library(activeOrganizationId),
    queryFn: () => getAgentDocumentLibrary(activeOrganizationId!),
    enabled: Boolean(activeOrganizationId),
    staleTime: 0,
  })

  const conversationsQuery = useQuery({
    queryKey: [...queryKeys.conversations, activeOrganizationId] as const,
    queryFn: listAgentConversations,
    enabled: Boolean(activeOrganizationId),
    staleTime: 0,
  })

  const detailQuery = useQuery({
    queryKey: queryKeys.detail(currentConversationId),
    queryFn: () => getAgentConversation(currentConversationId!),
    enabled: Boolean(currentConversationId),
    staleTime: 0,
    refetchInterval: (query) =>
      hasRunningWork(query.state.data as AgentConversationDetail | undefined)
        ? 1000
        : false,
  })

  const createConversationMutation = useMutation({
    mutationFn: () => {
      if (!activeOrganizationId) throw new Error('当前账号还没有可用的组织空间。')
      return createAgentConversation({ organizationId: activeOrganizationId })
    },
    onSuccess: async (conversation) => {
      setCurrentConversationId(conversation.conversation_id)
      setSelectedFileId(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
    },
    onError: showError('新建对话失败'),
  })

  const uploadMutation = useMutation({
    mutationFn: async ({ conversationId, file }: { conversationId: string; file: File }) => {
      if (!activeOrganizationId) throw new Error('当前账号还没有可用的组织空间。')
      return uploadAgentFile({
        conversationId,
        organizationId: activeOrganizationId,
        file,
        contentBase64: await fileToBase64(file),
        mimeType: file.type,
      })
    },
    onSuccess: async (uploaded) => {
      setSelectedFileId(uploaded.file_id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
        queryClient.invalidateQueries({ queryKey: queryKeys.detail(uploaded.conversation_id ?? currentConversationId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.library(activeOrganizationId) }),
      ])
    },
    onError: showError('上传失败'),
  })

  const runMutation = useMutation({
    mutationFn: startAgentRun,
    onSuccess: async (payload) => {
      if (!currentConversationId) {
        setCurrentConversationId(payload.conversation_id)
      }
      if (payload.current_file?.file_id) {
        setSelectedFileId(payload.current_file.file_id)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
        queryClient.invalidateQueries({ queryKey: queryKeys.detail(payload.conversation_id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.library(activeOrganizationId) }),
      ])
    },
    onError: showError('发送失败'),
  })

  const conversations = conversationsQuery.data ?? []
  const detail = detailQuery.data ?? null
  const busy =
    limoraQuery.isLoading ||
    createConversationMutation.isPending ||
    uploadMutation.isPending ||
    runMutation.isPending
  const sending = uploadMutation.isPending || runMutation.isPending
  const loading =
    limoraQuery.isLoading ||
    conversationsQuery.isLoading ||
    (Boolean(currentConversationId) && detailQuery.isLoading && !detail)

  const pendingAction = useMemo(() => {
    const message = [...(detail?.messages ?? [])]
      .reverse()
      .find((item) => item.metadata?.action_required)
    const action = message?.metadata?.action_required ?? null
    if (!action) return null
    const file = detail?.files.find((item) => item.file_id === action.file_id)
    return file?.proof_id ? null : action
  }, [detail?.files, detail?.messages])

  useEffect(() => {
    if (activeOrganizationRef.current === activeOrganizationId) return
    activeOrganizationRef.current = activeOrganizationId
    bootstrappedRef.current = false
    setCurrentConversationId(null)
    setSelectedFileId(null)
  }, [activeOrganizationId])

  useEffect(() => {
    if (!activeOrganizationId || bootstrappedRef.current || conversationsQuery.isLoading) return
    bootstrappedRef.current = true
    const first = conversationsQuery.data?.[0]
    if (first) {
      setCurrentConversationId(first.conversation_id)
      return
    }
    void createConversationMutation.mutateAsync()
  }, [activeOrganizationId, conversationsQuery.data, conversationsQuery.isLoading, createConversationMutation])

  useEffect(() => {
    if (!detail) return
    setSelectedFileId((current) => {
      if (current && detail.files.some((file) => file.file_id === current)) return current
      return detail.current_file?.file_id ?? detail.files[detail.files.length - 1]?.file_id ?? null
    })
  }, [detail])

  function openConversation(conversationId: string) {
    setCurrentConversationId(conversationId)
    setSelectedFileId(null)
  }

  async function createAndOpenConversation() {
    await createConversationMutation.mutateAsync()
  }

  async function ensureConversation() {
    if (currentConversationId) return currentConversationId
    const conversation = await createConversationMutation.mutateAsync()
    return conversation.conversation_id
  }

  async function uploadFile(conversationId: string, file: File) {
    return uploadMutation.mutateAsync({ conversationId, file })
  }

  async function handleUploadOnly(file: File) {
    const conversationId = await ensureConversation()
    await uploadFile(conversationId, file)
    toast.success('文件已进入当前对话')
  }

  async function handleSend({
    message,
    file,
    ignoreSelectedFile = false,
  }: {
    message: string
    file?: File | null
    ignoreSelectedFile?: boolean
  }) {
    const organizationId = requireActiveOrganization(activeOrganizationId)
    const conversationId = await ensureConversation()
    const uploaded = file ? await uploadFile(conversationId, file) : null
    const fileId = ignoreSelectedFile
      ? undefined
      : uploaded?.file_id ?? selectedFileId ?? detail?.current_file?.file_id
    await runMutation.mutateAsync({
      conversationId,
      organizationId,
      message,
      fileId,
    })
  }

  async function handleConfirmPreserve(action: AgentActionRequired) {
    if (!currentConversationId) return
    const organizationId = requireActiveOrganization(activeOrganizationId)
    await runMutation.mutateAsync({
      conversationId: currentConversationId,
      organizationId,
      message: '确认存证',
      fileId: action.file_id,
      confirmedAction: true,
    })
  }

  const runtime = useChronofactAssistantRuntime({
    detail,
    conversations,
    currentConversationId,
    isLoading: loading,
    isRunning: hasRunningWork(detail ?? undefined),
    isSendDisabled: busy,
    onSendMessage: async (text) => {
      await handleSend({ message: text })
    },
    onUploadFile: async (file) => {
      const conversationId = await ensureConversation()
      return uploadFile(conversationId, file)
    },
    onCreateConversation: createAndOpenConversation,
    onSwitchConversation: openConversation,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className='h-svh w-full'>
      <div className='grid h-full w-full grid-cols-[18rem_minmax(42rem,1fr)_minmax(0,24rem)] overflow-hidden'>
        <div className='h-full min-h-0 min-w-0 overflow-hidden border-r bg-muted/30'>
          <AgentThreadList
            conversations={conversations}
            currentConversationId={currentConversationId}
            loading={loading}
            identity={identity}
            organization={activeMembership?.organization ?? null}
            onCreateConversation={() => void createAndOpenConversation()}
            onSelectConversation={openConversation}
          />
        </div>

        <div className='relative h-full min-h-0 min-w-0 overflow-hidden bg-background'>
          <AgentChatPanel
            messages={detail?.messages ?? []}
            files={detail?.files ?? []}
            toolCalls={detail?.tool_calls ?? []}
            loading={loading}
            sending={sending}
            onSend={(input) => void handleSend(input)}
            onConfirmPreserve={(action) => void handleConfirmPreserve(action)}
          />
        </div>

        <div className='h-full min-h-0 min-w-0 overflow-hidden border-l bg-muted/20'>
          <EvidenceConsole
            detail={detail}
            organization={activeMembership?.organization ?? null}
            agentHealth={healthQuery.data ?? null}
            documentLibrary={libraryQuery.data ?? null}
            selectedFileId={selectedFileId}
            busy={busy}
            pendingAction={pendingAction}
            onSelectFile={setSelectedFileId}
            onUploadFile={(file) => void handleUploadOnly(file)}
            onConfirmPreserve={(action) => void handleConfirmPreserve(action)}
            onAnalyzeLibrary={() => void handleSend({
              message: '帮我分析当前空间所有文件的存证情况',
              ignoreSelectedFile: true,
            })}
          />
        </div>
      </div>
      </div>
    </AssistantRuntimeProvider>
  )
}

function hasRunningWork(detail?: AgentConversationDetail) {
  return Boolean(
    detail?.messages.some((message) => message.status === 'running') ||
      detail?.runs.some((run) => run.status === 'running')
  )
}

function showError(fallback: string) {
  return (error: unknown) => {
    toast.error(error instanceof Error ? error.message : fallback)
  }
}

function requireActiveOrganization(organizationId: string | null) {
  if (!organizationId) {
    throw new Error('当前账号还没有可用的组织空间。')
  }
  return organizationId
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return window.btoa(binary)
}
