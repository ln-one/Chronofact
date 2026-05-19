import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createReview, getAsset, getVersionEvidence, listAssets, listWorkspaces, submitAssetVersion } from "../services/chronofactApi";
import { fileToBase64, formatBytes, sha256File } from "../services/fileDigest";
import { getStatusMeta } from "../lib/status";
import { displayAssetType, displayDateTime, displayStatus, displayValue, displayWorkspaceName } from "../lib/display";

export default function Assets() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(params.get("workspace_id") || localStorage.getItem("lastWorkspaceId") || "");
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState(params.get("asset_id") || "");
  const [detail, setDetail] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [newVersionFile, setNewVersionFile] = useState(null);
  const [newVersionHash, setNewVersionHash] = useState("");
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    decision: "approved",
    summary: "",
    notes: "",
    next_checks: "",
  });
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    listWorkspaces()
      .then((payload) => setWorkspaces(payload.workspaces || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelected("");
    setDetail(null);
    setEvidence(null);
    listAssets(workspaceId ? { workspace_id: workspaceId } : {})
      .then((payload) => {
        const nextAssets = payload.assets || [];
        setAssets(nextAssets);
        const firstId = nextAssets[0]?.asset_id || "";
        if (firstId) {
          selectAsset(firstId);
        } else {
          setLoading(false);
        }
      })
      .catch((caught) => {
        setError(caught.message);
        setLoading(false);
      });
  }, [workspaceId]);

  async function selectAsset(assetId) {
    setSelected(assetId);
    setParams({ asset_id: assetId });
    setLoading(true);
    setError("");
    setMessage("");
    setNewVersionFile(null);
    setNewVersionHash("");
    try {
      const assetDetail = await getAsset(assetId);
      setDetail(assetDetail);
      const latestVersion = assetDetail.versions.at(-1);
      if (latestVersion) {
        const evidencePayload = await getVersionEvidence(latestVersion.version_id);
        setEvidence(evidencePayload.evidence);
      } else {
        setEvidence(null);
      }
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  async function chooseNewVersionFile(event) {
    const file = event.target.files?.[0] || null;
    setNewVersionFile(file);
    setNewVersionHash(file ? await sha256File(file) : "");
    setMessage("");
  }

  async function uploadNewVersion() {
    if (!detail || !newVersionFile) return;
    setUploadingVersion(true);
    setError("");
    setMessage("");
    try {
      const contentBase64 = await fileToBase64(newVersionFile);
      const payload = await submitAssetVersion(detail.asset_id, {
        workspace_id: detail.workspace_id || undefined,
        filename: newVersionFile.name,
        asset_type: detail.asset_type,
        content_base64: contentBase64,
      });
      setNewVersionFile(null);
      setNewVersionHash("");
      await selectAsset(detail.asset_id);
      setMessage(`已上传新版本：v${payload.asset_version.version_no}（${payload.asset_version.version_id}）`);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setUploadingVersion(false);
    }
  }

  function updateReviewField(event) {
    const { name, value } = event.target;
    setReviewForm((current) => ({ ...current, [name]: value }));
  }

  async function submitReview() {
    const versionId = detail?.versions.at(-1)?.version_id;
    if (!versionId) return;
    setReviewing(true);
    setError("");
    setMessage("");
    try {
      const payload = await createReview(versionId, {
        decision: reviewForm.decision,
        summary: reviewForm.summary,
        notes: reviewForm.notes,
        next_checks: reviewForm.next_checks
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setReviewForm({ decision: "approved", summary: "", notes: "", next_checks: "" });
      await selectAsset(detail.asset_id);
      setMessage(`已记录人工审核：${displayReviewDecision(payload.review_record.decision)}`);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">文件库</h1>
          <p className="mt-1 text-sm text-slate-500">查看已提交文件、版本记录、存证结果和审计轨迹。</p>
        </div>
        <div className="pr-3 pt-3">
          <button
            type="button"
            onClick={() => navigate("/submit")}
            className="rounded-lg border border-[#ead89b] bg-gradient-to-r from-[#f7e6a9] via-[#f1d88d] to-[#e8c66f] px-6 py-3 text-base font-semibold text-[#5a3908] shadow-sm shadow-amber-900/10 transition hover:from-[#faedbd] hover:via-[#f4df9c] hover:to-[#edcf7d]"
          >
            提交新文件
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl border border-[#dfe8e2] bg-white shadow-sm">
          <div className="border-b border-[#dfe8e2] px-4 py-3">
            <p className="text-base font-semibold text-slate-900">文件列表</p>
            <select
              value={workspaceId}
              onChange={(e) => { setWorkspaceId(e.target.value); setParams(e.target.value ? { workspace_id: e.target.value } : {}); }}
              className="mt-2 h-9 w-full rounded-lg border border-[#dfe8e2] bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">全部项目空间</option>
              {workspaces.map((ws, index) => (
                <option key={ws.workspace_id} value={ws.workspace_id}>{displayWorkspaceName(ws)}</option>
              ))}
            </select>
          </div>
          <div className="divide-y divide-[#e7eee9]">
            {assets.map((asset) => {
              const status = asset.latest_version?.preservation_record?.verification_status || "pending";
              const meta = getAssetLibraryStatusMeta(status);
              return (
                <button
                  key={asset.asset_id}
                  type="button"
                  onClick={() => selectAsset(asset.asset_id)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-[#f0f6ff] ${selected === asset.asset_id ? "bg-[#f3f8fe] shadow-[inset_3px_0_0_#93c5fd]" : ""}`}
                >
                  <p className="text-base font-semibold text-slate-900">{asset.title || asset.asset_id}</p>
                  <p className="mt-1 text-sm text-slate-500">{asset.asset_id} · {displayAssetType(asset.asset_type)}</p>
                  <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold ${meta.badge}`}>
                    {meta.label}
                  </span>
                </button>
              );
            })}
            {!loading && assets.length === 0 && <div className="p-4 text-sm text-slate-400">暂无文件。</div>}
          </div>
        </aside>

        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-sm">
          {loading && !detail ? (
            <p className="text-sm text-slate-400">正在读取文件记录...</p>
          ) : !detail ? (
            <p className="text-sm text-slate-400">请选择一个文件。</p>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <Info label="文件编号" value={detail.asset_id} />
                <Info label="所属项目空间" value={detail.workspace_id} />
                <Info label="文件类型" value={displayAssetType(detail.asset_type)} />
                <Info label="文件状态" value={displayStatus(detail.status)} />
                <Info label="提交人" value={detail.created_by} />
                <Info label="提交时间" value={displayDateTime(detail.created_at)} />
              </div>

              <div>
                <p className="mb-3 text-lg font-semibold text-slate-900">版本时间线</p>
                <div className="relative ml-3 space-y-5 border-l-2 border-emerald-100 pl-6">
                  {detail.versions.map((version) => (
                    <div key={version.version_id} className="relative">
                      <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-slate-900">v{version.version_no} · {version.version_id}</p>
                        {version.preservation_record && (
                        <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${getAssetLibraryStatusMeta(version.preservation_record.verification_status).badge}`}>
                            {getAssetLibraryStatusMeta(version.preservation_record.verification_status).label}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-base text-slate-500">
                        {version.previous_version_id ? `上一版本：${version.previous_version_id}` : "该文件的第一个版本，无上一版本"}
                      </p>
                      <p className="mt-2 break-all rounded-lg bg-teal-50 px-3 py-2 font-mono text-sm text-teal-950">{version.sha256}</p>
                    </div>
                  ))}
                </div>
              </div>

              <section className="rounded-xl border border-[#eadfe2] bg-[#fffbfc] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">上传新版本</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      选择同一文件的新版本，系统会生成新的版本记录，并自动关联当前最新版本。
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    当前最新 v{detail.versions.at(-1)?.version_no}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_auto]">
                  <input
                    type="file"
                    onChange={chooseNewVersionFile}
                    className="block w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-3 text-base file:mr-3 file:rounded-md file:border-0 file:bg-[#f3f7fb] file:px-4 file:py-2 file:text-base file:text-[#334965]"
                  />
                  <button
                    type="button"
                    onClick={uploadNewVersion}
                    disabled={!newVersionFile || uploadingVersion}
                    className="rounded-lg border border-[#cbd8e6] bg-[#f3f7fb] px-5 py-2.5 text-base font-semibold text-[#334965] transition hover:bg-[#e8f0f8] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {uploadingVersion ? "正在上传..." : "上传为新版本"}
                  </button>
                </div>
                {newVersionFile && (
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <Info label="新版文件名" value={newVersionFile.name} />
                    <Info label="新版文件大小" value={formatBytes(newVersionFile.size)} />
                    <Info label="新版数字指纹" value={newVersionHash} />
                  </div>
                )}
              </section>

              {evidence && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <Panel title="存证记录">
                    <Proof label="存证编号" value={evidence.preservation_record.preservation_id} />
                    <Proof label="文件保存位置" value={evidence.preservation_record.storage_ref} />
                    <Proof label="链上事实编号" value={evidence.preservation_record.fact_id} />
                    <Proof label="回执编号" value={evidence.preservation_record.receipt_id} />
                    <Proof label="上链状态" value={displayStatus(evidence.preservation_record.anchor_status)} />
                    <Proof label="存证状态" value={displayAssetLibraryStatus(evidence.preservation_record.verification_status)} />
                  </Panel>
                  <Panel title="链上证明与审计">
                    <Proof label="链上事实编号" value={evidence.witness_record?.fact_id} />
                    <Proof label="链上交易凭证" value={evidence.witness_record?.tx_hash} />
                    <Proof label="上一条链上记录" value={evidence.witness_record?.previous_fact_id} />
                    <Proof label="审计事件数" value={String(evidence.audit_log.length)} />
                  </Panel>
                </div>
              )}

              {evidence && (
                <section className="rounded-xl border border-[#dfe8e2] bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">人工审核</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        对当前最新版本记录审核结论。审核不会改变存证数据，只会生成独立的人工复核记录。
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-[#fbfdfb] px-3 py-1 text-xs font-semibold text-slate-600">
                      {evidence.review_records?.length || 0} 条记录
                    </span>
                  </div>

                  {evidence.review_records?.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {evidence.review_records.map((review) => (
                        <div key={review.review_id} className="rounded-lg border border-[#e5edf3] bg-[#fbfdff] px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${reviewDecisionClass(review.decision)}`}>
                              {displayReviewDecision(review.decision)}
                            </span>
                            <span className="text-sm text-slate-500">{displayDateTime(review.created_at)}</span>
                          </div>
                          <p className="mt-2 text-base font-semibold text-slate-900">{review.summary || "未填写审核摘要"}</p>
                          {review.notes && <p className="mt-1 text-sm leading-6 text-slate-500">{review.notes}</p>}
                          {review.next_checks?.length > 0 && (
                            <ul className="mt-2 list-inside list-disc text-sm leading-6 text-slate-500">
                              {review.next_checks.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 grid gap-4 xl:grid-cols-[220px_1fr]">
                    <label className="block">
                      <span className="text-base font-semibold text-slate-700">审核结论</span>
                      <select
                        name="decision"
                        value={reviewForm.decision}
                        onChange={updateReviewField}
                        className="mt-1.5 h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="approved">通过</option>
                        <option value="needs_revision">需修改</option>
                        <option value="rejected">驳回</option>
                        <option value="pending">待定</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-base font-semibold text-slate-700">审核摘要</span>
                      <input
                        name="summary"
                        value={reviewForm.summary}
                        onChange={updateReviewField}
                        placeholder="例如：材料完整，存证记录可用于课程归档"
                        className="mt-1.5 h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                  </div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <label className="block">
                      <span className="text-base font-semibold text-slate-700">审核备注</span>
                      <textarea
                        name="notes"
                        value={reviewForm.notes}
                        onChange={updateReviewField}
                        placeholder="补充说明审核依据或需要关注的问题"
                        className="mt-1.5 min-h-24 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-base font-semibold text-slate-700">后续检查建议</span>
                      <textarea
                        name="next_checks"
                        value={reviewForm.next_checks}
                        onChange={updateReviewField}
                        placeholder="每行一条，或用逗号分隔"
                        className="mt-1.5 min-h-24 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={submitReview}
                    disabled={reviewing || !reviewForm.summary.trim()}
                    className="mt-4 rounded-lg border border-[#cbd8e6] bg-[#f3f7fb] px-5 py-2.5 text-base font-semibold text-[#334965] transition hover:bg-[#e8f0f8] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {reviewing ? "正在记录..." : "提交人工审核"}
                  </button>
                </section>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/verify?version_id=${detail.versions.at(-1)?.version_id}`)}
                  className="rounded-lg border border-[#9ed7c2] bg-[#e8f6ef] px-5 py-2.5 text-base font-semibold text-[#087157] transition hover:bg-[#d9efe5]"
                >
                  核验最新版本
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/reports?version_id=${detail.versions.at(-1)?.version_id}`)}
                  className="rounded-lg border border-[#cbd8e6] bg-[#f3f7fb] px-5 py-2.5 text-base font-semibold text-[#334965] transition hover:bg-[#e8f0f8]"
                >
                  查看报告
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-[#dfe8e2] bg-[#fbfdfb] p-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 break-all text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-xl border border-[#dfe8e2] bg-[#fbfdfb] p-4">
      <p className="mb-3 text-lg font-semibold text-slate-900">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Proof({ label, value }) {
  return (
    <div className="rounded-lg border border-[#dfe8e2] bg-white px-3 py-2">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 break-all text-base text-slate-800">{displayValue(value)}</p>
    </div>
  );
}

function getAssetLibraryStatusMeta(status) {
  const meta = getStatusMeta(status);
  if (status === "verified") {
    return { ...meta, label: "已存证" };
  }
  return meta;
}

function displayAssetLibraryStatus(status) {
  return status === "verified" ? "已存证" : displayStatus(status);
}

function displayReviewDecision(decision) {
  return {
    approved: "通过",
    needs_revision: "需修改",
    rejected: "驳回",
    pending: "待定",
  }[decision] || displayValue(decision);
}

function reviewDecisionClass(decision) {
  return {
    approved: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
    needs_revision: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    rejected: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    pending: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  }[decision] || "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}
