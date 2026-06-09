import type {
  ChatModelAdapter,
  ChatModelRunResult,
} from '@assistant-ui/react'

/**
 * Mock 存证工具调用数据
 * 模拟 Agent 调用 Chronofact 存证系统工具并返回结果
 */

const TOOL_RESPONSES: Record<string, { result: unknown; text: string }> = {
  'chronofact.list_evidence': {
    text: '我帮你查询了当前工作空间的存证记录：',
    result: {
      records: [
        {
          preservation_id: 'prv_001',
          asset_id: 'asset_001',
          version_id: 'ver_001',
          sha256: 'a1b2c3d4e5f6... (SHA-256)',
          status: 'verified',
          anchor_status: 'recorded',
          created_at: '2026-06-01T10:30:00Z',
        },
        {
          preservation_id: 'prv_002',
          asset_id: 'asset_002',
          version_id: 'ver_003',
          sha256: 'f6e5d4c3b2a1... (SHA-256)',
          status: 'pending',
          anchor_status: 'pending',
          created_at: '2026-06-05T14:20:00Z',
        },
        {
          preservation_id: 'prv_003',
          asset_id: 'asset_003',
          version_id: 'ver_005',
          sha256: '1a2b3c4d5e6f... (SHA-256)',
          status: 'failed',
          anchor_status: 'missing',
          failure_reason: 'proof_missing',
          created_at: '2026-06-07T09:15:00Z',
        },
      ],
      total: 3,
    },
  },
  'chronofact.verify_receipt': {
    text: '核验完成，结果如下：',
    result: {
      version_id: 'ver_001',
      digest_match: true,
      status: 'verified',
      receipt_status: 'available',
      anchor_status: 'recorded',
      trace_status: 'complete',
      fact_id: 'fact_001',
      receipt_id: 'receipt_001',
      tx_hash: '0x7a8b9c...d4e5f6',
    },
  },
  'chronofact.get_trace': {
    text: '这是该资产的版本链路追踪：',
    result: {
      asset_id: 'asset_001',
      versions: [
        {
          version_id: 'ver_001',
          version_no: 1,
          sha256: 'a1b2c3d4...',
          previous_version_id: null,
          status: 'verified',
          created_at: '2026-05-20T10:00:00Z',
        },
        {
          version_id: 'ver_002',
          version_no: 2,
          sha256: 'b2c3d4e5...',
          previous_version_id: 'ver_001',
          status: 'verified',
          created_at: '2026-06-01T14:30:00Z',
        },
      ],
    },
  },
  'chronofact.find_digest': {
    text: '指纹查找结果：',
    result: {
      sha256: 'a1b2c3d4e5f6...',
      matches: [
        {
          asset_id: 'asset_001',
          version_id: 'ver_001',
          filename: '实验报告_v1.pdf',
          status: 'verified',
          created_at: '2026-05-20T10:00:00Z',
        },
      ],
    },
  },
  'chronofact.export_review_report': {
    text: '复核报告已生成：',
    result: {
      report_id: 'rpt_001',
      format: 'markdown',
      title: '核验摘要报告 - asset_001',
      generated_at: '2026-06-08T15:00:00Z',
      content_preview:
        '# 核验摘要报告\n\n## 资产信息\n- 资产ID: asset_001\n- 版本: v2\n- 状态: 已核验\n\n## 证明来源\n- SHA-256 摘要匹配\n- 见证回执可用\n- 链上锚定确认',
    },
  },
}

/**
 * 根据用户消息内容匹配工具调用
 */
function matchToolCall(userMessage: string): {
  toolName: string
  args: Record<string, string>
} | null {
  const lower = userMessage.toLowerCase()

  if (
    lower.includes('存证') ||
    lower.includes('记录') ||
    lower.includes('列出') ||
    lower.includes('proof missing') ||
    lower.includes('哪些还没')
  ) {
    return {
      toolName: 'chronofact.list_evidence',
      args: { workspace_id: 'ws_001' },
    }
  }

  if (
    lower.includes('校验') ||
    lower.includes('核验') ||
    lower.includes('验证') ||
    lower.includes('为什么') ||
    lower.includes('失败')
  ) {
    return {
      toolName: 'chronofact.verify_receipt',
      args: { version_id: 'ver_001' },
    }
  }

  if (
    lower.includes('版本') ||
    lower.includes('关系') ||
    lower.includes('最新') ||
    lower.includes('链路')
  ) {
    return {
      toolName: 'chronofact.get_trace',
      args: { asset_id: 'asset_001' },
    }
  }

  if (
    lower.includes('指纹') ||
    lower.includes('sha') ||
    lower.includes('文件有没有')
  ) {
    return {
      toolName: 'chronofact.find_digest',
      args: { sha256: 'a1b2c3d4e5f6...' },
    }
  }

  if (
    lower.includes('报告') ||
    lower.includes('复核') ||
    lower.includes('生成')
  ) {
    return {
      toolName: 'chronofact.export_review_report',
      args: { asset_id: 'asset_001', version_id: 'ver_002' },
    }
  }

  return null
}

/**
 * 构造工具调用 content part，满足 ToolCallMessagePart 类型要求
 */
function makeToolCallPart(
  toolCallId: string,
  toolName: string,
  args: Record<string, string>,
  result?: unknown
) {
  return {
    type: 'tool-call' as const,
    toolCallId,
    toolName,
    args,
    argsText: JSON.stringify(args),
    ...(result !== undefined ? { result } : {}),
  }
}

/**
 * Mock ChatModelAdapter
 * 模拟 Agent 接收用户消息 -> 调用存证工具 -> 返回结果
 */
export const mockChatModelAdapter: ChatModelAdapter = {
  async *run({ messages }): AsyncGenerator<ChatModelRunResult, void> {
    // 模拟延迟
    await new Promise((r) => setTimeout(r, 500))

    const lastMessage = messages[messages.length - 1]
    const userText =
      lastMessage?.role === 'user'
        ? (lastMessage.content as Array<{ type: string; text?: string }>)
            .filter((p) => p.type === 'text')
            .map((p) => p.text ?? '')
            .join(' ')
        : ''

    const toolCall = matchToolCall(userText)

    if (toolCall) {
      const toolData = TOOL_RESPONSES[toolCall.toolName]
      const toolCallId = `call_${Date.now()}`

      // 先返回工具调用（执行中）
      yield {
        content: [
          makeToolCallPart(toolCallId, toolCall.toolName, toolCall.args),
        ],
      }

      // 模拟工具执行延迟
      await new Promise((r) => setTimeout(r, 800))

      // 返回工具结果和总结文本
      yield {
        content: [
          makeToolCallPart(
            toolCallId,
            toolCall.toolName,
            toolCall.args,
            toolData.result
          ),
          {
            type: 'text' as const,
            text: toolData.text,
          },
        ],
      }
    } else {
      // 普通对话
      yield {
        content: [
          {
            type: 'text' as const,
            text:
              '你好，我是 Chronofact 证据治理助手。你可以问我：\n\n- "这个文件有没有被存证？"\n- "为什么这次校验失败？"\n- "这批材料里哪些还没有链上确认？"\n- "哪个版本是最新的？"\n- "帮我生成一份复核报告"\n\n我会调用存证系统工具来回答你。',
          },
        ],
      }
    }
  },
}
