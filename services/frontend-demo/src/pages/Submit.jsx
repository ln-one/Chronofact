import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAssetDetail, getVerificationResult, listScenarios, submitUpload } from "../services/mockChronofactApi";
import { getStatusMeta } from "../lib/status";

const steps = ["选择文件", "计算摘要", "生成固化记录", "回执核验"];

export default function Submit() {
  const navigate = useNavigate();
  const scenarios = listScenarios();
  const [scenarioKey, setScenarioKey] = useState("normalSubmission");
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState("idle"); // idle | hashing | preserving | pending_receipt | done
  const [result, setResult] = useState(null);

  const stageIndex = { idle: -1, hashing: 0, preserving: 1, pending_receipt: 2, done: 3 };
  const uploadStatus =
    stage === "idle"
      ? file
        ? "已选择，待上传"
        : "未选择文件"
      : stage === "done"
        ? "上传完成"
        : "上传处理中";

  function delay(ms) {
    return new Promise((r) => window.setTimeout(r, ms));
  }

  async function handleSubmit() {
    if (!file) return;
    setResult(null);
    setStage("hashing");
    const upload = await submitUpload(file, scenarioKey);
    await delay(700);
    setStage("preserving");
    await getAssetDetail(scenarioKey);
    await delay(700);
    setStage("pending_receipt");
    const verification = await getVerificationResult(scenarioKey);
    await delay(700);
    setStage("done");
    setResult({ ...upload, ...verification });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">文件提交</h1>
        <p className="mt-1 text-sm text-slate-500">上传实验文件，系统自动计算摘要并生成固化记录。</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        {/* Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-base font-medium text-slate-700">演示场景</label>
              <select
                value={scenarioKey}
                onChange={(e) => { setScenarioKey(e.target.value); setStage("idle"); setFile(null); setResult(null); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-emerald-200"
              >
                {scenarios.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-base font-medium text-slate-700">选择文件</label>
              <input
                type="file"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setStage("idle"); setResult(null); }}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-emerald-700"
              />
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <FileMeta label="文件名" value={file?.name || "未选择"} />
                <FileMeta label="文件大小" value={file ? formatBytes(file.size) : "未选择"} />
                <FileMeta label="上传状态" value={uploadStatus} />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!file || ["hashing", "preserving", "pending_receipt"].includes(stage)}
              className="rounded-lg bg-gradient-to-r from-[#f8e8a8] via-[#f4d976] to-[#d9c75d] px-5 py-2.5 text-base font-semibold text-emerald-950 shadow-sm shadow-amber-900/10 transition hover:-translate-y-0.5 hover:from-[#fbefbd] hover:via-[#f6df88] hover:to-[#dfcf6e] hover:shadow-md hover:shadow-amber-900/12 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-300 disabled:via-slate-300 disabled:to-slate-300 disabled:text-white"
            >
              开始固化
            </button>
          </div>

          {/* Steps */}
          <div className="mt-6 flex gap-2">
            {steps.map((label, i) => {
              const current = stageIndex[stage];
              const done = current >= i;
              const active = current === i - 1 && stage !== "idle";
              return (
                <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold transition-colors ${
                    done ? "bg-teal-600 text-white" : active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                  }`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`text-center text-sm ${done ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Result */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-base font-semibold text-slate-900">固化结果</p>
          {!result ? (
            <p className="text-base text-slate-400">{stage === "idle" ? "等待提交..." : "处理中..."}</p>
          ) : (
            <div className="space-y-3 text-base">
              <StatusBadge status={result.verification_result.status} />
              <Field label="Upload Status" value={result.upload_record.status} />
              <Field label="Filename" value={result.upload_record.filename} />
              <Field label="File Size" value={formatBytes(result.upload_record.size)} />
              <DigestField label="SHA-256 Digest" value={result.upload_record.sha256} />
              <Field label="Receipt Status" value={result.verification_result.receipt_status} />
              <Field label="Trace Status" value={result.verification_result.trace_status} />
              <Field label="Digest Match" value={String(result.verification_result.digest_match ?? "unknown")} />
              {result.verification_result.failure_reason && (
                <Field label="Failure Reason" value={result.verification_result.failure_reason} />
              )}
              <button
                type="button"
                onClick={() => navigate(`/verify/${scenarioKey}`)}
                className="mt-2 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                查看完整核验详情 →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileMeta({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  return <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${meta.badge}`}>{meta.label}</span>;
}

function Field({ label, value }) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-800">{value}</span>
    </div>
  );
}

function DigestField({ label, value }) {
  return (
    <div className="border-b border-slate-100 pb-2">
      <span className="text-slate-500">{label}</span>
      <p className="mt-1 break-all font-mono text-sm text-slate-800">{value}</p>
    </div>
  );
}

function formatBytes(size) {
  if (size === null || size === undefined) return "未知";
  if (size === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
