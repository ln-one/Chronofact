import { useMemo } from 'react'
import {
  useExternalStoreRuntime,
  type AppendMessage,
  type AttachmentAdapter,
  type PendingAttachment,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import type {
  AgentConversation,
  AgentConversationDetail,
  AgentFileContext,
  AgentMessage,
  AgentToolCall,
} from './agent-api'

export function useChronofactAssistantRuntime({
  detail,
  conversations,
  currentConversationId,
  isLoading,
  isRunning,
  isSendDisabled,
  onSendMessage,
  onUploadFile,
  onCreateConversation,
  onSwitchConversation,
}: {
  detail: AgentConversationDetail | null
  conversations: AgentConversation[]
  currentConversationId: string | null
  isLoading: boolean
  isRunning: boolean
  isSendDisabled: boolean
  onSendMessage: (message: string) => Promise<void>
  onUploadFile: (file: File) => Promise<AgentFileContext>
  onCreateConversation: () => Promise<void>
  onSwitchConversation: (conversationId: string) => void
}) {
  const attachments = useMemo<AttachmentAdapter>(() => createAttachmentAdapter(onUploadFile), [onUploadFile])

  return useExternalStoreRuntime<AgentMessage>({
    messages: detail?.messages ?? [],
    isLoading,
    isRunning,
    isSendDisabled,
    convertMessage: (message) =>
      toThreadMessageLike(
        message,
        detail?.files ?? [],
        detail?.tool_calls ?? []
      ),
    onNew: async (message) => {
      const text = textFromAppendMessage(message)
      if (text.trim()) {
        await onSendMessage(text.trim())
      }
    },
    adapters: {
      attachments,
      threadList: {
        threadId: currentConversationId ?? undefined,
        isLoading,
        threads: conversations.map((conversation) => ({
          status: 'regular',
          id: conversation.conversation_id,
          title: conversation.title,
          custom: {
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
          },
        })),
        onSwitchToNewThread: onCreateConversation,
        onSwitchToThread: onSwitchConversation,
      },
    },
  })
}

function toThreadMessageLike(
  message: AgentMessage,
  files: AgentFileContext[],
  toolCalls: AgentToolCall[]
): ThreadMessageLike {
  const file = files.find((item) => item.file_id === message.metadata?.file_id)
  const relatedToolCalls = toolCalls.filter((call) =>
    message.metadata?.tool_call_ids?.includes(call.tool_call_id)
  )
  const role = message.role === 'user' || message.role === 'assistant' || message.role === 'system'
    ? message.role
    : 'assistant'
  const content: ThreadMessageLike['content'] = [
    ...(file
      ? [{
          type: 'data-file-context',
          data: {
            file_id: file.file_id,
            filename: file.filename,
            sha256: file.sha256,
            size: file.size,
            proof_id: file.proof_id ?? null,
          },
        } as const]
      : []),
    ...relatedToolCalls.map((call) => ({
      type: 'tool-call' as const,
      toolCallId: call.tool_call_id,
      toolName: call.tool_name,
      args: call.input as any,
      result: call.output ?? undefined,
      isError: call.status === 'failed',
    })),
    {
      type: 'text' as const,
      text: message.content,
    },
  ]

  return {
    id: message.message_id,
    role,
    createdAt: new Date(message.created_at),
    status: statusFromMessage(message),
    content,
    metadata: {
      custom: message.metadata ?? {},
    },
  }
}

function statusFromMessage(message: AgentMessage): ThreadMessageLike['status'] {
  if (message.role !== 'assistant') return undefined
  if (message.status === 'running') return { type: 'running' }
  if (message.status === 'failed') {
    return {
      type: 'incomplete',
      reason: 'error',
      error: { message: message.content },
    }
  }
  return { type: 'complete', reason: 'stop' }
}

function createAttachmentAdapter(onUploadFile: (file: File) => Promise<AgentFileContext>): AttachmentAdapter {
  return {
    accept: '*/*',
    async add({ file }) {
      return {
        id: stableAttachmentId(file),
        type: 'file',
        name: file.name,
        contentType: file.type || 'application/octet-stream',
        file,
        status: {
          type: 'requires-action',
          reason: 'composer-send',
        },
      }
    },
    async send(attachment: PendingAttachment) {
      const uploaded = await onUploadFile(attachment.file)
      return {
        ...attachment,
        id: uploaded.file_id,
        status: {
          type: 'complete',
        },
        content: [{
          type: 'file',
          filename: uploaded.filename,
          data: `chronofact-agent://files/${uploaded.file_id}`,
          mimeType: attachment.contentType || 'application/octet-stream',
        }],
      }
    },
    async remove() {},
  }
}

function textFromAppendMessage(message: AppendMessage) {
  return message.content
    .map((part) => part.type === 'text' ? part.text : '')
    .join('')
}

function stableAttachmentId(file: File) {
  return `pending-${file.name}-${file.size}-${file.lastModified}`
}
