import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  useRemoteThreadListRuntime,
} from '@assistant-ui/react'
import { AgentChatPanel } from './components/agent-chat-panel'
import { AgentThreadList } from './components/agent-thread-list'
import { EvidenceConsole } from './components/evidence-console'
import { mockChatModelAdapter } from './mock-adapter'
import { chronofactThreadListAdapter } from './thread-list-adapter'

function AgentWorkspaceContent() {
  const runtime = useRemoteThreadListRuntime({
    adapter: chronofactThreadListAdapter,
    runtimeHook: () => useLocalRuntime(mockChatModelAdapter),
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className='flex h-screen overflow-hidden bg-background text-foreground'>
        <aside className='hidden h-full w-[320px] shrink-0 border-r bg-card lg:block'>
          <AgentThreadList />
        </aside>

        <main className='min-w-0 flex-1'>
          <AgentChatPanel />
        </main>

        <aside className='hidden h-full w-[360px] shrink-0 border-l bg-card xl:block'>
          <EvidenceConsole />
        </aside>
      </div>
    </AssistantRuntimeProvider>
  )
}

export default function AgentWorkspace() {
  return <AgentWorkspaceContent />
}
