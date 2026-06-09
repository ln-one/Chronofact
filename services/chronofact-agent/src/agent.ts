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
  conversation_id: z.string().min(1),
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

export const runSchema = chatSchema.extend({
  conversation_id: z.string().min(1)
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
      const toolCall = store.addToolCall({
        conversationId: conversation.conversationId,
        toolName: "uploadFileContext",
        input: {
          filename: parsed.filename,
          mimeType: parsed.mime_type ?? null,
          size: content.byteLength
        },
        output: {
          file_id: file.fileId,
          filename: file.filename,
          sha256: file.sha256,
          size: file.size
        },
        status: "completed"
      });

      return {
        conversation_id: conversation.conversationId,
        file_id: file.fileId,
        sha256: file.sha256,
        filename: file.filename,
        size: file.size,
        tool_call: toToolCallResponse(toolCall)
      };
    },

    startRun(input: z.infer<typeof runSchema>) {
      const parsed = runSchema.parse(input);
      const conversation = store.ensureConversation(parsed.conversation_id);
      const conversationId = conversation.conversationId;
      const file = resolveFile(store, conversationId, parsed.file_id);
      const action = inferAction(parsed.message);
      const userMessage = store.addMessage({
        conversationId,
        role: "user",
        content: parsed.message,
        metadata: {
          file_id: file?.fileId ?? parsed.file_id ?? null
        }
      });
      maybeRenameConversation(store, conversation, parsed.message);
      const assistantMessage = store.addMessage({
        conversationId,
        role: "assistant",
        content: "正在检查文件和存证记录...",
        status: "running",
        metadata: {
          file_id: file?.fileId ?? parsed.file_id ?? null,
          action,
          action_required: null,
          tool_call_ids: []
        }
      });
      const run = store.createRun({
        conversationId,
        userMessageId: userMessage.messageId,
        assistantMessageId: assistantMessage.messageId,
        fileId: file?.fileId ?? parsed.file_id ?? null,
        action
      });

      setTimeout(() => {
        void completeRun({
          parsed,
          runId: run.runId,
          assistantMessageId: assistantMessage.messageId,
          conversationId
        });
      }, 0);

      return {
        conversation_id: conversationId,
        run: toRunContext(run),
        user_message: toMessageContext(userMessage),
        assistant_message: toMessageContext(assistantMessage),
        current_file: file ? toFileContext(file) : null
      };
    },

    async chat(input: z.infer<typeof chatSchema>) {
      const parsed = chatSchema.parse(input);
      const conversation = store.ensureConversation(parsed.conversation_id);
      const conversationId = conversation.conversationId;
      const organizationId = parsed.organization_id ?? defaultOrganizationId;
      const file = resolveFile(store, conversationId, parsed.file_id);
      const plannedAction = await planAgentAction({ llmClient, message: parsed.message, file });
      const userMessage = store.addMessage({
        conversationId,
        role: "user",
        content: parsed.message,
        metadata: {
          file_id: file?.fileId ?? parsed.file_id ?? null
        }
      });
      maybeRenameConversation(store, conversation, parsed.message);

      if (plannedAction === "preserve") {
        if (!file) {
          return reply(store, conversationId, "请先上传一个文件，我才能计算摘要并提交存证。", {
            user_message: toMessageContext(userMessage),
            action: "preserve",
            action_required: null
          });
        }
        if (!parsed.confirmed_action) {
          const versionTarget = resolveVersionPreserveTarget(store, file);
          return reply(
            store,
            conversationId,
            versionTarget
              ? `已读取 ${file.filename}，文件指纹是 ${shortSha(file.sha256)}。它会作为这个文件的新版本存证，请点击确认。`
              : `已读取 ${file.filename}，文件指纹是 ${shortSha(file.sha256)}。如果要把这份文件正式存证，请点击确认存证。`,
            {
              user_message: toMessageContext(userMessage),
              action: "preserve",
              file: toFileContext(file),
              action_required: {
                type: "confirm_preserve",
                label: versionTarget ? "确认作为新版本存证" : "确认存证",
                file_id: file.fileId
              }
            }
          );
        }

        const { proof, toolCall } = await preserveFileVersionAware({ organizationId, file, conversationId });
        const content = await improveReply({
          llmClient,
          fallback: preserveReply(proof),
          task: "preserve",
          payload: proof
        });
        return reply(store, conversationId, content, {
          user_message: toMessageContext(userMessage),
          tool_calls: [toToolCallResponse(toolCall)],
          proof,
          file: toFileContext(store.getFile(file.fileId) ?? file),
          action: "preserve",
          action_required: null
        });
      }

      if (plannedAction === "verify") {
        if (!file) {
          return reply(store, conversationId, "请先上传要验证的文件。", {
            user_message: toMessageContext(userMessage),
            action: "verify",
            action_required: null
          });
        }
        const proofTarget = resolveProofTarget(store, file);
        const toolInput = {
          organizationId,
          sha256: file.sha256,
          proofId: proofTarget.proofId
        };
        const verification = annotateVerification(await tools.verifyEvidence.execute!(toolInput, {} as any), proofTarget, file);
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
          user_message: toMessageContext(userMessage),
          tool_calls: calls,
          verification,
          explanation,
          file: toFileContext(file),
          action: "verify",
          action_required: null
        });
      }

      const generalReply = await llmClient?.complete({
        system: agentSystemPrompt(),
        user: generalPrompt(parsed.message, file)
      });
      return reply(store, conversationId, guardGeneralReply(generalReply, file), {
        user_message: toMessageContext(userMessage),
        action: "chat",
        file: file ? toFileContext(file) : null,
        action_required: null
      });
    }
  };

  async function completeRun({
    parsed,
    runId,
    assistantMessageId,
    conversationId
  }: {
    parsed: z.infer<typeof runSchema>;
    runId: string;
    assistantMessageId: string;
    conversationId: string;
  }) {
    let plannedAction = inferAction(parsed.message);
    try {
      const organizationId = parsed.organization_id ?? defaultOrganizationId;
      const file = resolveFile(store, conversationId, parsed.file_id);
      plannedAction = await planAgentAction({ llmClient, message: parsed.message, file });
      const complete = (content: string, extra: Record<string, unknown> = {}) => {
        const toolCalls = Array.isArray(extra.tool_calls) ? (extra.tool_calls as any[]) : [];
        const metadata = {
          file_id: (extra.file as any)?.file_id ?? file?.fileId ?? parsed.file_id ?? null,
          action: extra.action ?? plannedAction,
          action_required: extra.action_required ?? null,
          tool_call_ids: toolCalls.map((call) => call.tool_call_id)
        };
        const updated = store.updateMessage({
          messageId: assistantMessageId,
          content,
          status: "completed",
          metadata
        });
        store.updateRun({
          runId,
          status: "completed",
          action: typeof extra.action === "string" ? extra.action : plannedAction
        });
        return updated;
      };

      if (plannedAction === "preserve") {
        if (!file) {
          complete("请先上传一个文件，我才能计算摘要并提交存证。", {
            action: "preserve",
            action_required: null
          });
          return;
        }
        if (!parsed.confirmed_action) {
          const versionTarget = resolveVersionPreserveTarget(store, file);
          complete(versionTarget
            ? `已读取 ${file.filename}，文件指纹是 ${shortSha(file.sha256)}。它会作为这个文件的新版本存证，请点击确认。`
            : `已读取 ${file.filename}，文件指纹是 ${shortSha(file.sha256)}。如果要把这份文件正式存证，请点击确认存证。`, {
            action: "preserve",
            file: toFileContext(file),
            action_required: {
              type: "confirm_preserve",
              label: versionTarget ? "确认作为新版本存证" : "确认存证",
              file_id: file.fileId
            }
          });
          return;
        }

        const { proof, toolCall } = await preserveFileVersionAware({ organizationId, file, conversationId });
        const content = await improveReply({
          llmClient,
          fallback: preserveReply(proof),
          task: "preserve",
          payload: proof
        });
        complete(content, {
          tool_calls: [toToolCallResponse(toolCall)],
          proof,
          file: toFileContext(store.getFile(file.fileId) ?? file),
          action: "preserve",
          action_required: null
        });
        return;
      }

      if (plannedAction === "verify") {
        if (!file) {
          complete("请先上传要验证的文件。", {
            action: "verify",
            action_required: null
          });
          return;
        }
        const proofTarget = resolveProofTarget(store, file);
        const toolInput = {
          organizationId,
          sha256: file.sha256,
          proofId: proofTarget.proofId
        };
        const verification = annotateVerification(await tools.verifyEvidence.execute!(toolInput, {} as any), proofTarget, file);
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
        complete(content, {
          tool_calls: calls,
          verification,
          explanation,
          file: toFileContext(file),
          action: "verify",
          action_required: null
        });
        return;
      }

      const generalReply = await llmClient?.complete({
        system: agentSystemPrompt(),
        user: generalPrompt(parsed.message, file)
      });
      complete(guardGeneralReply(generalReply, file), {
        action: "chat",
        file: file ? toFileContext(file) : null,
        action_required: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      store.updateMessage({
        messageId: assistantMessageId,
        content: "这次检查没有完成。请稍后重试，或者重新上传文件再试一次。",
        status: "failed",
        metadata: {
          file_id: parsed.file_id ?? null,
          action: plannedAction,
          action_required: null,
          tool_call_ids: []
        }
      });
      store.updateRun({ runId, status: "failed", error: message });
    }
  }

  async function preserveFileVersionAware({
    organizationId,
    file,
    conversationId
  }: {
    organizationId: string;
    file: StoredFile;
    conversationId: string;
  }) {
    const versionTarget = resolveVersionPreserveTarget(store, file);
    let toolName = versionTarget ? "preserveEvidenceVersion" : "preserveEvidence";
    let toolInput = versionTarget
      ? {
          organizationId,
          assetId: versionTarget.assetId,
          filename: file.filename,
          sha256: file.sha256
        }
      : {
          organizationId,
          filename: file.filename,
          sha256: file.sha256
        };
    let mode: "preserve" | "version" = versionTarget ? "version" : "preserve";
    let rawProof: any;
    try {
      rawProof = versionTarget
        ? await tools.preserveEvidenceVersion.execute!(toolInput as any, {} as any)
        : await tools.preserveEvidence.execute!(toolInput as any, {} as any);
    } catch (error) {
      if (!versionTarget || !isMissingRemoteAsset(error)) {
        throw error;
      }
      toolName = "preserveEvidence";
      toolInput = {
        organizationId,
        filename: file.filename,
        sha256: file.sha256
      };
      mode = "preserve";
      rawProof = await tools.preserveEvidence.execute!(toolInput as any, {} as any);
    }
    const proof = normalizePreserveResult(rawProof, mode);
    const toolCall = store.addToolCall({
      conversationId,
      toolName,
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
    return { proof, toolCall };
  }
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
  const assistantMessage = store.addMessage({
    conversationId,
    role: "assistant",
    content,
    metadata: {
      file_id: (extra.file as any)?.file_id ?? null,
      action: extra.action ?? null,
      action_required: extra.action_required ?? null,
      tool_call_ids: Array.isArray(extra.tool_calls)
        ? (extra.tool_calls as any[]).map((call) => call.tool_call_id)
        : []
    }
  });
  return {
    conversation_id: conversationId,
    reply: content,
    assistant_message: toMessageContext(assistantMessage),
    tool_calls: [],
    proof: null,
    verification: null,
    explanation: null,
    ...extra
  };
}

function wantsPreserve(message: string) {
  if (/有没有存证|是否存证|存证了吗|有存证吗/.test(message)) {
    return false;
  }
  return /帮我存证|确认存证|提交存证|正式存证|保存存证|为.{0,8}存证|现在.{0,8}存证|存证这个文件|把.{0,8}存证|preserve|notar/i.test(message);
}

function wantsVerify(message: string) {
  return /有没有存证|是否存证|存证了吗|验证|校验|核验|改过|篡改|是不是|是否|一样|对比|检查|看看|怎么样|什么问题|verify|check/i.test(message);
}

function inferAction(message: string) {
  if (wantsPreserve(message)) return "preserve";
  if (wantsVerify(message)) return "verify";
  return "chat";
}

async function planAgentAction({
  llmClient,
  message,
  file
}: {
  llmClient: AgentLlmClient | null;
  message: string;
  file: StoredFile | null;
}): Promise<"preserve" | "verify" | "chat"> {
  const fallback = inferAction(message) as "preserve" | "verify" | "chat";
  const choice = await llmClient?.chooseTool({
    system: [
      "你是 Chronofact Agent 的工具调度器。",
      "你只决定下一步应该调用哪个工具，不回答用户。",
      "如果用户想知道文件有没有存证、是否一致、是否被改过、有没有问题，选择 verifyEvidence。",
      "如果用户要求正式存证、确认存证、保存当前文件，选择 preserveEvidence。",
      "如果只是闲聊、解释能力、没有明确文件操作，选择 chatOnly。",
      "不要编造文件指纹；后端会从当前文件上下文填入工具参数。"
    ].join("\n"),
    user: [
      file
        ? `当前文件：${file.filename}\nSHA-256：${file.sha256}`
        : "当前没有文件。",
      `用户消息：${message}`
    ].join("\n"),
    tools: [
      {
        name: "verifyEvidence",
        description: "Check whether the current file has evidence or matches a preserved version."
      },
      {
        name: "preserveEvidence",
        description: "Preserve the current file or confirm preservation of the current file."
      },
      {
        name: "chatOnly",
        description: "Answer without calling Chronofact evidence tools."
      }
    ]
  });

  if (choice?.toolName === "verifyEvidence") return "verify";
  if (choice?.toolName === "preserveEvidence" || choice?.toolName === "preserveEvidenceVersion") return "preserve";
  if (choice?.toolName === "chatOnly") return "chat";
  return fallback;
}

function needsExplanation(verification: any) {
  if (verification?.agent_classification === "possible_new_version") {
    return false;
  }
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
  if (proof?.agent_preserve_mode === "version") {
    const versionNo = proof?.version?.version_no ?? proof?.asset_version?.version_no;
    return versionNo
      ? `已经作为第 ${versionNo} 版完成存证。以后可以按版本核对这份文件有没有变化。`
      : "已经作为新版本完成存证。以后可以按版本核对这份文件有没有变化。";
  }
  const status = proof?.status ?? proof?.proof?.status ?? "preserved";
  if (status === "preserved") {
    return "已经帮你完成存证。以后再上传这份文件，我可以帮你判断它是不是原来的内容。";
  }
  return "已经提交存证，但证明还在确认中。稍后可以再让我检查一次。";
}

function verificationReply(verification: any, explanation: any) {
  const result = verification?.result ?? verification?.status ?? "unknown";
  if (verification?.agent_classification === "possible_new_version") {
    const filename = verification?.agent_context?.filename;
    return filename
      ? `系统里已有 ${filename} 的旧版本。这次上传的内容不同，可以作为这个文件的新版本存证。`
      : "系统里已有同名文件的旧版本。这次上传的内容不同，可以作为这个文件的新版本存证。";
  }
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

function toMessageContext(row: any) {
  return {
    message_id: row.messageId,
    conversation_id: row.conversationId,
    role: row.role,
    content: row.content,
    status: row.status,
    metadata: row.metadataJson ? JSON.parse(row.metadataJson) : null,
    created_at: row.createdAt
  };
}

function toRunContext(row: any) {
  return {
    run_id: row.runId,
    conversation_id: row.conversationId,
    user_message_id: row.userMessageId,
    assistant_message_id: row.assistantMessageId,
    file_id: row.fileId,
    action: row.action,
    status: row.status,
    error: row.error,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    completed_at: row.completedAt
  };
}

function toFileContext(file: StoredFile) {
  return {
    file_id: file.fileId,
    filename: file.filename,
    sha256: file.sha256,
    size: file.size,
    proof_id: file.proofId
  };
}

function resolveProofTarget(store: AgentStore, file: StoredFile) {
  if (file.proofId) {
    return {
      proofId: file.proofId,
      relation: "current_file",
      previousFile: null as StoredFile | null
    };
  }
  const previousSameName = store.latestPreservedFileByFilename({
    filename: file.filename,
    excludeFileId: file.fileId
  });
  if (!previousSameName) {
    return {
      proofId: null,
      relation: "digest_lookup",
      previousFile: null as StoredFile | null
    };
  }
  return {
    proofId: previousSameName.proofId,
    relation: previousSameName.sha256 === file.sha256 ? "same_filename_same_digest" : "same_filename_different_digest",
    previousFile: previousSameName
  };
}

function resolveVersionPreserveTarget(store: AgentStore, file: StoredFile) {
  if (file.proofId) {
    return null;
  }
  const previousFile = store.latestPreservedFileByFilename({
    filename: file.filename,
    excludeFileId: file.fileId
  });
  if (!previousFile || previousFile.sha256 === file.sha256) {
    return null;
  }
  const snapshot = store.latestProofSnapshotForFile(previousFile.fileId);
  const proof = snapshot ? JSON.parse(snapshot.snapshotJson) : null;
  const assetId = proof?.asset?.asset_id
    ?? proof?.version?.asset_id
    ?? proof?.asset_version?.asset_id
    ?? proof?.preservation_record?.asset_id
    ?? null;
  if (!assetId) {
    return null;
  }
  return {
    assetId,
    previousFile
  };
}

function annotateVerification(verification: any, proofTarget: ReturnType<typeof resolveProofTarget>, file: StoredFile) {
  if (proofTarget.relation !== "same_filename_different_digest" || (verification?.result ?? verification?.status) !== "mismatch") {
    return verification;
  }
  return {
    ...verification,
    agent_classification: "possible_new_version",
    agent_context: {
      filename: file.filename,
      file_id: file.fileId,
      sha256: file.sha256,
      compared_to_file_id: proofTarget.previousFile?.fileId ?? null,
      compared_to_sha256: proofTarget.previousFile?.sha256 ?? null,
      reason: "same_filename_different_digest"
    }
  };
}

function normalizePreserveResult(proof: any, mode: "preserve" | "version") {
  if (mode === "preserve") {
    return proof;
  }
  const preservationRecord = proof?.preservation_record ?? null;
  const witnessRecord = proof?.witness_record ?? null;
  const verificationResult = proof?.verification_result ?? null;
  const assetVersion = proof?.asset_version ?? proof?.version ?? null;
  return {
    ...proof,
    agent_preserve_mode: "version",
    status: verificationResult?.status === "verified" ? "preserved" : verificationResult?.status ?? "preserved",
    proof_id: proof?.proof_id ?? preservationRecord?.preservation_id ?? null,
    version: assetVersion,
    proof: proof?.proof ?? {
      provider: witnessRecord?.provider ?? "chronestia",
      fact_id: witnessRecord?.fact_id ?? null,
      receipt_id: witnessRecord?.receipt_id ?? null,
      anchor_status: witnessRecord?.anchor_status ?? null,
      transaction_hash: witnessRecord?.tx_hash ?? null,
      receipt_status: verificationResult?.receipt_status ?? null,
      trace_status: verificationResult?.trace_status ?? null,
      verification_status: verificationResult?.status ?? null,
      failure_reason: verificationResult?.failure_reason ?? null
    }
  };
}

function isMissingRemoteAsset(error: unknown) {
  const status = (error as any)?.status;
  const message = error instanceof Error ? error.message : "";
  return status === 404 && /asset/i.test(message);
}

function maybeRenameConversation(store: AgentStore, conversation: any, message: string) {
  if (conversation.title !== "Chronofact conversation" && conversation.title !== "新对话") {
    return;
  }
  const compact = message
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：,.!?;:"“”'‘’()[\]{}<>《》]/g, "");
  const title = [...(compact || "新对话")].slice(0, 18).join("");
  store.updateConversationTitle({ conversationId: conversation.conversationId, title });
}

function shortSha(sha256: string) {
  return `${sha256.slice(0, 10)}...${sha256.slice(-6)}`;
}

function generalPrompt(message: string, file: StoredFile | null) {
  const fileContext = file
    ? `当前文件：${file.filename}\n文件指纹短号：${shortSha(file.sha256)}\n文件已经在本轮对话上下文里，用户说“它/这个文件/当前文件”都指这份文件。`
    : "当前没有文件。";
  return [
    fileContext,
    `用户消息：${message}`,
    "如果用户表达的是存证、验证、查询存证，请提醒他可以直接点按钮或继续发指令；不要假装不知道当前文件。",
    "回复自然中文，最多两句话，不要输出 Markdown 列表。"
  ].join("\n");
}

function guardGeneralReply(generated: string | null | undefined, file: StoredFile | null) {
  const fallback = file
    ? `我看到当前文件是 ${file.filename}。你可以直接问“验证这个文件”，或者让我“帮你存证这个文件”。`
    : "你可以把文件拖进对话框，然后问我它有没有存证、是否被改过，或者让我帮你正式存证。";
  if (!generated) {
    return fallback;
  }
  if (file && /哪个文件|哪一个文件|请上传|告诉我文件名/.test(generated)) {
    return fallback;
  }
  return generated;
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
  if (task === "preserve" && (payload as any)?.agent_preserve_mode === "version") {
    return fallback;
  }
  if (task === "verify" && (payload as any)?.verification?.agent_classification === "possible_new_version") {
    return fallback;
  }
  const generated = await llmClient?.complete({
    system: agentSystemPrompt(),
    user: `任务：${task}\n结构化结果摘要：${JSON.stringify(compactLlmPayload(task, payload))}\n请用中文给用户一句简短、准确的结果说明。`
  });
  if (generated && contradictsStructuredResult(task, payload, generated)) {
    return fallback;
  }
  return generated || fallback;
}

function contradictsStructuredResult(task: string, payload: any, generated: string) {
  if (task !== "verify") {
    return false;
  }
  const verification = payload?.verification ?? payload;
  const result = verification?.result ?? verification?.status;
  if (result === "not_preserved") {
    return /一致|通过|成功|已存证|失效|过期/.test(generated);
  }
  if (result === "preserved") {
    return /没有找到|未找到|未存证|不一致|不一样|失败|失效|过期/.test(generated);
  }
  if (result === "mismatch") {
    return /完全一致|没有被修改|验证通过/.test(generated);
  }
  return false;
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
