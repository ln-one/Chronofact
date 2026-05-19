export const MOCK_CONTRACT = {
  identity_context: {
    user_id: "user_001",
    display_name: "Student A",
    organization_id: "course_001",
    role: "student"
  },
  upload_record: {
    upload_id: "upl_001",
    storage_ref: "dualweave://upl_001",
    filename: "report.pdf",
    sha256: "abc123",
    status: "stored"
  },
  asset_version: {
    asset_id: "asset_001",
    asset_type: "lab_report",
    version_no: 1,
    previous_version_id: null,
    sha256: "abc123",
    submitter_id: "user_001"
  },
  verification_result: {
    status: "verified",
    digest_match: true,
    receipt_status: "available",
    trace_status: "available",
    failure_reason: null
  },
  ai_explanation: {
    summary: "该文件版本已登记，当前摘要与记录一致。",
    risks: [],
    next_checks: ["人工复核文件内容是否符合提交要求"],
    confidence_note: "AI 解释不构成真实性证明，证明来源为结构化回执与验证结果。"
  }
};
