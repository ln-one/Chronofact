export const tamperScenarios = {
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
};
