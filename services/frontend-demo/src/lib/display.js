const assetTypeLabels = {
  lab_report: "实验报告",
  result_screenshot: "结果截图",
  assignment: "课程作业",
  exam: "考试材料",
  submission: "学生提交文件",
  course_project: "课程项目",
};

const statusLabels = {
  active: "已启用",
  archived: "已归档",
  pending: "待处理",
  preserved: "已存证",
  not_preserved: "未存证",
  mismatch: "文件不一致",
  proof_unavailable: "证明暂不可用",
  verified: "已核验",
  failed: "未通过",
  unsupported: "暂不可核验",
  recorded: "已上链",
  missing: "未返回",
  available: "可用",
  unknown: "未知",
  under_review: "审核中",
  approved: "已通过",
  needs_revision: "需修改",
  rejected: "已驳回",
  digest_mismatch: "文件摘要不一致",
  proof_missing: "缺少存证证明",
  chain_unavailable: "链端不可用",
};

export function displayValue(value) {
  if (value === undefined || value === null || value === "" || value === "none") {
    return "暂无";
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  return statusLabels[value] || assetTypeLabels[value] || String(value);
}

export function displayAssetType(value) {
  return assetTypeLabels[value] || displayValue(value);
}

export function displayStatus(value) {
  return statusLabels[value] || displayValue(value);
}

export function displayWorkspaceName(workspace) {
  const title = String(workspace?.title || "").trim();
  return title || workspace?.workspace_id || "未命名空间";
}

export function displayDateTime(value) {
  if (!value) {
    return "暂无";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return displayValue(value);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
