import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { AgentStore } from "./store.js";
import type { StoredFile } from "./schema.js";
import { createChronofactAgentTools } from "./tools.js";
import type { ChronofactClient } from "./chronofactClient.js";
import type { AgentLlmClient } from "./llmClient.js";

const defaultOrganizationId = "org_001";

export const uploadFileSchema = z.object({
  conversation_id: z.string().optional(),
  filename: z.string().min(1),
  content_base64: z.string().min(1),
  mime_type: z.string().optional()
});

export const chatSchema = z.object({
  conversation_id: z.string().optional(),
  organization_id: z.string().optional(),
  message: z.string().min(1),
  file_id: z.string().optional(),
  confirmed_action: z.boolean().optional()
});

export function createAgentService({
  store,
  chronofactClient,
  uploadDir,
  llmClient = null
}: {
  store: AgentStore;
  chronofactClient: ChronofactClient;
  uploadDir: string;
  llmClient?: AgentLlmClient | null;
}) {
  const tools = createChronofactAgentTools(chronofactClient);

  return {
    async uploadFile(input: z.infer<typeof uploadFileSchema>) {
      const parsed = uploadFileSchema.parse(input);
      const conversation = store.ensureConversation(parsed.conversation_id);
      const content = Buffer.from(parsed.content_base64, "base64");
      const sha256 = createHash("sha256").update(content).digest("hex");
      await mkdir(uploadDir, { recursive: true });
      const storagePath = join(uploadDir, `${Date.now()}-${safeFilename(parsed.filename)}`);
      await writeFile(storagePath, content);

      const file = store.addFile({
        conversationId: conversation.conversationId,
        filename: parsed.filename,
        sha256,
        size: content.byteLength,
        mimeType: parsed.mime_type ?? null,
        storagePath
      });

      return {
        conversation_id: conversation.conversationId,
        file_id: file.fileId,
        sha256: file.sha256,
        filename: file.filename,
        size: file.size
      };
    },

    async chat(input: z.infer<typeof chatSchema>) {
      const parsed = chatSchema.parse(input);
      const conversation = store.ensureConversation(parsed.conversation_id);
      const conversationId = conversation.conversationId;
      const organizationId = parsed.organization_id ?? defaultOrganizationId;
      const file = resolveFile(store, conversationId, parsed.file_id);
      store.addMessage({ conversationId, role: "user", content: parsed.message });

      if (wantsPreserve(parsed.message)) {
        if (!file) {
          return reply(store, conversationId, "请先上传一个文件，我才能计算摘要并提交存证。");
        }
        if (!parsed.confirmed_action) {
          return reply(
            store,
            conversationId,
            `已读取 ${file.filename}，SHA-256 是 ${file.sha256}。请确认后我再提交区块链存证。`
          );
        }

        const toolInput = {
          organizationId,
          filename: file.filename,
          sha256: file.sha256
        };
        const proof = await tools.preserveEvidence.execute!(toolInput, {} as any);
        const toolCall = store.addToolCall({
          conversationId,
          toolName: "preserveEvidence",
          input: toolInput,
          output: proof,
          status: "completed"
        });
        const proofId = proof?.proof_id ?? null;
        store.setFileProof({ fileId: file.fileId, proofId });
        store.addProofSnapshot({
          conversationId,
          fileId: file.fileId,
          proofId,
          sha256: file.sha256,
          snapshot: proof
        });
        const content = await improveReply({
          llmClient,
          fallback: preserveReply(proof),
          task: "preserve",
          payload: proof
        });
        return reply(store, conversationId, content, {
          tool_calls: [toToolCallResponse(toolCall)],
          proof
        });
      }

      if (wantsVerify(parsed.message)) {
        if (!file) {
          return reply(store, conversationId, "请先上传要验证的文件。");
        }
        const toolInput = {
          organizationId,
          sha256: file.sha256,
          proofId: file.proofId ?? store.latestProofSnapshot(conversationId)?.proofId ?? null
        };
        const verification = await tools.verifyEvidence.execute!(toolInput, {} as any);
        const verifyCall = store.addToolCall({
          conversationId,
          toolName: "verifyEvidence",
          input: toolInput,
          output: verification,
          status: "completed"
        });
        const calls = [toToolCallResponse(verifyCall)];
        let explanation: unknown = undefined;
        if (needsExplanation(verification)) {
          const explainInput = explanationInputFromVerification(verification);
          const rawExplanation = await tools.explainEvidence.execute!(explainInput, {} as any);
          explanation = normalizeExplanation(verification, rawExplanation);
          const explainCall = store.addToolCall({
            conversationId,
            toolName: "explainEvidence",
            input: explainInput,
            output: explanation,
            status: "completed"
          });
          calls.push(toToolCallResponse(explainCall));
        }

        const content = await improveReply({
          llmClient,
          fallback: verificationReply(verification, explanation),
          task: "verify",
          payload: { verification, explanation }
        });
        return reply(store, conversationId, content, {
          tool_calls: calls,
          verification,
          explanation
        });
      }

      const generalReply = await llmClient?.complete({
        system: agentSystemPrompt(),
        user: `用户消息：${parsed.message}\n请说明你能处理的 Chronofact MVP 动作。`
      });
      return reply(store, conversationId, generalReply || "我可以帮你上传文件后提交存证，或验证一个文件是否匹配已有存证。");
    }
  };
}

function resolveFile(store: AgentStore, conversationId: string, fileId?: string): StoredFile | null {
  if (fileId) {
    return store.getFile(fileId);
  }
  return store.latestFile(conversationId);
}

function reply(
  store: AgentStore,
  conversationId: string,
  content: string,
  extra: Record<string, unknown> = {}
) {
  store.addMessage({ conversationId, role: "assistant", content });
  return {
    conversation_id: conversationId,
    reply: content,
    tool_calls: [],
    proof: null,
    verification: null,
    explanation: null,
    ...extra
  };
}

function wantsPreserve(message: string) {
  return /存证|提交|保存|preserve|notar/i.test(message);
}

function wantsVerify(message: string) {
  return /验证|校验|核验|改过|篡改|是不是|是否|一样|对比|检查|看看|verify|check/i.test(message);
}

function needsExplanation(verification: any) {
  const result = verification?.result ?? verification?.status;
  const reason = verification?.proof?.failure_reason ?? verification?.failure_reason;
  return result === "mismatch" || reason === "proof_missing" || reason === "chain_unavailable";
}

function explanationInputFromVerification(verification: any) {
  const target = verification?.target ?? verification?.matches?.[0] ?? {};
  return {
    assetId: target.asset_id ?? target.asset?.asset_id ?? null,
    versionId: target.version_id ?? target.version?.version_id ?? null,
    scenario: verification?.proof?.failure_reason ?? verification?.failure_reason ?? null
  };
}

function preserveReply(proof: any) {
  const status = proof?.status ?? proof?.proof?.status ?? "preserved";
  if (status === "preserved") {
    return "已经帮你完成存证。以后再上传这份文件，我可以帮你判断它是不是原来的内容。";
  }
  return "已经提交存证，但证明还在确认中。稍后可以再让我检查一次。";
}

function verificationReply(verification: any, explanation: any) {
  const result = verification?.result ?? verification?.status ?? "unknown";
  if (result === "mismatch") {
    return "这份文件和之前存证的版本不一样。它可能被改过，也可能是你上传了一个新版本。";
  }
  if (explanation?.ai_explanation?.summary) {
    return `${result}: ${explanation.ai_explanation.summary}`;
  }
  if (result === "preserved") {
    return "这份文件和之前存证的内容一致。";
  }
  if (result === "not_preserved") {
    return "我没有找到这份文件的存证记录。你可以选择现在为它存证。";
  }
  if (result === "mismatch") {
    return "这份文件和之前存证的版本不一样。";
  }
  return "我检查完了，但当前证明状态还不够明确，需要稍后重试或查看证明详情。";
}

function toToolCallResponse(row: any) {
  return {
    tool_call_id: row.toolCallId,
    tool_name: row.toolName,
    input: JSON.parse(row.inputJson),
    output: row.outputJson ? JSON.parse(row.outputJson) : null,
    status: row.status,
    created_at: row.createdAt
  };
}

function safeFilename(filename: string) {
  return filename.replace(/[^\w.\-]+/g, "_");
}

function normalizeExplanation(verification: any, explanation: any) {
  const result = verification?.result ?? verification?.status;
  if (result !== "mismatch") {
    return explanation;
  }
  const failureReason = explanation?.risk_summary?.failure_reason ?? explanation?.verification_result?.failure_reason;
  if (failureReason === "digest_mismatch") {
    return explanation;
  }
  return {
    explanation_type: "risk",
    risk_summary: {
      status: "failed",
      severity: "high",
      failure_reason: "digest_mismatch",
      requires_manual_review: true
    },
    ai_explanation: {
      summary: "当前文件 SHA-256 与目标存证记录不一致。证明记录仍然存在，但它证明的是另一份内容。",
      risks: ["文件可能被修改，或用户选择了错误的存证目标。"],
      next_checks: ["确认是否应作为新版本提交。", "如声称未修改，请重新上传原始文件。"],
      confidence_note: "AI explanation is not proof; proof comes from structured receipts and verification results.",
      evidence_basis: ["sha256 digest", "verification result", "target proof"]
    },
    raw_explanation: explanation
  };
}

async function improveReply({
  llmClient,
  fallback,
  task,
  payload
}: {
  llmClient: AgentLlmClient | null;
  fallback: string;
  task: string;
  payload: unknown;
}) {
  const generated = await llmClient?.complete({
    system: agentSystemPrompt(),
    user: `任务：${task}\n结构化结果摘要：${JSON.stringify(compactLlmPayload(task, payload))}\n请用中文给用户一句简短、准确的结果说明。`
  });
  return generated || fallback;
}

function compactLlmPayload(task: string, payload: any) {
  if (task === "preserve") {
    return {
      status: payload?.status,
      proof_id: payload?.proof_id,
      sha256: payload?.sha256,
      receipt_status: payload?.proof?.receipt_status,
      anchor_status: payload?.proof?.anchor_status,
      tx_hash: payload?.proof?.tx_hash
    };
  }
  const verification = payload?.verification ?? payload;
  const explanation = payload?.explanation;
  return {
    result: verification?.result ?? verification?.status,
    sha256: verification?.sha256,
    failure_reason: verification?.proof?.failure_reason ?? verification?.failure_reason,
    recorded_sha256: verification?.proof?.recorded_sha256,
    submitted_sha256: verification?.proof?.submitted_sha256 ?? verification?.sha256,
    explanation_summary: explanation?.ai_explanation?.summary,
    next_checks: explanation?.ai_explanation?.next_checks
  };
}

function agentSystemPrompt() {
  return [
    "你是 Chronofact 存证助手。",
    "用户通常不懂区块链、哈希、receipt、fact、tx，也不需要先理解这些词。",
    "你要像一个文件存证助手一样回答：告诉用户发生了什么、结果意味着什么、下一步可以做什么。",
    "不要主动展示模型名、proof_id、fact_id、receipt_id、tx hash、完整 SHA-256，除非用户明确要求。",
    "不要说 AI、区块链细节或内部工具名。",
    "不要声称文件业务内容真实，只能说明文件内容是否和存证版本一致。",
    "如果文件不一致，要温和说明可能是被改过，也可能是新版本。",
    "回复用自然中文，1-2 句话。"
  ].join("\n");
}
