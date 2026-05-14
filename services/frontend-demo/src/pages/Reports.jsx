import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAiExplanation, getScenario, listScenarios } from "../services/mockChronofactApi";
import { getStatusMeta } from "../lib/status";

const exportHistory = [
  { name: "实验报告 v1", type: "核验摘要 PDF", time: "2026-05-08 10:36", status: "成功" },
  { name: "多版本追踪", type: "证据链报告", time: "2026-05-08 14:25", status: "成功" },
  { name: "待回执提交", type: "核验摘要", time: "2026-05-08 15:12", status: "处理中" },
];

const reportSections = ["核验摘要", "文件基本信息", "哈希摘要", "时间戳", "回执结果", "AI 辅助建议"];

export default function Reports() {
  const navigate = useNavigate();
  const scenarios = listScenarios();
  const [scenarioKey, setScenarioKey] = useState("normalSubmission");
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const selectedScenario = getScenario(scenarioKey);
  const selectedAi = selectedScenario.ai_explanation;
  const scenario = reportData?.scenario || selectedScenario;
  const ai = reportData?.ai || selectedAi;
  const status = getStatusMeta(scenario.verification_result.status);
  const digestMatched = scenario.verification_result.digest_match;

  async function generate() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const nextScenario = getScenario(scenarioKey);
    const nextAi = await getAiExplanation(scenarioKey);
    setReportData({ scenario: nextScenario, ai: nextAi });
    setGenerated(true);
    setLoading(false);
  }

  function changeScenario(value) {
    setScenarioKey(value);
    setGenerated(false);
    setReportData(null);
  }

  return (
    <div className="space-y-6 text-[15px]">
      <div>
        <h1 className="text-3xl font-bold text-slate-950">报告导出</h1>
        <p className="mt-2 text-base text-slate-500">生成课程展示所需的核验摘要、证据来源与人工复核建议。</p>
      </div>

      <div className="rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[280px] flex-1">
            <label className="mb-2 block text-base font-semibold text-slate-700">选择记录</label>
            <select
              value={scenarioKey}
              onChange={(e) => changeScenario(e.target.value)}
              className="w-full rounded-xl border border-[#d7e2dc] bg-white px-4 py-3 text-base outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            >
              {scenarios.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-wait disabled:bg-slate-300"
          >
            {loading ? "生成中..." : "生成核验摘要"}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/verify/${scenarioKey}`)}
            className="rounded-xl border border-[#d7e2dc] bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
          >
            查看核验证据
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.25fr]">
        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xl font-bold text-slate-950">记录信息摘要</p>
              <p className="mt-1 text-sm text-slate-500">选中记录后自动显示基础信息。</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${status.badge}`}>{status.label}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="文件名称" value={scenario.upload_record.filename} />
            <Info label="文件类型" value={assetTypeLabel(scenario.asset_version.asset_type)} />
            <Info label="提交时间" value={scenario.asset_version.timestamp} />
            <Info label="当前版本" value={`v${scenario.asset_version.version_no}`} />
            <Info label="摘要算法" value="SHA-256" />
            <Info label="存证状态" value={scenario.verification_result.receipt_status === "available" ? "已生成回执" : "等待回执"} />
            <Info label="核验结果" value={digestMatched === true ? "摘要一致" : digestMatched === false ? "摘要不一致" : "等待核验"} />
            <Info label="上一版本" value={scenario.asset_version.previous_version_id || "无"} />
          </div>
        </section>

        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xl font-bold text-slate-950">报告预览</p>
              <p className="mt-1 text-sm text-slate-500">展示即将导出的报告核心内容。</p>
            </div>
            <button
              type="button"
              disabled={!generated}
              className="rounded-xl border border-[#d7e2dc] bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              导出 PDF
            </button>
          </div>
          <div className="rounded-2xl border border-[#dfe8e2] bg-[#f8fcfa] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-slate-950">{selectedScenario.label} 核验摘要</p>
                <p className="mt-1 text-sm text-slate-500">{generated ? "已生成报告预览" : "点击生成后可导出正式摘要"}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${status.badge}`}>{status.label}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Preview label="摘要哈希" value={`SHA-256: ${shortDigest(scenario.asset_version.sha256)}`} />
              <Preview label="版本信息" value={`v${scenario.asset_version.version_no} / ${scenario.asset_version.timestamp}`} />
              <Preview label="回执状态" value={scenario.verification_result.receipt_status === "available" ? "已生成" : "未完成"} />
              <Preview label="链路状态" value={scenario.verification_result.trace_status === "available" ? "可追溯" : "待确认"} />
            </div>
            <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
              <strong>AI 复核建议：</strong>{ai.next_checks.join("；")}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.25fr]">
        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-sm">
          <p className="text-xl font-bold text-slate-950">导出内容</p>
          <p className="mt-1 text-sm text-slate-500">报告将包含以下核验材料。</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {reportSections.map((item) => (
              <div key={item} className="rounded-xl border border-[#dfe8e2] bg-[#fbfdfb] px-4 py-3 text-base font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-sm">
          <p className="text-xl font-bold text-slate-950">最近导出记录</p>
          <div className="mt-5 overflow-hidden rounded-xl border border-[#dfe8e2]">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_0.6fr] bg-[#f8fcfa] px-4 py-3 text-sm font-semibold text-slate-500">
              <span>记录名称</span>
              <span>导出类型</span>
              <span>导出时间</span>
              <span>状态</span>
            </div>
            {exportHistory.map((item) => (
              <div key={`${item.name}-${item.time}`} className="grid grid-cols-[1.1fr_1fr_1fr_0.6fr] border-t border-[#e5ede8] px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{item.name}</span>
                <span>{item.type}</span>
                <span>{item.time}</span>
                <span className={item.status === "成功" ? "text-emerald-700" : "text-amber-700"}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {generated && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <strong>AI 边界声明：</strong>AI 只解释结构化证据，不生成证明，不把失败改写为成功。最终证明来源是摘要、回执、链路追踪和核验结果。
        </section>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-[#dfe8e2] bg-[#fbfdfb] p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 break-all text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Preview({ label, value }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 break-all text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function shortDigest(value) {
  if (!value || value.length <= 16) return value || "未生成";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function assetTypeLabel(type) {
  const labels = {
    lab_report: "实验报告",
    assignment: "课程作业",
  };
  return labels[type] || "教学文件";
}
