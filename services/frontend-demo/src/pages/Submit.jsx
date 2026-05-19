import submitIllustration from "../assets/submit-illustration.png";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  defaultOrganizationId,
  findOrganizationEvidenceByDigest,
  listWorkspaces,
  preserveOrganizationEvidence,
} from "../services/chronofactApi";
import { fileToBase64, formatBytes, sha256File } from "../services/fileDigest";
import { getStatusMeta } from "../lib/status";
import { displayAssetType, displayStatus, displayValue, displayWorkspaceName } from "../lib/display";

const assetTypes = [
  { value: "lab_report", label: "实验报告" },
  { value: "assignment", label: "课程作业" },
  { value: "exam", label: "考试材料" },
  { value: "result_screenshot", label: "结果截图" },
  { value: "code_bundle", label: "代码包" },
];

export default function Submit() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [manualWorkspaceOpen, setManualWorkspaceOpen] = useState(false);
  const [form, setForm] = useState({
    organizationId: localStorage.getItem("lastWorkspaceId") || defaultOrganizationId,
    assetTitle: "",
    assetType: "lab_report",
  });
  const [file, setFile] = useState(null);
  const [fileHash, setFileHash] = useState("");
  const [stage, setStage] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState({ open: false, matches: [], body: null, organizationId: "" });

  useEffect(() => {
    listWorkspaces()
      .then((payload) => setWorkspaces(payload.workspaces || []))
      .catch((caught) => setError(caught.message));
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit({ skipDuplicateCheck = false } = {}) {
    if (!file) return;
    setError("");
    setResult(null);
    setShowDetails(false);
    setStage("reading");

    try {
      const contentBase64 = await fileToBase64(file);
      setStage("submitting");
      const body = {
        asset_title: form.assetTitle || file.name,
        filename: file.name,
        asset_type: form.assetType,
        content_base64: contentBase64,
      };
      const organizationId = form.organizationId || defaultOrganizationId;
      if (!skipDuplicateCheck) {
        const duplicate = await findOrganizationEvidenceByDigest(organizationId, fileHash || await sha256File(file));
        if (duplicate.matches?.length > 0) {
          setDuplicateDialog({ open: true, matches: duplicate.matches, body, organizationId });
          setStage("idle");
          return;
        }
      }
      const response = await preserveOrganizationEvidence(organizationId, body);
      setResult(response);
      setShowDetails(false);
      setFileHash(response.sha256);
      setStage("done");
    } catch (caught) {
      setError(caught.message);
      setStage("idle");
    }
  }

  const busy = ["reading", "submitting"].includes(stage);
  const hashMatched = result ? result.sha256 === fileHash : null;
  const isStored = Boolean(result?.proof_id);
  const hasChainRecord = Boolean(result?.proof?.fact_id && result?.proof?.receipt_id);
  const selectableWorkspaces = workspaces.filter((workspace) => workspace.workspace_id !== defaultOrganizationId);
  const selectedWorkspace = selectableWorkspaces.find((workspace) => workspace.workspace_id === form.organizationId);

  async function continueDuplicateSubmit() {
    const pending = duplicateDialog;
    setDuplicateDialog({ open: false, matches: [], body: null, organizationId: "" });
    if (!pending.body || !pending.organizationId) return;
    setError("");
    setResult(null);
    setShowDetails(false);
    setStage("submitting");
    try {
      const response = await preserveOrganizationEvidence(pending.organizationId, pending.body);
      setResult(response);
      setFileHash(response.sha256);
      setStage("done");
    } catch (caught) {
      setError(caught.message);
      setStage("idle");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">文件提交</h1>
        <p className="mt-1 text-sm text-slate-500">上传教学文件后，系统会生成文件数字指纹，并完成文件保存、版本登记和存证记录。</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="relative md:col-span-2">
              <span className="flex items-center gap-2 text-base font-semibold text-slate-700">
                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>
                选择项目空间
              </span>
              <button
                type="button"
                onClick={() => setWorkspacePickerOpen((open) => !open)}
                className="mt-1.5 flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-[#dfe8e2] bg-white px-4 py-3 text-left text-base outline-none transition hover:border-[#cbd8e6] hover:bg-[#fbfdff] focus:ring-2 focus:ring-[#dbe7f5]"
              >
                <span>
                  <span className="block font-semibold text-slate-900">
                    {selectedWorkspace ? displayWorkspaceName(selectedWorkspace) : "默认课程空间"}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {selectedWorkspace
                      ? `${displayAssetType(selectedWorkspace.workspace_type)} · ${workspaceStatusLabel(selectedWorkspace.status)}`
                      : "适用于没有单独创建课程空间的提交"}
                  </span>
                </span>
                <span className={`text-slate-400 transition ${workspacePickerOpen ? "rotate-180" : ""}`}>⌄</span>
              </button>

              {workspacePickerOpen && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white shadow-xl shadow-slate-900/10">
                  <button
                    type="button"
                    onClick={() => {
                      setForm((current) => ({ ...current, organizationId: defaultOrganizationId }));
                      localStorage.setItem("lastWorkspaceId", defaultOrganizationId);
                      setWorkspacePickerOpen(false);
                    }}
                    className={`block w-full px-4 py-3 text-left transition ${
                      form.organizationId === defaultOrganizationId ? "bg-[#f6f8fb]" : "hover:bg-[#fbfdff]"
                    }`}
                  >
                    <span className="block text-base font-semibold text-slate-900">默认课程空间</span>
                    <span className="mt-0.5 block text-sm text-slate-500">适用于本次演示或未单独分组的教学文件</span>
                  </button>
                  {selectableWorkspaces.map((workspace, index) => (
                    <button
                      key={workspace.workspace_id}
                      type="button"
                      onClick={() => {
                        setForm((current) => ({ ...current, organizationId: workspace.workspace_id }));
                        localStorage.setItem("lastWorkspaceId", workspace.workspace_id);
                        setWorkspacePickerOpen(false);
                      }}
                      className={`block w-full border-t border-[#edf2ef] px-4 py-3 text-left transition ${
                        form.organizationId === workspace.workspace_id ? "bg-[#f0f5fb]" : "hover:bg-[#f5f8fd]"
                      }`}
                    >
                      <span className="block text-base font-semibold text-slate-900">{displayWorkspaceName(workspace)}</span>
                      <span className="mt-0.5 block text-sm text-slate-500">
                        {displayAssetType(workspace.workspace_type)} · {workspaceStatusLabel(workspace.status)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setManualWorkspaceOpen((open) => !open)}
                className="mt-2 text-sm font-semibold text-[#334965] hover:text-[#1f3f6d]"
              >
                {manualWorkspaceOpen ? "收起指定空间编号" : "使用指定空间编号"}
              </button>
              {manualWorkspaceOpen && (
                <label className="mt-2 block rounded-xl border border-[#e5edf3] bg-[#fbfdff] p-3">
                  <span className="text-sm font-semibold text-slate-600">空间编号</span>
                  <input
                    name="organizationId"
                    value={form.organizationId}
                    onChange={updateField}
                    placeholder="仅在需要对接指定后端空间时填写"
                    className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-[#dbe7f5]"
                  />
                  <p className="mt-1 text-xs leading-5 text-slate-400">普通提交直接选择上方课程空间即可。</p>
                </label>
              )}
            </div>

            <label className="block">
              <span className="flex items-center gap-2 text-base font-semibold text-slate-700">
                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                文件标题
              </span>
              <input
                name="assetTitle"
                value={form.assetTitle}
                onChange={updateField}
                placeholder="默认使用文件名"
                className="mt-1.5 h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-base font-semibold text-slate-700">
                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>
                文件类型
              </span>
              <select
                name="assetType"
                value={form.assetType}
                onChange={updateField}
                className="mt-1.5 h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {assetTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6">
            <label className="mb-1.5 flex items-center gap-2 text-base font-semibold text-slate-700">
                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                选择文件
              </label>
            <input
              type="file"
              onChange={async (event) => {
                const nextFile = event.target.files?.[0] || null;
                setFile(nextFile);
                setFileHash(nextFile ? await sha256File(nextFile) : "");
                setResult(null);
                setShowDetails(false);
                setStage("idle");
              }}
              className="block w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-3 text-base file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-base file:text-emerald-700"
            />
            <div className="mt-3 grid gap-3 text-base md:grid-cols-3">
              <Meta label="文件名" value={file?.name || "未选择"} />
              <Meta label="文件大小" value={file ? formatBytes(file.size) : "未选择"} />
              <Meta label="当前阶段" value={stageLabel(stage)} />
            </div>
            <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-teal-700">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993m1.989 3.559A11.209 11.209 0 0 0 8.25 10.5a3.75 3.75 0 1 1 7.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 0 1-3.6 9.75m6.633-4.596a18.666 18.666 0 0 1-2.485 5.33" /></svg>
                文件数字指纹（SHA-256）
              </p>
              <p className="mt-1 break-all font-mono text-sm text-teal-950">{fileHash || "选择文件后自动生成，用于后续核验文件是否一致"}</p>
            </div>
          </div>

          {error && <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!file || busy}
            className="mt-6 rounded-lg border border-[#ead89b] bg-gradient-to-r from-[#f7e6a9] via-[#f1d88d] to-[#e8c66f] px-5 py-2.5 text-sm font-semibold text-[#5a3908] shadow-sm shadow-amber-900/10 transition hover:from-[#faedbd] hover:via-[#f4df9c] hover:to-[#edcf7d] active:scale-[0.99] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-none disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            {busy ? "正在提交..." : (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
                提交文件并存证
              </span>
            )}
          </button>
        </section>

        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm">
          <p className="mb-4 text-lg font-semibold text-slate-900">提交结果</p>
          {!result ? (
            <div className="flex flex-col items-center py-4">
              <img src={submitIllustration} alt="" className="w-full max-w-[320px]" />
              <p className="mt-2 text-base font-semibold text-slate-700">暂无提交结果</p>
              <p className="mt-1 text-sm text-slate-400">请在左侧填写信息并提交文件</p>
            </div>
          ) : (
            <div className="space-y-4">
              <StatusBadge status={result.status} />
              <StateLine ok={isStored} label={isStored ? "已生成系统存证记录" : "未生成系统存证记录"} />
              <StateLine ok={hashMatched} label={hashMatched ? "文件数字指纹已确认一致" : "文件数字指纹不一致，请重新提交"} />
              <StateLine ok={hasChainRecord} label={hasChainRecord ? "已生成存证/上链记录" : "未生成存证/上链记录"} />
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setShowDetails((open) => !open)}
                  className="w-full rounded-lg border border-[#cbd8e6] bg-white px-3 py-2.5 text-sm font-semibold text-[#334965] transition hover:bg-[#f3f7fb]"
                >
                  {showDetails ? "收起详细信息" : "查看详细信息"}
                </button>
              </div>
              {showDetails && (
                <div className="space-y-3 rounded-xl border border-[#e5edf3] bg-[#fbfdff] p-3">
                  <Field label="项目空间编号" value={result.asset?.organization_id} />
                  <Field label="文件编号" value={result.asset?.asset_id} />
                  <Field label="版本编号" value={result.version?.version_id} />
                  <Field label="版本号" value={result.version?.version_no ? `v${result.version.version_no}` : ""} />
                  <Field label="存证编号" value={result.proof_id} />
                  <Digest value={result.sha256} />
                  <Field label="链上事实编号" value={result.proof?.fact_id} />
                  <Field label="回执编号" value={result.proof?.receipt_id} />
                  <Field label="回执状态" value={displayStatus(result.proof?.receipt_status)} />
                  <Field label="版本链状态" value={displayStatus(result.proof?.trace_status)} />
                  <Field label="上链状态" value={displayStatus(result.proof?.anchor_status)} />
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate(`/verify?version_id=${result.version?.version_id || ""}`)}
                className="mt-1 w-full rounded-lg border border-[#9ed7c2] bg-[#e8f6ef] px-3 py-2.5 text-sm font-semibold text-[#087157] hover:bg-[#d9efe5]"
              >
                查看核验详情
              </button>
            </div>
          )}
        </section>
      </div>

      {duplicateDialog.open && (
        <DuplicateDialog
          matches={duplicateDialog.matches}
          onCancel={() => setDuplicateDialog({ open: false, matches: [], body: null, organizationId: "" })}
          onContinue={continueDuplicateSubmit}
          onView={() => {
            const assetId = duplicateDialog.matches[0]?.asset_id;
            setDuplicateDialog({ open: false, matches: [], body: null, organizationId: "" });
            navigate(assetId ? `/assets?asset_id=${assetId}` : "/assets");
          }}
        />
      )}
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div className="rounded-lg border border-[#dfe8e2] bg-[#fbfdfb] px-3 py-2">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 truncate text-base font-medium text-slate-800">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  return <span className={`inline-block rounded-full px-4 py-1.5 text-base font-semibold ${meta.badge}`}>{meta.label}</span>;
}

function Field({ label, value }) {
  return (
    <div className="border-b border-slate-100 pb-2 text-base">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 break-all text-slate-800">{displayValue(value)}</p>
    </div>
  );
}

function StateLine({ ok, label }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-lg font-semibold ${
      ok ? "border-[#cbd8e6] bg-[#f7fbff] text-[#1f3f6d]" : "border-rose-100 bg-rose-50 text-rose-700"
    }`}>
      {label}
    </div>
  );
}

function Digest({ value }) {
  return (
    <div className="rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm">
      <p className="text-teal-700">文件数字指纹（SHA-256）</p>
      <p className="mt-1 break-all font-mono text-teal-950">{value}</p>
    </div>
  );
}

function stageLabel(stage) {
  return {
    idle: "待提交",
    reading: "读取文件",
    submitting: "正在登记存证",
    done: "完成",
  }[stage] || stage;
}

function workspaceStatusLabel(status) {
  return displayStatus(status || "active");
}

function DuplicateDialog({ matches, onCancel, onContinue, onView }) {
  const first = matches[0] || {};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6">
      <section className="w-full max-w-2xl rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-2xl shadow-slate-900/20">
        <h2 className="text-2xl font-bold text-slate-900">发现相同文件</h2>
        <p className="mt-2 text-base leading-7 text-slate-500">
          当前项目空间中已经存在数字指纹一致的存证记录。通常不需要重复提交，除非你希望保留一条新的提交记录。
        </p>
        <div className="mt-5 rounded-xl border border-[#e5edf3] bg-[#fbfdff] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <DialogInfo label="已有文件编号" value={first.asset_id} />
            <DialogInfo label="已有版本编号" value={first.version_id} />
            <DialogInfo label="存证编号" value={first.proof_id} />
            <DialogInfo label="项目空间编号" value={first.organization_id} />
            <div className="sm:col-span-2">
              <DialogInfo label="SHA-256" value={first.sha256} />
            </div>
          </div>
          {matches.length > 1 && (
            <p className="mt-3 text-sm text-slate-500">还找到 {matches.length - 1} 条相同指纹记录。</p>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#dfe8e2] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            取消提交
          </button>
          <button
            type="button"
            onClick={onView}
            className="rounded-lg border border-[#cbd8e6] bg-[#f3f7fb] px-4 py-2.5 text-sm font-semibold text-[#334965] transition hover:bg-[#e8f0f8]"
          >
            查看已有记录
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-lg border border-[#ead89b] bg-gradient-to-r from-[#f7e6a9] via-[#f1d88d] to-[#e8c66f] px-4 py-2.5 text-sm font-semibold text-[#5a3908] transition hover:from-[#faedbd] hover:via-[#f4df9c] hover:to-[#edcf7d]"
          >
            仍然提交
          </button>
        </div>
      </section>
    </div>
  );
}

function DialogInfo({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-slate-800">{displayValue(value)}</p>
    </div>
  );
}
