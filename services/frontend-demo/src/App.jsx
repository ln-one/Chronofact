import { useMemo, useState } from "react";
import {
  getAiExplanation,
  getAssetDetail,
  getScenario,
  getVerificationResult,
  isLiveApiEnabled,
  listScenarios,
  submitUpload,
} from "./services/mockChronofactApi";

const statusConfig = {
  verified: {
    color: "text-green-800 bg-green-100",
    border: "border-green-200",
    dot: "bg-green-500",
  },
  failed: {
    color: "text-red-800 bg-red-100",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  pending: {
    color: "text-amber-800 bg-amber-100",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  unsupported: {
    color: "text-slate-800 bg-slate-100",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

export default function App() {
  const [currentPage, setCurrentPage] = useState("project");
  const [scenarioKey, setScenarioKey] = useState("normalSubmission");
  const [selectedFile, setSelectedFile] = useState(null);
  const [workflowStage, setWorkflowStage] = useState("idle");
  const [aiGenerated, setAiGenerated] = useState(true);
  const [summaryReady, setSummaryReady] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const data = liveData || getScenario(scenarioKey);
  const style = statusConfig[data.verification_result.status] || statusConfig.pending;
  const effectiveFilename = selectedFile?.name || data.upload_record.filename;
  const pageMeta = {
    project: {
      path: "实验项目 / 文件固化",
      title: "实验项目提交",
      description: "选择教学文件，演示从上传、摘要计算到回执核验的主流程。",
    },
    assets: {
      path: "资产库 / 资产详情",
      title: "资产库",
      description: "查看课程资产元数据、SHA-256 摘要和版本链路。",
    },
    verify: {
      path: "核验中心 / 回执与 AI 复核",
      title: "核验中心",
      description: "检查 receipt、trace、transaction hash 和 verification result。",
    },
    reports: {
      path: "报告导出 / 复核摘要",
      title: "报告导出",
      description: "生成课程展示所需的核验摘要与人工复核建议。",
    },
  }[currentPage];

  const steps = useMemo(
    () => [
      ["selected", "选择文件"],
      ["hashing", "计算摘要"],
      ["preserving", "生成固化记录"],
      ["pending_receipt", "回执核验"],
      ["ai_ready", "AI 复核"],
      ["summary_ready", "摘要导出"],
    ],
    [],
  );

  const stageOrder = {
    idle: 0,
    selected: 1,
    hashing: 2,
    preserving: 3,
    pending_receipt: 4,
    verified: 5,
    failed: 5,
    unsupported: 5,
    ai_ready: 6,
    summary_ready: 7,
  };

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setWorkflowStage(file ? "selected" : "idle");
    setAiGenerated(false);
    setSummaryReady(false);
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function startPreservation() {
    if (!selectedFile) return;
    setSummaryReady(false);
    setAiGenerated(false);
    setWorkflowStage("hashing");
    const submitted = await submitUpload(selectedFile, scenarioKey);
    let currentData = submitted.scenarioData || null;
    if (currentData) setLiveData(currentData);
    await delay(700);
    setWorkflowStage("preserving");
    const detail = await getAssetDetail(scenarioKey);
    currentData = detail.scenarioData || currentData;
    if (currentData) setLiveData(currentData);
    await delay(700);
    setWorkflowStage("pending_receipt");
    const verification = await getVerificationResult(scenarioKey);
    currentData = verification.scenarioData || currentData;
    if (currentData) setLiveData(currentData);
    await delay(700);
    setWorkflowStage((currentData || data).verification_result.status);
  }

  async function generateAiReview() {
    setWorkflowStage("ai_ready");
    setAiGenerated(false);
    const explanation = await getAiExplanation(scenarioKey);
    if (explanation.scenarioData) setLiveData(explanation.scenarioData);
    await delay(650);
    setAiGenerated(true);
  }

  function exportSummary() {
    setSummaryReady(true);
    setWorkflowStage("summary_ready");
  }

  function isStepDone(stepKey) {
    const current = stageOrder[workflowStage] || 0;
    const target = stageOrder[stepKey] || 0;
    if (stepKey === "pending_receipt") {
      return current >= 4;
    }
    if (stepKey === "ai_ready") {
      return aiGenerated && current >= 6;
    }
    if (stepKey === "summary_ready") {
      return summaryReady;
    }
    return current >= target;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#f8fafc_34%,#eef2f7_100%)] font-sans text-slate-800">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 font-bold text-white shadow-sm">
              C
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">Chronofact</p>
              <p className="text-xs text-slate-500">教学证据链系统</p>
            </div>
          </div>
          <nav className="hidden gap-2 text-sm text-slate-600 md:flex">
            <NavButton active={currentPage === "project"} onClick={() => setCurrentPage("project")}>
              实验项目
            </NavButton>
            <NavButton active={currentPage === "assets"} onClick={() => setCurrentPage("assets")}>
              资产库
            </NavButton>
            <NavButton active={currentPage === "verify"} onClick={() => setCurrentPage("verify")}>
              核验中心
            </NavButton>
            <NavButton active={currentPage === "reports"} onClick={() => setCurrentPage("reports")}>
              报告导出
            </NavButton>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-800/10 bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_48%,#0f766e_100%)] px-6 py-6 text-white shadow-lg shadow-blue-950/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-sm text-blue-100">{pageMeta.path}</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-white">{pageMeta.title}</h1>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-white/40 ${style.color}`}>
                  {data.verification_result.status}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50">{pageMeta.description}</p>
              {isLiveApiEnabled() && (
                <p className="mt-2 text-xs font-medium text-teal-100">
                  Live backend mode: using Chronofact API responses for this workflow.
                </p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <HeroFact label="文件" value={effectiveFilename} />
                <HeroFact label="版本" value={`v${data.asset_version.version_no}`} />
                <HeroFact label="提交人" value={data.identity_context.display_name} />
                <HeroFact label="更新时间" value={data.proof.timestamp} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-blue-100">当前核验记录</label>
              <select
                value={scenarioKey}
                onChange={(event) => {
                  setScenarioKey(event.target.value);
                  setWorkflowStage("idle");
                  setSelectedFile(null);
                  setAiGenerated(true);
                  setSummaryReady(false);
                  setLiveData(null);
                }}
                className="min-w-56 cursor-pointer rounded-lg border border-white/30 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-teal-300"
              >
                {listScenarios().map((scenario) => (
                  <option key={scenario.key} value={scenario.key}>
                    {scenario.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            <div className="border-b border-slate-200 bg-white px-6 py-4">
              <div className="flex gap-6 text-sm">
                <PageTab active={currentPage === "project"} onClick={() => setCurrentPage("project")}>
                  实验项目
                </PageTab>
                <PageTab active={currentPage === "assets"} tone="teal" onClick={() => setCurrentPage("assets")}>
                  资产库
                </PageTab>
                <PageTab active={currentPage === "verify"} tone="amber" onClick={() => setCurrentPage("verify")}>
                  核验中心
                </PageTab>
                <PageTab active={currentPage === "reports"} tone="indigo" onClick={() => setCurrentPage("reports")}>
                  报告导出
                </PageTab>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              <Section hidden={currentPage !== "project"} id="workflow" title="文件固化流程" description="从选择文件到生成核验摘要的完整操作路径。">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                    {steps.map(([key, label], index) => {
                      const done = isStepDone(key);
                      return (
                        <div key={key} className="relative">
                          {index < steps.length - 1 && (
                            <div className="absolute left-8 right-[-14px] top-5 hidden h-0.5 bg-slate-200 md:block" />
                          )}
                          <div
                            className={`relative z-10 rounded-xl border p-3 ${
                              done ? stepClass(index) : "border-slate-200 bg-white text-slate-400"
                            }`}
                          >
                            <span
                              className={`mb-3 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                                done ? "bg-white/80 text-slate-900" : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              {done ? "✓" : String(index + 1)}
                            </span>
                            <strong className="text-sm">{label}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
                    <label className="block">
                      <span className="mb-2 block text-sm text-slate-500">选择实验文件</span>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-700"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={startPreservation}
                      disabled={!selectedFile || ["hashing", "preserving", "pending_receipt"].includes(workflowStage)}
                      className="rounded-lg bg-gradient-to-r from-blue-600 to-teal-500 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300"
                    >
                      开始固化
                    </button>
                    <button
                      type="button"
                      onClick={generateAiReview}
                      disabled={!["verified", "failed", "unsupported", "ai_ready", "summary_ready"].includes(workflowStage)}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300"
                    >
                      生成 AI 复核
                    </button>
                    <button
                      type="button"
                      onClick={exportSummary}
                      disabled={!aiGenerated || !["ai_ready", "summary_ready"].includes(workflowStage)}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300"
                    >
                      生成摘要
                    </button>
                  </div>

                  <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-sm text-slate-700">
                    {workflowStage === "idle" && "请选择实验文件开始固化流程。"}
                    {workflowStage === "selected" && `已选择文件：${selectedFile?.name}，可开始生成固化记录。`}
                    {workflowStage === "hashing" && "正在计算 SHA-256 摘要..."}
                    {workflowStage === "preserving" && "正在创建资产版本与固化记录..."}
                    {workflowStage === "pending_receipt" && "固化记录已提交，正在等待回执与 trace 返回..."}
                    {["verified", "failed", "unsupported"].includes(workflowStage) &&
                      `核验流程已返回：${data.verification_result.status}。`}
                    {workflowStage === "ai_ready" && "AI 复核说明已生成，可继续导出核验摘要。"}
                    {workflowStage === "summary_ready" && "核验摘要已生成，可用于课程实验报告截图。"}
                  </div>
                </div>
              </Section>

              <Section hidden={currentPage !== "assets"} id="asset-info" title="资产基础信息" description="实验资产的提交记录与数字指纹。">
                <RecordGrid>
                  <RecordField label="文件名称">{effectiveFilename}</RecordField>
                  <RecordField label="文件类型">{data.asset_version.asset_type}</RecordField>
                  <RecordField label="提交人">
                    {data.identity_context.display_name} / {data.identity_context.user_id}
                  </RecordField>
                  <RecordField label="资产编号">{data.asset_version.asset_id}</RecordField>
                  <div className="md:col-span-2">
                    <p className="mb-1 text-sm text-slate-500">当前哈希摘要 SHA-256</p>
                    <div className="break-all rounded-lg border border-teal-100 bg-teal-50/70 p-3 font-mono text-xs text-teal-900">
                      {data.asset_version.sha256}
                    </div>
                  </div>
                </RecordGrid>
              </Section>

              <Section hidden={currentPage !== "assets"} id="version-timeline" title="版本与事实轨迹" description="展示当前版本与上一版本之间的可追溯关系。">
                {data.timeline.length === 0 ? (
                  <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-800">
                    上传失败，尚未创建资产版本，因此没有 previous_version_id 或版本时间线。
                  </div>
                ) : (
                <div className="relative ml-3 space-y-6 border-l-2 border-teal-200 pl-6">
                  {data.timeline.map((item) => (
                    <div key={`${item.version}-${item.status}`} className="relative">
                      <div
                        className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white ${
                          item.status === "verified" ? "bg-teal-500" : "bg-slate-300"
                        }`}
                      />
                      <strong className="block text-sm">
                        {item.version} · {item.status}
                      </strong>
                      <span className="mb-1 block text-xs text-slate-400">{item.time}</span>
                      <code className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-500">
                        previous_version_id: {item.previous_version_id}
                      </code>
                    </div>
                  ))}
                </div>
                )}
              </Section>

              <Section hidden={currentPage !== "verify"} id="proof-panel" title="可信证据链固化回执" description="结构化证明字段是页面上的证明来源。">
                <div className={`rounded-xl border p-4 ${style.border} ${statusPanelClass(data.verification_result.status)}`}>
                <RecordGrid>
                  <RecordField label="Receipt ID">{data.proof.receipt_id}</RecordField>
                  <RecordField label="Trace ID">{data.proof.trace_id}</RecordField>
                  <RecordField label="Transaction Hash">{data.proof.transaction_hash}</RecordField>
                  <RecordField label="Timestamp">{data.proof.timestamp}</RecordField>
                  <RecordField label="Digest Match">
                    {formatValue(data.verification_result.digest_match)}
                  </RecordField>
                  <RecordField label="Receipt Status">
                    {data.verification_result.receipt_status}
                  </RecordField>
                  <RecordField label="Trace Status">{data.verification_result.trace_status}</RecordField>
                  <RecordField label="Failure Reason">
                    {data.verification_result.failure_reason || "无"}
                  </RecordField>
                </RecordGrid>
                </div>
              </Section>

              <Section hidden={currentPage !== "verify"} id="ai-review" title="AI 辅助解释与核验建议" description="AI 只解释结构化证据，不替代回执、trace 或核验结果。">
                <div
                  className={`rounded-xl border p-5 shadow-sm ${
                    data.verification_result.failure_reason === "ai_explanation_unavailable"
                      ? "border-amber-200 bg-amber-50"
                      : "border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50"
                  }`}
                >
                  <div className="mb-4 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    AI explanation
                  </div>
                  {!aiGenerated ? (
                    <div className="mb-4 space-y-2">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-indigo-100" />
                      <div className="h-3 w-5/6 animate-pulse rounded bg-indigo-100" />
                    </div>
                  ) : (
                    <div className="mb-4 rounded-lg bg-white/70 p-4">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-500">Summary</p>
                      <p className="text-sm leading-6 text-slate-700">{data.ai_explanation.summary}</p>
                    </div>
                  )}
                  <div
                    className={`mb-4 rounded-r-lg p-4 ${
                      data.verification_result.status === "failed"
                        ? "border-l-4 border-red-500 bg-red-50"
                        : "bg-white/70"
                    }`}
                  >
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-500">
                      Risks
                    </p>
                    <ul className="list-inside list-disc text-sm text-slate-700">
                      {data.ai_explanation.risks.map((risk) => (
                        <li key={risk}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-white/70 p-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-500">
                      Next Checks
                    </p>
                    <ul className="list-inside list-disc text-sm text-slate-700">
                      {data.ai_explanation.next_checks.map((check) => (
                        <li key={check}>{check}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-4 border-t border-indigo-100 pt-4 text-xs italic text-indigo-500">
                    Confidence Note: {data.ai_explanation.confidence_note}
                  </p>
                  {data.verification_result.failure_reason === "ai_explanation_unavailable" && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-white/70 p-3 text-xs font-medium text-amber-800">
                      降级原因：ai_explanation_unavailable。该状态只表示 AI 文案不可用，不表示结构化证明失败。
                    </p>
                  )}
                </div>
              </Section>

              {currentPage === "reports" && (
                <Section id="summary-panel" title="核验摘要" description="面向课程提交与答辩展示的摘要内容。">
                  <div className="mb-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={exportSummary}
                      disabled={!aiGenerated}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      生成核验摘要
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage("verify")}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      查看核验证据
                    </button>
                  </div>
                  {summaryReady ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                    <p>
                      文件 <strong>{effectiveFilename}</strong> 已形成资产记录{" "}
                      <strong>{data.asset_version.asset_id}</strong>，当前版本为{" "}
                      <strong>v{data.asset_version.version_no}</strong>。
                    </p>
                    <p>
                      核验状态为 <strong>{data.verification_result.status}</strong>，摘要匹配结果为{" "}
                      <strong>{formatValue(data.verification_result.digest_match)}</strong>。
                    </p>
                    <p>人工复核建议：{data.ai_explanation.next_checks.join("；")}</p>
                  </div>
                  ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                      核验摘要尚未生成。点击“生成核验摘要”后，系统会按当前 mock 场景汇总资产编号、版本号、核验状态、摘要匹配结果和人工复核建议。
                    </div>
                  )}
                  <div className="mt-4">
                    <RecordGrid>
                      <RecordField label="最终证明来源">
                        sha256 digest / receipt / trace / verification result
                      </RecordField>
                      <RecordField label="AI 边界">
                        AI 只解释结构化证据，不生成证明，也不把失败改写为成功。
                      </RecordField>
                    </RecordGrid>
                  </div>
                </Section>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div id="status-panel" className={`scroll-mt-24 rounded-2xl border p-5 shadow-sm ${style.border} ${statusPanelClass(data.verification_result.status)}`}>
              <p className="mb-1 text-sm text-slate-500">当前核验状态</p>
              <div className={`mb-5 inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${style.color}`}>
                {data.verification_result.status}
              </div>
              <dl className="space-y-3 text-sm">
                <SummaryItem label="receipt_status" value={data.verification_result.receipt_status} />
                <SummaryItem label="trace_status" value={data.verification_result.trace_status} />
                <SummaryItem label="digest_match" value={formatValue(data.verification_result.digest_match)} />
                <SummaryItem label="failure_reason" value={data.verification_result.failure_reason || "无"} />
              </dl>
            </div>

            <div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-slate-900">处理进度</p>
              <ol className="space-y-3 text-sm">
                <ProgressItem done label="上传文件" />
                <ProgressItem done={stageOrder[workflowStage] >= 2} label="生成 digest" />
                <ProgressItem done={stageOrder[workflowStage] >= 4} label="返回 receipt" />
                <ProgressItem done={["verified", "failed", "unsupported", "ai_ready", "summary_ready"].includes(workflowStage)} label="完成核验" />
              </ol>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function NavButton({ active = false, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 transition hover:bg-slate-100 ${
        active ? "bg-blue-50 font-medium text-blue-700" : ""
      }`}
    >
      {children}
    </button>
  );
}

function PageTab({ tone = "blue", active = false, onClick, children }) {
  const colorClass = {
    blue: "text-blue-700",
    teal: "text-teal-700",
    amber: "text-amber-700",
    indigo: "text-indigo-700",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`pb-3 transition hover:opacity-75 ${colorClass} ${
        active ? "border-b-2 border-blue-600 font-medium" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Section({ id, title, description, hidden = false, children }) {
  if (hidden) {
    return null;
  }

  return (
    <section id={id} className="grid scroll-mt-24 gap-6 px-6 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function HeroFact({ label, value }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur">
      <p className="mb-1 text-xs text-blue-100">{label}</p>
      <p className="truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function RecordGrid({ children }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

function RecordField({ label, children }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-1 text-sm text-slate-500">{label}</p>
      <p className="break-all text-sm font-medium text-slate-800">{children}</p>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-mono text-slate-900">{value}</dd>
    </div>
  );
}

function ProgressItem({ done, label }) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-1.5">
      <span
        className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
          done ? "bg-teal-500 text-white" : "bg-slate-200 text-slate-400"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span className={done ? "text-slate-800" : "text-slate-400"}>{label}</span>
    </li>
  );
}

function stepClass(index) {
  const classes = [
    "border-blue-200 bg-blue-50 text-blue-800",
    "border-teal-200 bg-teal-50 text-teal-800",
    "border-amber-200 bg-amber-50 text-amber-800",
    "border-sky-200 bg-sky-50 text-sky-800",
    "border-indigo-200 bg-indigo-50 text-indigo-800",
    "border-emerald-200 bg-emerald-50 text-emerald-800",
  ];
  return classes[index] || classes[0];
}

function statusPanelClass(status) {
  const classes = {
    verified: "bg-green-50/70",
    failed: "bg-red-50/70",
    pending: "bg-amber-50/70",
    unsupported: "bg-slate-50",
  };
  return classes[status] || "bg-slate-50";
}

function formatValue(value) {
  if (value === null || value === undefined) {
    return "unknown";
  }
  return String(value);
}
