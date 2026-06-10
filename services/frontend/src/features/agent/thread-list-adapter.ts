import type {
  RemoteThreadListAdapter,
  TextMessagePart,
  ThreadMessage,
} from '@assistant-ui/react'
import { getCurrentAgentWorkspaceId } from './workspace-context'

type StoredThread = {
  remoteId: string
  status: 'regular' | 'archived'
  title?: string
  pinned?: boolean
  workspaceId?: string
}

const STORAGE_KEY = 'chronofact:agent:threads'
export const THREAD_LIST_CHANGED_EVENT = 'chronofact:agent:threads-changed'

function loadThreads(): StoredThread[] {
  if (typeof window === 'undefined') return []

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    return JSON.parse(raw) as StoredThread[]
  } catch {
    return []
  }
}

function saveThreads(threads: StoredThread[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads))
  window.dispatchEvent(new Event(THREAD_LIST_CHANGED_EVENT))
}

function updateThread(
  remoteId: string,
  updater: (thread: StoredThread) => StoredThread
) {
  const threads = loadThreads()
  const next = threads.map((thread) =>
    thread.remoteId === remoteId ? updater(thread) : thread
  )
  saveThreads(next)
}

function extractFirstUserText(messages: readonly ThreadMessage[]) {
  const userMessage = messages.find((message) => message.role === 'user')
  const textPart = userMessage?.content.find(
    (part): part is TextMessagePart => part.type === 'text'
  )
  return textPart?.type === 'text' ? textPart.text : ''
}

function compactTitle(text: string) {
  const normalized = text
    .replace(/\s+/g, '')
    .replace(/[，。！？、；,.!?;:"'()[\]{}<>《》]/g, '')
    .replace(/^(请问|麻烦|帮我|帮忙|我想|我想问|能不能|可不可以|给我)/, '')

  if (!normalized) return '新对话'

  const rules: Array<[RegExp, string]> = [
    [/proofmissing|缺少证明|证明缺失/i, '缺失证明记录'],
    [/链上确认|未确认|还没有链上|待确认/, '链上确认状态'],
    [/校验.*失败|失败.*校验|为什么.*失败|核验失败/, '校验失败原因'],
    [/最新.*版本|版本.*最新/, '最新版本查询'],
    [/版本链|版本关系|上一次提交|历史版本/, '版本关系追踪'],
    [/复核报告|生成.*报告|报告.*来源/, '生成复核报告'],
    [/有没有.*存证|存证.*查询|查找.*存证|文件.*存证/, '文件存证查询'],
    [/SHA-?256|指纹|哈希|hash/i, '文件指纹查找'],
  ]

  const matched = rules.find(([pattern]) => pattern.test(normalized))
  const title = matched?.[1] ?? normalized
  return [...title].slice(0, 20).join('')
}

function createTitleStream(title: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({
        type: 'part-start',
        path: [0],
        part: { type: 'text' },
      })
      controller.enqueue({
        type: 'text-delta',
        path: [0],
        textDelta: title,
      })
      controller.enqueue({
        type: 'part-finish',
        path: [0],
      })
      controller.close()
    },
  })
}

export const chronofactThreadListAdapter: RemoteThreadListAdapter = {
  async list() {
    const workspaceId = getCurrentAgentWorkspaceId()
    return {
      threads: [...loadThreads()]
        .filter((thread) => !workspaceId || thread.workspaceId === workspaceId)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned))
        .map((thread) => ({
          remoteId: thread.remoteId,
          status: thread.status,
          title: thread.title,
        })),
    }
  },

  async initialize(threadId: string) {
    const threads = loadThreads()
    if (!threads.some((thread) => thread.remoteId === threadId)) {
      saveThreads([
        {
          remoteId: threadId,
          status: 'regular',
          workspaceId: getCurrentAgentWorkspaceId(),
        },
        ...threads,
      ])
    }

    return { remoteId: threadId, externalId: undefined }
  },

  async rename(remoteId: string, newTitle: string): Promise<void> {
    updateThread(remoteId, (thread) => ({
      ...thread,
      title: [...newTitle].slice(0, 20).join(''),
    }))
  },

  async archive(remoteId: string): Promise<void> {
    updateThread(remoteId, (thread) => ({ ...thread, status: 'archived' }))
  },

  async unarchive(remoteId: string): Promise<void> {
    updateThread(remoteId, (thread) => ({ ...thread, status: 'regular' }))
  },

  async delete(remoteId: string): Promise<void> {
    saveThreads(loadThreads().filter((thread) => thread.remoteId !== remoteId))
  },

  async fetch(threadId: string) {
    const thread = loadThreads().find((item) => item.remoteId === threadId)
    if (!thread) throw new Error('Thread not found')

    return {
      remoteId: thread.remoteId,
      status: thread.status,
      title: thread.title,
    }
  },

  async generateTitle(remoteId: string, messages: readonly ThreadMessage[]) {
    const title = compactTitle(extractFirstUserText(messages))
    updateThread(remoteId, (thread) => ({ ...thread, title }))
    return createTitleStream(title)
  },
}

export function isThreadPinned(remoteId: string | undefined) {
  if (!remoteId) return false
  return loadThreads().some(
    (thread) => thread.remoteId === remoteId && thread.pinned
  )
}

export function togglePinnedThread(remoteId: string | undefined) {
  if (!remoteId) return
  updateThread(remoteId, (thread) => ({ ...thread, pinned: !thread.pinned }))
}
