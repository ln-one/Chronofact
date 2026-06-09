import {
  AssistantRuntimeProvider,
  useRemoteThreadListRuntime,
  useLocalRuntime,
} from '@assistant-ui/react'
import { mockChatModelAdapter } from './mock-adapter'
import { chronofactThreadListAdapter } from './thread-list-adapter'
import { AgentThreadList } from './components/agent-thread-list'
import { AgentChatPanel } from './components/agent-chat-panel'
import { EvidenceConsole } from './components/evidence-console'
import {
  ListEvidenceToolUI,
  VerifyReceiptToolUI,
  GetTraceToolUI,
  FindDigestToolUI,
  ExportReportToolUI,
} from './tool-uis'

function useChronofactThreadRuntime() {
  return useLocalRuntime(mockChatModelAdapter)
}

export default function AgentWorkspace() {
  const runtime = useRemoteThreadListRuntime({
    adapter: chronofactThreadListAdapter,
    runtimeHook: useChronofactThreadRuntime,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ListEvidenceToolUI />
      <VerifyReceiptToolUI />
      <GetTraceToolUI />
      <FindDigestToolUI />
      <ExportReportToolUI />

      <div className='h-svh w-full'>
        <div className='grid h-full w-full grid-cols-[18rem_minmax(42rem,1fr)_minmax(0,24rem)] overflow-hidden'>
          {/* 左栏：对话列表 */}
          <div className='h-full min-h-0 min-w-0 overflow-hidden border-r bg-muted/30'>
            <AgentThreadList />
          </div>

          {/* 中栏：对话区 */}
          <div className='relative h-full min-h-0 min-w-0 overflow-hidden bg-background'>
            <AgentChatPanel />
          </div>

          {/* 右栏：存证控制台 */}
          <div className='h-full min-h-0 min-w-0 overflow-hidden border-l bg-muted/20'>
            <EvidenceConsole />
          </div>
        </div>
      </div>
    </AssistantRuntimeProvider>
  )
}
