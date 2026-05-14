import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getAiExplanation, getScenario, getVerificationResult, listScenarios } from "../services/mockChronofactApi";
import { getStatusMeta } from "../lib/status";

const statusColor = {
  verified: { bg: "bg-white", border: "border-[#dfe8e2]", text: "text-teal-700 bg-teal-100" },
  failed: { bg: "bg-white", border: "border-[#dfe8e2]", text: "text-rose-700 bg-rose-100" },
  pending: { bg: "bg-white", border: "border-[#dfe8e2]", text: "text-amber-700 bg-amber-100" },
  unsupported: { bg: "bg-white", border: "border-[#dfe8e2]", text: "text-slate-600 bg-slate-100" },
};

export default function Verify() {
  const navigate = useNavigate();
  const { scenarioId } = useParams();
  const [params] = useSearchParams();
  const scenarioKey = scenarioId || params.get("scenario") || "normalSubmission";
  const [data, setData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState(null);

  useEffect(() => {
    const scenario = getScenario(scenarioKey);
    setData(scenario);
    setAiData(null);
  }, [scenarioKey]);

  async function loadAi() {
    setAiLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const ai = await getAiExplanation(scenarioKey);
    setAiData(ai);
    setAiLoading(false);
  }

  if (!data) return null;

  const style = statusColor[data.verification_result.status] || statusColor.pending;
  const aiUnavailable = data.verification_result.failure_reason === "ai_explanation_unavailable";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">核验中心</h1>
          <p className="mt-1 text-sm text-slate-500">检查 receipt、trace、transaction hash 和 verification result。</p>
        </div>
        <select
          value={scenarioKey}
          onChange={(e) => navigate(`/verify/${e.target.value}`)}
          className="rounded-lg border border-[#dfe8e2] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-100"
        >
          {listScenarios().map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Warning banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>证明来源声明：</strong>页面上的最终证明来源是 sha256 digest、receipt、trace 和 verification result。AI 解释只负责把结构化证据转化为易理解的说明，不构成真实性证明，也不能替代回执与核验结果。
      </div>

      {/* Asset info */}
      <div className="rounded-xl border border-[#c7ddeb] bg-gradient-to-br from-[#eaf5fc] via-[#f8fcff] to-[#eef7fb] p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-900">资产信息</p>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <InfoItem label="文件名称" value={data.upload_record.filename} />
          <InfoItem label="版本号" value={`v${data.asset_version.version_no}`} />
          <InfoItem label="提交人" value={data.identity_context.display_name} />
          <InfoItem label="时间" value={data.proof.timestamp} />
        </div>
      </div>

      {/* Proof panel */}
      <div className={`rounded-xl border p-5 shadow-sm ${style.border} ${style.bg}`}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">可信证据链固化回执</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusMeta(data.verification_result.status).badge}`}>
            {getStatusMeta(data.verification_result.status).label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Receipt ID" value={data.proof.receipt_id} />
          <Field label="Trace ID" value={data.proof.trace_id} />
          <Field label="Transaction Hash" value={data.proof.transaction_hash} />
          <Field label="Timestamp" value={data.proof.timestamp} />
          <Field label="Digest Match" value={String(data.verification_result.digest_match ?? "unknown")} />
          <Field label="Receipt Status" value={data.verification_result.receipt_status} />
          <Field label="Trace Status" value={data.verification_result.trace_status} />
          <Field label="Failure Reason" value={data.verification_result.failure_reason || "无"} />
        </div>
      </div>

      {/* AI explanation */}
      <div className="rounded-xl border border-[#dfe8e2] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex rounded-full bg-[#dceefa] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#28445f]">
            AI Explanation
          </div>
          {!aiData && !aiUnavailable && (
            <button
              type="button"
              onClick={loadAi}
              disabled={aiLoading}
              className="rounded-lg border border-[#dfe8e2] bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiLoading ? "生成中..." : "生成 AI 解释"}
            </button>
          )}
        </div>

        {aiUnavailable ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong className="block text-amber-950">AI 解释当前不可用。</strong>
              这不是证明失败。结构化 receipt、trace、SHA-256 digest 和 verification result 仍然是最终证明来源。
            </div>
            <div className="rounded-lg border border-[#dfe8e2] bg-white/70 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-500">Manual Review</p>
              <ul className="list-inside list-disc text-sm text-slate-700">
                {data.ai_explanation.next_checks.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          </div>
        ) : !aiData ? (
          <p className="text-sm text-slate-400">点击"生成 AI 解释"查看辅助说明。</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong className="block text-amber-950">AI 解释不是证明来源。</strong>
              最终证明来源是 SHA-256 digest、receipt、trace 和 verification result。AI 只负责解释结构化证据与给出人工复核建议。
            </div>
            <div className="rounded-lg bg-white/70 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-500">Summary</p>
              <p className="text-sm leading-6 text-slate-700">{aiData.summary}</p>
            </div>
            <div className={`rounded-r-lg border-l-4 p-4 ${data.verification_result.status === "failed" ? "border-rose-500 bg-rose-50" : "bg-white/70"}`}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-500">Risks</p>
              <ul className="list-inside list-disc text-sm text-slate-700">
                {aiData.risks.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
            <div className="rounded-lg bg-white/70 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-500">Next Checks</p>
              <ul className="list-inside list-disc text-sm text-slate-700">
                {aiData.next_checks.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
            <p className="border-t border-[#dfe8e2] pt-3 text-xs italic text-emerald-500">
              Confidence Note: {aiData.confidence_note}
            </p>
            <div className="rounded-lg border border-[#dfe8e2] bg-white/70 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-500">
                Evidence Basis
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Fact ID" value={aiData.evidence_basis.fact_id} />
                <Field label="Subject ID" value={aiData.evidence_basis.subject_id} />
                <Field label="Receipt Provider" value={aiData.evidence_basis.receipt_provider} />
                <Field label="Anchor Status" value={aiData.evidence_basis.anchor_status} />
                <Field label="Verification Status" value={aiData.evidence_basis.verification_status} />
                <Field label="Sources" value={aiData.evidence_basis.sources.join(" / ")} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="truncate font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg border border-[#dfe8e2] bg-white p-3">
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p className="break-all text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
