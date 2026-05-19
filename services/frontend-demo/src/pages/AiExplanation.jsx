import { useEffect, useState } from "react";
import { explainFact, explainRisk, explainTrace, listAssets } from "../services/chronofactApi";
import { getStatusMeta } from "../lib/status";

const modes = [
  { key: "risk", label: "风险解释", description: "面向审核员，判断是否需要人工复核。" },
  { key: "fact", label: "单版本解释", description: "解释一个已登记版本的证明状态。" },
  { key: "trace", label: "版本链解释", description: "解释文件版本时间线和上一版本关系。" },
];

export default function AiExplanation() {
  const [assets, setAssets] = useState([]);
  const [assetId, setAssetId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [mode, setMode] = useState("risk");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listAssets()
      .then((payload) => {
        const nextAssets = payload.assets || [];
        setAssets(nextAssets);
        const first = nextAssets[0];
        if (first) {
          setAssetId(first.asset_id);
          setVersionId(first.latest_version?.version_id || "");
        }
      })
      .catch((caught) => setError(caught.message));
  }, []);

  function changeAsset(nextAssetId) {
    const asset = assets.find((item) => item.asset_id === nextAssetId);
    setAssetId(nextAssetId);
    setVersionId(asset?.latest_version?.version_id || "");
    setResult(null);
  }

  async function generate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const payload =
        mode === "trace"
          ? await explainTrace({ asset_id: assetId })
          : mode === "fact"
            ? await explainFact({ version_id: versionId })
            : await explainRisk({ version_id: versionId });
      setResult(payload);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  const verification = result?.verification_result;
  const ai = result?.ai_explanation;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI 解释</h1>
        <p className="mt-1 text-base leading-7 text-slate-500">
          基于系统存证记录生成辅助说明，帮助理解文件数字指纹、存证回执、版本链和核验结果。
        </p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <section className="rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="text-base font-semibold text-slate-700">选择文件</span>
            <select
              value={assetId}
              onChange={(event) => changeAsset(event.target.value)}
              className="mt-1.5 h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {assets.map((asset) => (
                <option key={asset.asset_id} value={asset.asset_id}>
                  {asset.title || asset.asset_id} ({asset.asset_id})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-base font-semibold text-slate-700">解释类型</span>
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value);
                setResult(null);
              }}
              className="mt-1.5 h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {modes.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={generate}
            disabled={loading || !assetId || (mode !== "trace" && !versionId)}
            className="self-end rounded-lg bg-emerald-700 px-6 py-3.5 text-base font-semibold text-white hover:bg-emerald-600 disabled:cursor-wait disabled:bg-slate-300"
          >
            {loading ? "生成中..." : "生成解释"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {modes.map((item) => (
            <div key={item.key} className={`rounded-xl border p-3 ${
              mode === item.key ? "border-emerald-200 bg-emerald-50" : "border-[#dfe8e2] bg-[#fbfdfb]"
            }`}>
              <p className="text-base font-semibold text-slate-900">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm">
          <p className="mb-4 text-lg font-semibold text-slate-900">解释输入</p>
          <Info label="文件编号" value={assetId || "暂无"} />
          <Info label="版本编号" value={versionId || "版本链模式"} />
          <Info label="解释功能" value={endpointForMode(mode)} />
          {verification && (
            <div className="mt-3">
              <p className="mb-1 text-sm text-slate-500">核验状态</p>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${getStatusMeta(verification.status).badge}`}>
                {getStatusMeta(verification.status).label}
              </span>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#f3dde2] bg-[#fffbfc] p-5 shadow-sm">
          <p className="mb-4 text-lg font-semibold text-slate-900">AI 输出</p>
          {!result ? (
            <div className="rounded-xl border border-dashed border-[#eadfe2] bg-white p-8 text-base text-slate-400">
              选择文件和解释类型后生成 AI 解释。
            </div>
          ) : result.ai_explanation_error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-base text-amber-900">
              AI 解释服务不可用：{result.ai_explanation_error.message}
            </div>
          ) : (
            <div className="space-y-4">
              <Panel title="解释概览">
                <p className="text-base leading-8 text-slate-700">{translateAiText(ai?.summary) || "暂无概览。"}</p>
              </Panel>
              <Panel title="风险提示">
                <List items={ai?.risks || []} empty="暂无明显风险。" />
              </Panel>
              <Panel title="后续检查建议">
                <List items={ai?.next_checks || []} empty="暂无下一步建议。" />
              </Panel>
              <Panel title="依据来源">
                <List items={ai?.evidence_basis || []} empty="未返回证据来源。" />
              </Panel>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-base leading-8 text-amber-900">
                {translateAiText(ai?.confidence_note) || "AI 解释只用于辅助理解，不构成存证证明。"}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function endpointForMode(mode) {
  return {
    risk: "风险解释",
    fact: "单版本解释",
    trace: "版本链解释",
  }[mode];
}

function Info({ label, value }) {
  return (
    <div className="mb-3 rounded-lg border border-[#dfe8e2] bg-[#fbfdfb] px-3 py-2">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 break-all text-base text-slate-800">{value}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-xl border border-[#eadfe2] bg-white p-4">
      <p className="mb-2 text-base font-semibold text-slate-900">{title}</p>
      {children}
    </section>
  );
}

function List({ items, empty }) {
  if (items.length === 0) {
    return <p className="text-base text-slate-500">{empty}</p>;
  }
  return (
    <ul className="list-inside list-disc text-base leading-8 text-slate-700">
      {items.map((item) => <li key={item}>{translateAiText(item)}</li>)}
    </ul>
  );
}

function translateAiText(value = "") {
  const direct = {
    "sha256 digest": "文件数字指纹（SHA-256）",
    "asset version record": "文件版本记录",
    "receipt status": "存证回执状态",
    "trace status": "版本链追踪状态",
    "verification result": "核验结果",
    "version history": "版本历史",
    "AI explanation is not proof; proof comes from structured receipts and verification results.":
      "AI 解释只用于辅助理解，不构成存证证明；证明依据来自结构化回执和核验结果。",
    "A human reviewer should still check whether the file content satisfies submission requirements.":
      "建议审核人员继续检查文件内容是否满足课程提交要求。",
    "The submitted file may have been modified after registration.":
      "该文件可能在存证后被修改，或上传的不是原始登记文件。",
    "Ask a reviewer to compare the file with the originally submitted artifact.":
      "请审核人员对比当前文件与最初提交的文件，并检查文件数字指纹和存证回执。",
    "The record cannot be treated as fully witnessed until proof is available.":
      "在回执或追踪信息返回前，该记录不能视为完整完成存证。",
    "Retry verification after the witness service returns a receipt or trace.":
      "等待存证服务返回回执或版本链信息后，再重新发起核验。",
    "The current result is an access failure, not a successful notarization.":
      "当前结果表示链端访问失败，不能当作存证成功。",
    "Check the chain or Chronestia adapter and retry verification.":
      "请检查链端服务或 Chronestia 适配器状态，然后重新核验。",
  };

  if (direct[value]) {
    return direct[value];
  }

  const registeredMatch = value.match(/^Version (\d+) is registered and the current digest matches the recorded value\.(.*)$/);
  if (registeredMatch) {
    return `第 ${registeredMatch[1]} 版文件已登记，当前文件数字指纹与系统记录一致。${translateVersionContext(registeredMatch[2])}`;
  }

  const mismatchMatch = value.match(/^Version (\d+) digest does not match the recorded value\.(.*)$/);
  if (mismatchMatch) {
    return `第 ${mismatchMatch[1]} 版文件的当前数字指纹与登记记录不一致，不能直接视为已存证文件。${translateVersionContext(mismatchMatch[2])}`;
  }

  const missingMatch = value.match(/^Version (\d+) has no available proof yet\.(.*)$/);
  if (missingMatch) {
    return `第 ${missingMatch[1]} 版文件已有记录，但目前还没有可用的存证证明。${translateVersionContext(missingMatch[2])}`;
  }

  const unavailableMatch = value.match(/^Version (\d+) cannot be verified because the chain adapter is unavailable\.(.*)$/);
  if (unavailableMatch) {
    return `第 ${unavailableMatch[1]} 版文件暂时无法核验，因为链端或 Chronestia 适配服务不可用。${translateVersionContext(unavailableMatch[2])}`;
  }

  return value;
}

function translateVersionContext(value = "") {
  const match = value.match(/The asset has (\d+) linked versions in its trace\./);
  return match ? ` 当前文件的版本链中共有 ${match[1]} 个关联版本。` : value;
}
