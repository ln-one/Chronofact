import { useEffect, useMemo, useRef, useState } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createAgentConversation,
  getAgentConversation,
  listAgentConversations,
  startAgentRun,
  uploadAgentFile,
  type AgentActionRequired,
  type AgentConversationDetail,
} from './agent-api'
import { useChronofactAssistantRuntime } from './agent-runtime'
import { AgentThreadList } from './components/agent-thread-list'
import { AgentChatPanel } from './components/agent-chat-panel'
import { EvidenceConsole } from './components/evidence-console'

const queryKeys = {
  conversations: ['chronofact-agent', 'conversations'] as const,
  detail: (conversationId: string | null) =>
    ['chronofact-agent', 'conversation', conversationId] as const,
}

export default function AgentWorkspace() {
  const queryClient = useQueryClient()
  const bootstrappedRef = useRef(false)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)

  const conversationsQuery = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: listAgentConversations,
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
    mutationFn: () => createAgentConversation(),
    onSuccess: async (conversation) => {
      setCurrentConversationId(conversation.conversation_id)
      setSelectedFileId(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
    },
    onError: showError('新建对话失败'),
  })

  const uploadMutation = useMutation({
    mutationFn: async ({ conversationId, file }: { conversationId: string; file: File }) =>
      uploadAgentFile({
        conversationId,
        file,
        contentBase64: await fileToBase64(file),
        mimeType: file.type,
      }),
    onSuccess: async (uploaded) => {
      setSelectedFileId(uploaded.file_id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
        queryClient.invalidateQueries({ queryKey: queryKeys.detail(uploaded.conversation_id ?? currentConversationId) }),
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
      ])
    },
    onError: showError('发送失败'),
  })

  const conversations = conversationsQuery.data ?? []
  const detail = detailQuery.data ?? null
  const busy =
    createConversationMutation.isPending ||
    uploadMutation.isPending ||
    runMutation.isPending
  const loading =
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
    if (bootstrappedRef.current || conversationsQuery.isLoading) return
    bootstrappedRef.current = true
    const first = conversationsQuery.data?.[0]
    if (first) {
      setCurrentConversationId(first.conversation_id)
      return
    }
    void createConversationMutation.mutateAsync()
  }, [conversationsQuery.data, conversationsQuery.isLoading, createConversationMutation])

  useEffect(() => {
    if (!detail) return
    setSelectedFileId((current) => {
      if (current && detail.files.some((file) => file.file_id === current)) return current
      return detail.current_file?.file_id ?? detail.files[detail.files.length - 1]?.file_id ?? null
    })
  }, [detail])

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

  async function handleSend({ message, file }: { message: string; file?: File | null }) {
    const conversationId = await ensureConversation()
    const uploaded = file ? await uploadFile(conversationId, file) : null
    const fileId = uploaded?.file_id ?? selectedFileId ?? detail?.current_file?.file_id
    await runMutation.mutateAsync({
      conversationId,
      message,
      fileId,
    })
  }

  async function handleConfirmPreserve(action: AgentActionRequired) {
    if (!currentConversationId) return
    await runMutation.mutateAsync({
      conversationId: currentConversationId,
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
    onSwitchConversation: setCurrentConversationId,
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
            onCreateConversation={() => void createAndOpenConversation()}
            onSelectConversation={(conversationId) => {
              setCurrentConversationId(conversationId)
            }}
          />
        </div>

        <div className='relative h-full min-h-0 min-w-0 overflow-hidden bg-background'>
          <AgentChatPanel
            messages={detail?.messages ?? []}
            files={detail?.files ?? []}
            toolCalls={detail?.tool_calls ?? []}
            loading={loading}
            sending={busy}
            onSend={(input) => void handleSend(input)}
            onConfirmPreserve={(action) => void handleConfirmPreserve(action)}
          />
        </div>

        <div className='h-full min-h-0 min-w-0 overflow-hidden border-l bg-muted/20'>
          <EvidenceConsole
            detail={detail}
            selectedFileId={selectedFileId}
            busy={busy}
            pendingAction={pendingAction}
            onSelectFile={setSelectedFileId}
            onUploadFile={(file) => void handleUploadOnly(file)}
            onConfirmPreserve={(action) => void handleConfirmPreserve(action)}
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
