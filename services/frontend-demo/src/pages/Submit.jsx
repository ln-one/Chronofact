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
import { displayAssetType, displayStatus, displayValue } from "../lib/display";

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
    organizationId: defaultOrganizationId,
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
  const selectedWorkspace = workspaces.find((workspace) => workspace.workspace_id === form.organizationId);

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
              <span className="text-base font-semibold text-slate-700">选择项目空间</span>
              <button
                type="button"
                onClick={() => setWorkspacePickerOpen((open) => !open)}
                className="mt-1.5 flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-[#dfe8e2] bg-white px-4 py-3 text-left text-base outline-none transition hover:border-[#cbd8e6] hover:bg-[#fbfdff] focus:ring-2 focus:ring-[#dbe7f5]"
              >
                <span>
                  <span className="block font-semibold text-slate-900">
                    {selectedWorkspace ? workspaceDisplayName(selectedWorkspace, workspaces.indexOf(selectedWorkspace)) : "默认课程空间"}
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
                      setWorkspacePickerOpen(false);
                    }}
                    className={`block w-full px-4 py-3 text-left transition ${
                      form.organizationId === defaultOrganizationId ? "bg-[#f6f8fb]" : "hover:bg-[#fbfdff]"
                    }`}
                  >
                    <span className="block text-base font-semibold text-slate-900">默认课程空间</span>
                    <span className="mt-0.5 block text-sm text-slate-500">适用于本次演示或未单独分组的教学文件</span>
                  </button>
                  {workspaces.map((workspace, index) => (
                    <button
                      key={workspace.workspace_id}
                      type="button"
                      onClick={() => {
                        setForm((current) => ({ ...current, organizationId: workspace.workspace_id }));
                        setWorkspacePickerOpen(false);
                      }}
                      className={`block w-full border-t border-[#edf2ef] px-4 py-3 text-left transition ${
                        form.organizationId === workspace.workspace_id ? "bg-[#fcf6f7]" : "hover:bg-[#fdf9fa]"
                      }`}
                    >
                      <span className="block text-base font-semibold text-slate-900">{workspaceDisplayName(workspace, index)}</span>
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
              <span className="text-base font-semibold text-slate-700">文件标题</span>
              <input
                name="assetTitle"
                value={form.assetTitle}
                onChange={updateField}
                placeholder="默认使用文件名"
                className="mt-1.5 h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="block">
              <span className="text-base font-semibold text-slate-700">文件类型</span>
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
            <label className="mb-1.5 block text-base font-semibold text-slate-700">选择文件</label>
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
              <p className="text-sm font-semibold text-teal-700">文件数字指纹（SHA-256）</p>
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
            {busy ? "正在提交..." : "提交文件并存证"}
          </button>
        </section>

        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm">
          <p className="mb-4 text-lg font-semibold text-slate-900">提交结果</p>
          {!result ? (
            <p className="text-base leading-7 text-slate-400">提交后这里会显示文件保存、版本登记、上链回执和核验结果。</p>
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

function workspaceDisplayName(workspace, index) {
  const title = String(workspace?.title || "").trim();
  const looksLikeInternalValue = !title || title === workspace?.workspace_id || /^[0-9_-]{1,4}$/i.test(title);
  return looksLikeInternalValue ? `课程空间 ${index + 1}` : title;
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
