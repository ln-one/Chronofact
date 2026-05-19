import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAssetDetail, listScenarios } from "../services/mockChronofactApi";
import { getStatusMeta } from "../lib/status";

export default function Assets() {
  const navigate = useNavigate();
  const scenarios = listScenarios();
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  async function handleSelect(key) {
    setSelected(key);
    const d = await getAssetDetail(key);
    setDetail(d);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">资产库</h1>
        <p className="mt-1 text-base text-slate-500">查看课程资产元数据、SHA-256 摘要和版本链路。</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* List */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">资产列表</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {scenarios.map((s) => {
              const meta = getStatusMeta(s.status);
              return (
                <li
                  key={s.key}
                  onClick={() => handleSelect(s.key)}
                  className={`cursor-pointer px-4 py-3 hover:bg-slate-50 ${selected === s.key ? "bg-emerald-50" : ""}`}
                >
                  <p className={`text-base font-medium ${selected === s.key ? "text-emerald-800" : "text-slate-800"}`}>{s.label}</p>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${meta.badge}`}>
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Detail */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {!detail ? (
            <p className="text-base text-slate-400">从左侧选择一个资产查看详情。</p>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Field label="文件名称">{detail.upload_record.filename}</Field>
                <Field label="资产编号">{detail.asset_version.asset_id}</Field>
                <Field label="提交人">{detail.identity_context.display_name} / {detail.identity_context.user_id}</Field>
                <Field label="文件类型">{detail.asset_version.asset_type}</Field>
                <Field label="版本号">v{detail.asset_version.version_no}</Field>
                <Field label="上一版本">{detail.asset_version.previous_version_id || "无"}</Field>
                <Field label="提交时间">{detail.asset_version.timestamp}</Field>
                <Field label="存储引用">{detail.upload_record.storage_ref}</Field>
              </div>

              <div>
                <p className="mb-1.5 text-base text-slate-500">SHA-256 摘要</p>
                <div className="break-all rounded-lg border border-teal-100 bg-teal-50 p-3 font-mono text-sm text-teal-900">
                  {detail.asset_version.sha256}
                </div>
              </div>

              {/* Version timeline */}
              <div>
                <p className="mb-3 text-base font-semibold text-slate-900">版本时间线</p>
                {detail.timeline.length === 0 ? (
                  <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-base text-rose-700">
                    上传失败，尚未创建资产版本。
                  </div>
                ) : (
                  <div className="relative ml-3 space-y-5 border-l-2 border-teal-200 pl-6">
                    {detail.timeline.map((item) => (
                      <div key={`${item.version}-${item.time}`} className="relative">
                        <div className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white ${item.status === "verified" ? "bg-teal-500" : "bg-slate-300"}`} />
                        <p className="text-base font-semibold">
                          {item.version} · <span className={getStatusMeta(item.status).soft}>{getStatusMeta(item.status).label}</span>
                        </p>
                        <p className="text-sm text-slate-400">{item.time}</p>
                        <code className="mt-2 block rounded bg-teal-50 px-2 py-1 text-sm text-teal-800">
                          digest: {item.digest}
                        </code>
                        <code className="mt-1 block rounded bg-slate-50 px-2 py-1 text-sm text-slate-500">
                          previous_version_id: {item.previous_version_id}
                        </code>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Receipt / Proof">
                  <ProofField label="Receipt ID" value={detail.proof.receipt_id} />
                  <ProofField label="Trace ID" value={detail.proof.trace_id} />
                  <ProofField label="Transaction Hash" value={detail.proof.transaction_hash} />
                  <ProofField label="Timestamp" value={detail.proof.timestamp} />
                </Panel>

                <Panel title="验证状态">
                  <div className="mb-3">
                    <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${getStatusMeta(detail.verification_result.status).badge}`}>
                      {getStatusMeta(detail.verification_result.status).label}
                    </span>
                  </div>
                  <ProofField label="Digest Match" value={String(detail.verification_result.digest_match ?? "unknown")} />
                  <ProofField label="Receipt Status" value={detail.verification_result.receipt_status} />
                  <ProofField label="Trace Status" value={detail.verification_result.trace_status} />
                  <ProofField label="Failure Reason" value={detail.verification_result.failure_reason || "无"} />
                </Panel>
              </div>

              <Panel title="AI 解释与人工复核">
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                  <strong>AI 解释不是证明来源。</strong>
                  最终证明来源是 SHA-256 digest、receipt、trace 和 verification result。
                </div>
                {detail.verification_result.failure_reason === "ai_explanation_unavailable" ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    AI 解释服务暂时不可用，但结构化回执和核验结果仍可作为证明来源。请人工查看 receipt、trace 和 digest match。
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-sm font-semibold text-slate-900">Summary</p>
                      <p className="text-sm leading-6 text-slate-600">{detail.ai_explanation.summary}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-sm font-semibold text-slate-900">Risks</p>
                      <ul className="list-inside list-disc text-sm leading-6 text-slate-600">
                        {detail.ai_explanation.risks.map((risk) => <li key={risk}>{risk}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-sm font-semibold text-slate-900">人工复核建议</p>
                      <ul className="list-inside list-disc text-sm leading-6 text-slate-600">
                        {detail.ai_explanation.next_checks.map((check) => <li key={check}>{check}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </Panel>

              <button
                type="button"
                onClick={() => navigate(`/verify/${selected}`)}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-base font-medium text-emerald-700 hover:bg-emerald-100"
              >
                前往核验中心 →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-base font-semibold text-slate-900">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-1 text-sm text-slate-500">{label}</p>
      <p className="break-all text-base font-medium text-slate-800">{children}</p>
    </div>
  );
}

function ProofField({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-all font-mono text-sm text-slate-800">{value}</p>
    </div>
  );
}
