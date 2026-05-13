const scenarios = {
  normalSubmission: {
    label: "实验报告 v1",
    identity_context: {
      user_id: "user_001",
      display_name: "Student A",
      organization_id: "course_001",
      role: "student",
    },
    upload_record: {
      upload_id: "upl_001",
      storage_ref: "dualweave://upl_001",
      filename: "experiment8-report.pdf",
      sha256: "9f2a7c8b4d2e6f1a0c3e5b7d9a11e23f4c56b78d90a12c34e56f7890abcd1234",
      status: "stored",
    },
    asset_version: {
      asset_id: "asset_001",
      asset_type: "lab_report",
      version_no: 1,
      previous_version_id: null,
      sha256: "9f2a7c8b4d2e6f1a0c3e5b7d9a11e23f4c56b78d90a12c34e56f7890abcd1234",
      submitter_id: "user_001",
      timestamp: "2026-05-08 10:30",
    },
    verification_result: {
      status: "verified",
      receipt_status: "available",
      trace_status: "available",
      digest_match: true,
      failure_reason: null,
    },
    proof: {
      receipt_id: "rcpt_001",
      trace_id: "trace_001",
      transaction_hash: "0x3af1a920b7d1e884c915e4b3f6a09bd2",
      timestamp: "2026-05-08 10:30:00",
    },
    ai_explanation: {
      summary: "该文件版本已登记，当前 digest 与记录证据一致。",
      risks: ["暂无明显验证风险。"],
      next_checks: ["人工复核文件内容是否符合提交要求。", "归档 receipt 与 transaction hash。"],
      confidence_note: "AI 解释不构成真实性证明，证明来源为结构化回执与验证结果。",
    },
    timeline: [
      {
        version: "v1",
        digest: "9f2a...1234",
        status: "verified",
        time: "2026-05-08 10:30",
        previous_version_id: "无",
      },
    ],
  },
  tamperedFile: {
    label: "报告复核异常",
    identity_context: {
      user_id: "user_001",
      display_name: "Student A",
      organization_id: "course_001",
      role: "student",
    },
    upload_record: {
      upload_id: "upl_002",
      storage_ref: "dualweave://upl_002",
      filename: "experiment8-report-edited.pdf",
      sha256: "7bad7c8b4d2e6f1a0c3e5b7d9a11e23f4c56b78d90a12c34e56f7890bad999",
      status: "stored",
    },
    asset_version: {
      asset_id: "asset_001",
      asset_type: "lab_report",
      version_no: 1,
      previous_version_id: null,
      sha256: "9f2a7c8b4d2e6f1a0c3e5b7d9a11e23f4c56b78d90a12c34e56f7890abcd1234",
      submitter_id: "user_001",
      timestamp: "2026-05-08 10:30",
    },
    verification_result: {
      status: "failed",
      receipt_status: "available",
      trace_status: "available",
      digest_match: false,
      failure_reason: "digest_mismatch",
    },
    proof: {
      receipt_id: "rcpt_001",
      trace_id: "trace_001",
      transaction_hash: "0x3af1a920b7d1e884c915e4b3f6a09bd2",
      timestamp: "2026-05-08 10:30:00",
    },
    ai_explanation: {
      summary: "当前文件与登记版本的 digest 不一致，不能按已登记版本直接通过验证。",
      risks: ["可能上传了被修改后的文件。", "也可能选择了错误的文件版本。"],
      next_checks: ["重新选择原始提交文件。", "对比页面上的 digest 与登记 receipt。"],
      confidence_note: "AI 解释不构成真实性证明，证明来源为结构化回执与验证结果。",
    },
    timeline: [
      {
        version: "v1",
        digest: "9f2a...1234",
        status: "failed",
        time: "2026-05-08 10:30",
        previous_version_id: "无",
      },
    ],
  },
  missingProof: {
    label: "待回执提交",
    identity_context: {
      user_id: "user_001",
      display_name: "Student A",
      organization_id: "course_001",
      role: "student",
    },
    upload_record: {
      upload_id: "upl_003",
      storage_ref: "dualweave://upl_003",
      filename: "report-without-proof.pdf",
      sha256: "b782c19a0d4f6e8a22c4d6e8f0112233445566778899aabbccddeeff00112233",
      status: "stored",
    },
    asset_version: {
      asset_id: "asset_003",
      asset_type: "assignment",
      version_no: 1,
      previous_version_id: null,
      sha256: "b782c19a0d4f6e8a22c4d6e8f0112233445566778899aabbccddeeff00112233",
      submitter_id: "user_001",
      timestamp: "待确认",
    },
    verification_result: {
      status: "pending",
      receipt_status: "missing",
      trace_status: "missing",
      digest_match: null,
      failure_reason: "proof_missing",
    },
    proof: {
      receipt_id: "未返回",
      trace_id: "未返回",
      transaction_hash: "未返回",
      timestamp: "待确认",
    },
    ai_explanation: {
      summary: "文件 digest 已生成，但 receipt 或 trace 尚未返回，暂时不能完成证明核验。",
      risks: ["系统暂时无法给出完整验证结论。"],
      next_checks: ["等待 receipt 返回。", "稍后重新刷新验证状态。"],
      confidence_note: "AI 解释不构成真实性证明，证明来源为结构化回执与验证结果。",
    },
    timeline: [
      {
        version: "v1",
        digest: "b782...2233",
        status: "pending",
        time: "待确认",
        previous_version_id: "无",
      },
    ],
  },
  chainUnavailable: {
    label: "链路待恢复",
    identity_context: {
      user_id: "user_001",
      display_name: "Student A",
      organization_id: "course_001",
      role: "student",
    },
    upload_record: {
      upload_id: "upl_004",
      storage_ref: "dualweave://upl_004",
      filename: "lab-chain-check.pdf",
      sha256: "d0123456789abcdef00112233445566778899aabbccddeeff001122334455667",
      status: "stored",
    },
    asset_version: {
      asset_id: "asset_004",
      asset_type: "lab_report",
      version_no: 1,
      previous_version_id: null,
      sha256: "d0123456789abcdef00112233445566778899aabbccddeeff001122334455667",
      submitter_id: "user_001",
      timestamp: "2026-05-08 11:12",
    },
    verification_result: {
      status: "unsupported",
      receipt_status: "unavailable",
      trace_status: "unavailable",
      digest_match: null,
      failure_reason: "chain_unavailable",
    },
    proof: {
      receipt_id: "unavailable",
      trace_id: "unavailable",
      transaction_hash: "unavailable",
      timestamp: "unavailable",
    },
    ai_explanation: {
      summary: "无法连接到底层证据链网络获取回执。",
      risks: ["底层证据网络不可达。"],
      next_checks: ["检查 Chronestia 服务或区块链节点状态。"],
      confidence_note: "AI 解释不构成真实性证明，证明来源为结构化回执与验证结果。",
    },
    timeline: [
      {
        version: "v1",
        digest: "d012...5667",
        status: "unsupported",
        time: "2026-05-08 11:12",
        previous_version_id: "无",
      },
    ],
  },
  multiVersion: {
    label: "多版本追踪",
    identity_context: {
      user_id: "user_001",
      display_name: "Student A",
      organization_id: "course_001",
      role: "student",
    },
    upload_record: {
      upload_id: "upl_005",
      storage_ref: "dualweave://upl_005",
      filename: "experiment8-report-v2.pdf",
      sha256: "e2456a7890abcdef11223344556677889900aabbccddeeff0011223344558899",
      status: "stored",
    },
    asset_version: {
      asset_id: "asset_001",
      asset_type: "lab_report",
      version_no: 2,
      previous_version_id: "asset_001:v1",
      sha256: "e2456a7890abcdef11223344556677889900aabbccddeeff0011223344558899",
      submitter_id: "user_001",
      timestamp: "2026-05-08 14:20",
    },
    verification_result: {
      status: "verified",
      receipt_status: "available",
      trace_status: "available",
      digest_match: true,
      failure_reason: null,
    },
    proof: {
      receipt_id: "rcpt_005",
      trace_id: "trace_001_v2",
      transaction_hash: "0x7b92c41f44d7c35a8c77fa8a2f09e8b6",
      timestamp: "2026-05-08 14:20:00",
    },
    ai_explanation: {
      summary: "该文件为 v2 修订版本，当前 digest 与 v2 登记记录一致，并能追溯到上一版本。",
      risks: ["需要确认 v2 修改内容是否符合课程提交要求。"],
      next_checks: ["人工对比 v1 与 v2 的修改范围。", "确认 previous_version_id 指向正确的上一版记录。"],
      confidence_note: "AI 解释不构成真实性证明，证明来源为结构化回执与验证结果。",
    },
    timeline: [
      {
        version: "v1",
        digest: "9f2a...1234",
        status: "verified",
        time: "2026-05-08 10:30",
        previous_version_id: "无",
      },
      {
        version: "v2",
        digest: "e245...8899",
        status: "verified",
        time: "2026-05-08 14:20",
        previous_version_id: "asset_001:v1",
      },
    ],
  },
  uploadFailed: {
    label: "上传失败",
    identity_context: {
      user_id: "user_001",
      display_name: "Student A",
      organization_id: "course_001",
      role: "student",
    },
    upload_record: {
      upload_id: "upl_006",
      storage_ref: "unavailable",
      filename: "large-report.pdf",
      sha256: "未生成",
      status: "failed",
    },
    asset_version: {
      asset_id: "未创建",
      asset_type: "lab_report",
      version_no: 0,
      previous_version_id: null,
      sha256: "未生成",
      submitter_id: "user_001",
      timestamp: "未创建",
    },
    verification_result: {
      status: "failed",
      receipt_status: "missing",
      trace_status: "missing",
      digest_match: null,
      failure_reason: "upload_failed",
    },
    proof: {
      receipt_id: "未创建",
      trace_id: "未创建",
      transaction_hash: "未创建",
      timestamp: "未创建",
    },
    ai_explanation: {
      summary: "文件上传未完成，系统没有生成可用于证明的资产版本或回执。",
      risks: ["当前没有可核验的 digest、receipt 或 trace。"],
      next_checks: ["重新上传文件。", "检查文件大小、网络状态和本地存储服务。"],
      confidence_note: "AI 解释不构成真实性证明，证明来源为结构化回执与验证结果。",
    },
    timeline: [],
  },
  aiExplanationUnavailable: {
    label: "AI 解释不可用",
    identity_context: {
      user_id: "user_001",
      display_name: "Student A",
      organization_id: "course_001",
      role: "student",
    },
    upload_record: {
      upload_id: "upl_007",
      storage_ref: "dualweave://upl_007",
      filename: "experiment8-report-ai-timeout.pdf",
      sha256: "a98f76543210fedcba00112233445566778899aabbccddeeff00112233445566",
      status: "stored",
    },
    asset_version: {
      asset_id: "asset_007",
      asset_type: "lab_report",
      version_no: 1,
      previous_version_id: null,
      sha256: "a98f76543210fedcba00112233445566778899aabbccddeeff00112233445566",
      submitter_id: "user_001",
      timestamp: "2026-05-08 15:05",
    },
    verification_result: {
      status: "verified",
      receipt_status: "available",
      trace_status: "available",
      digest_match: true,
      failure_reason: "ai_explanation_unavailable",
    },
    proof: {
      receipt_id: "rcpt_007",
      trace_id: "trace_007",
      transaction_hash: "0x91bc274eb33fa48e92a5d3310cdd5a08",
      timestamp: "2026-05-08 15:05:00",
    },
    ai_explanation: {
      summary: "结构化回执与核验结果可用，但 AI 解释服务暂时不可用。",
      risks: ["AI 文案缺失不影响 digest、receipt、trace 和 verification result 的证明地位。"],
      next_checks: ["人工查看回执字段。", "稍后重试 AI explanation 服务。"],
      confidence_note: "AI 解释不可用时，证明来源仍然是结构化回执与验证结果。",
    },
    timeline: [
      {
        version: "v1",
        digest: "a98f...5566",
        status: "verified",
        time: "2026-05-08 15:05",
        previous_version_id: "无",
      },
    ],
  },
};

const apiBaseUrl = import.meta.env.VITE_CHRONOFACT_API_URL?.replace(/\/+$/, "");
let liveScenarioKey = null;
let liveScenarioData = null;
let liveAssetId = null;
let liveVersionId = null;
let liveSubmittedContentText = null;

export function isLiveApiEnabled() {
  return Boolean(apiBaseUrl);
}

export function listScenarios() {
  return Object.entries(scenarios).map(([key, value]) => ({
    key,
    label: value.label,
    status: value.verification_result.status,
    failure_reason: value.verification_result.failure_reason,
  }));
}

export function getScenario(key) {
  if (apiBaseUrl && liveScenarioKey === key && liveScenarioData) {
    return liveScenarioData;
  }
  return scenarios[key] || scenarios.normalSubmission;
}

export async function submitUpload(file, scenarioKey) {
  if (apiBaseUrl) {
    return submitUploadToBackend(file, scenarioKey);
  }

  const scenario = getScenario(scenarioKey);
  return {
    upload_record: {
      ...scenario.upload_record,
      filename: file?.name || scenario.upload_record.filename,
      size: file?.size || null,
    },
    asset_version: scenario.asset_version,
  };
}

export async function getAssetDetail(scenarioKey) {
  if (apiBaseUrl && liveAssetId && liveScenarioKey === scenarioKey) {
    const detail = await requestJson(`/assets/${liveAssetId}`);
    liveScenarioData = normalizeScenario({
      fallback: scenarios[scenarioKey] || scenarios.normalSubmission,
      base: liveScenarioData,
      detail,
    });
    return {
      ...pickAssetDetail(liveScenarioData),
      scenarioData: liveScenarioData,
    };
  }

  const scenario = getScenario(scenarioKey);
  return {
    identity_context: scenario.identity_context,
    upload_record: scenario.upload_record,
    asset_version: scenario.asset_version,
    timeline: scenario.timeline,
  };
}

export async function getVerificationResult(scenarioKey) {
  if (apiBaseUrl && liveVersionId && liveScenarioKey === scenarioKey) {
    const verifyScenario = scenarioToVerificationScenario(scenarioKey);
    const content_text =
      scenarioKey === "tamperedFile"
        ? `${liveSubmittedContentText || "chronofact"} tampered`
        : liveSubmittedContentText;
    const verified = await requestJson("/verify", {
      method: "POST",
      body: {
        version_id: liveVersionId,
        content_text,
        ...(verifyScenario ? { scenario: verifyScenario } : {}),
      },
    });
    liveScenarioData = normalizeScenario({
      fallback: scenarios[scenarioKey] || scenarios.normalSubmission,
      base: liveScenarioData,
      response: verified,
    });
    return {
      verification_result: liveScenarioData.verification_result,
      proof: liveScenarioData.proof,
      scenarioData: liveScenarioData,
    };
  }

  const scenario = getScenario(scenarioKey);
  return {
    verification_result: scenario.verification_result,
    proof: scenario.proof,
  };
}

export async function getAiExplanation(scenarioKey) {
  if (apiBaseUrl && liveScenarioKey === scenarioKey && liveScenarioData) {
    return {
      ...liveScenarioData.ai_explanation,
      scenarioData: liveScenarioData,
    };
  }
  return getScenario(scenarioKey).ai_explanation;
}

async function submitUploadToBackend(file, scenarioKey) {
  const fallback = scenarios[scenarioKey] || scenarios.normalSubmission;
  liveScenarioKey = scenarioKey;
  liveScenarioData = null;
  liveAssetId = null;
  liveVersionId = null;
  liveSubmittedContentText = await fileToText(file);

  try {
    if (scenarioKey === "multiVersion") {
      const first = await requestJson("/assets", {
        method: "POST",
        body: {
          filename: `${stripExtension(file?.name || "report.txt")}-v1.txt`,
          asset_type: fallback.asset_version.asset_type,
          content_text: `${liveSubmittedContentText}\nversion 1`,
        },
      });
      const secondContent = `${liveSubmittedContentText}\nversion 2`;
      const second = await requestJson(`/assets/${first.asset_version.asset_id}/versions`, {
        method: "POST",
        body: {
          filename: file?.name || fallback.upload_record.filename,
          content_text: secondContent,
        },
      });
      liveSubmittedContentText = secondContent;
      liveAssetId = second.asset_version.asset_id;
      liveVersionId = second.asset_version.version_id;
      const detail = await requestJson(`/assets/${liveAssetId}`);
      liveScenarioData = normalizeScenario({ fallback, response: second, detail });
      return {
        upload_record: liveScenarioData.upload_record,
        asset_version: liveScenarioData.asset_version,
        scenarioData: liveScenarioData,
      };
    }

    const response = await requestJson("/assets", {
      method: "POST",
      body: {
        filename: file?.name || fallback.upload_record.filename,
        asset_type: fallback.asset_version.asset_type,
        content_text: liveSubmittedContentText,
        ...(scenarioKey === "uploadFailed" ? { scenario: "upload_failed" } : {}),
      },
    });
    liveAssetId = response.asset_version.asset_id;
    liveVersionId = response.asset_version.version_id;
    liveScenarioData = normalizeScenario({ fallback, response });
    return {
      upload_record: liveScenarioData.upload_record,
      asset_version: liveScenarioData.asset_version,
      scenarioData: liveScenarioData,
    };
  } catch (error) {
    liveScenarioData = {
      ...fallback,
      verification_result: {
        ...fallback.verification_result,
        failure_reason: error.code || fallback.verification_result.failure_reason,
      },
      ai_explanation: {
        ...fallback.ai_explanation,
        summary: error.message || fallback.ai_explanation.summary,
      },
    };
    return {
      upload_record: liveScenarioData.upload_record,
      asset_version: liveScenarioData.asset_version,
      scenarioData: liveScenarioData,
    };
  }
}

function scenarioToVerificationScenario(scenarioKey) {
  return {
    missingProof: "proof_missing",
    chainUnavailable: "chain_unavailable",
    aiExplanationUnavailable: "ai_unavailable",
  }[scenarioKey];
}

function normalizeScenario({ fallback, base, response, detail }) {
  const source = response || base || {};
  const assetVersion = response?.asset_version || base?.asset_version || fallback.asset_version;
  const verification = response?.verification_result || base?.verification_result || fallback.verification_result;
  const upload = response?.upload_record || base?.upload_record || fallback.upload_record;
  const identity = response?.identity_context || base?.identity_context || fallback.identity_context;
  const witness = response?.witness_record || assetVersion?.witness_record || {};
  const timelineVersions = detail?.versions || base?.versions || [assetVersion];
  const timestamp = witness.recorded_at || assetVersion.created_at || fallback.proof.timestamp;
  const aiExplanation = response?.ai_explanation || base?.ai_explanation || fallback.ai_explanation;
  const aiError = response?.ai_explanation_error;

  return {
    ...fallback,
    identity_context: identity,
    upload_record: upload,
    asset_version: {
      ...fallback.asset_version,
      ...assetVersion,
      timestamp,
    },
    verification_result: verification,
    proof: {
      receipt_id: assetVersion.receipt_id || witness.receipt_id || fallback.proof.receipt_id,
      trace_id: assetVersion.fact_id || fallback.proof.trace_id,
      transaction_hash: witness.tx_hash || fallback.proof.transaction_hash,
      timestamp,
    },
    ai_explanation: aiError
      ? {
          summary: aiError.message,
          risks: ["AI explanation is unavailable; structured verification remains the proof source."],
          next_checks: ["Review receipt, trace, digest, and verification result manually."],
          confidence_note: "AI 解释不可用时，证明来源仍然是结构化回执与验证结果。",
        }
      : aiExplanation,
    timeline: timelineVersions.map((version) => ({
      version: `v${version.version_no}`,
      digest: shortenDigest(version.sha256),
      status: version.version_id === assetVersion.version_id ? verification.status : "verified",
      time: version.created_at || timestamp,
      previous_version_id: version.previous_version_id || "无",
    })),
    raw_backend_response: source,
  };
}

function pickAssetDetail(scenario) {
  return {
    identity_context: scenario.identity_context,
    upload_record: scenario.upload_record,
    asset_version: scenario.asset_version,
    timeline: scenario.timeline,
  };
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Request failed with ${response.status}`);
    error.code = payload.error?.code;
    throw error;
  }
  return payload;
}

async function fileToText(file) {
  if (!file) {
    return "chronofact demo content";
  }
  return file.text();
}

function stripExtension(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

function shortenDigest(digest = "") {
  if (digest.length <= 12) {
    return digest || "unknown";
  }
  return `${digest.slice(0, 4)}...${digest.slice(-4)}`;
}
