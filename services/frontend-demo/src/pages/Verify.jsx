import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  defaultOrganizationId,
  findOrganizationEvidenceByDigest,
  listOrganizationEvidence,
  listWorkspaces,
  verifyOrganizationEvidence,
} from "../services/chronofactApi";
import { fileToBase64, formatBytes, sha256File } from "../services/fileDigest";
import { getStatusMeta } from "../lib/status";
import { displayStatus, displayValue, displayWorkspaceName } from "../lib/display";

export default function Verify() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [workspaces, setWorkspaces] = useState([]);
  const [organizationId, setOrganizationId] = useState(
    localStorage.getItem("lastWorkspaceId") || defaultOrganizationId
  );
  const [file, setFile] = useState(null);
  const [fileHash, setFileHash] = useState("");
  const [matchedRecord, setMatchedRecord] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [digestQuery, setDigestQuery] = useState("");
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestResult, setDigestResult] = useState(null);
  const [recordsModal, setRecordsModal] = useState({ open: false, records: [], organizationId: "" });
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    listWorkspaces().then((p) => setWorkspaces(p.workspaces || [])).catch(() => {});
  }, []);

  function handleWorkspaceChange(id) {
    setOrganizationId(id);
    localStorage.setItem("lastWorkspaceId", id);
  }

  async function chooseFile(event) {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setFileHash(nextFile ? await sha256File(nextFile) : "");
    setMatchedRecord(null);
    setEvidence(null);
    setVerification(null);
    setSearched(false);
    setError("");
  }

  async function handleVerify() {
    if (!file) return;
    setLoading(true);
    setError("");
    setSearched(false);

    try {
      const [hash, contentBase64] = await Promise.all([
        fileHash || sha256File(file),
        fileToBase64(file),
      ]);
      const verified = await verifyOrganizationEvidence(organizationId || defaultOrganizationId, {
        sha256: hash,
        content_base64: contentBase64,
        version_id: params.get("version_id") || undefined,
      });
      const match = verified.matches?.[0] || verified.target || null;

      setMatchedRecord(match || null);
      setVerification(verified);
      setSearched(true);

      if (!match) {
        setEvidence(null);
        return;
      }
      setEvidence(match);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  async function searchDigest() {
    if (!digestQuery.trim()) return;
    setDigestLoading(true);
    setError("");
    try {
      const payload = await findOrganizationEvidenceByDigest(
        organizationId || defaultOrganizationId,
        digestQuery.trim(),
      );
      setDigestResult({ mode: "digest", ...payload });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setDigestLoading(false);
    }
  }

  async function loadOrganizationEvidence() {
    setDigestLoading(true);
    setError("");
    try {
      const payload = await listOrganizationEvidence(organizationId || defaultOrganizationId);
      setRecordsModal({
        open: true,
        records: payload.evidence || [],
        organizationId: organizationId || defaultOrganizationId,
      });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setDigestLoading(false);
    }
  }

  const stored = verification?.result === "preserved" || verification?.result === "pending";
  const chainRecorded = Boolean(matchedRecord?.anchor_status || verification?.proof?.receipt_status);
  const status = verification?.result || matchedRecord?.receipt_status || "pending";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">文件校验</h1>
          <p className="mt-1 text-base text-slate-500">再次上传文件后，系统会生成文件数字指纹，并在指定项目空间中查找一致的存证记录。</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/assets")}
          className="rounded-lg border border-[#dfe8e2] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          查看文件库
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <section className="rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[220px_1fr_auto]">
          <label className="block">
            <span className="text-base font-semibold text-slate-700">选择项目空间</span>
            <WorkspaceSelect workspaces={workspaces} value={organizationId} onChange={handleWorkspaceChange} />
          </label>
          <label className="block">
            <span className="text-base font-semibold text-slate-700">上传待校验文件</span>
            <input
              type="file"
              onChange={chooseFile}
              className="mt-1.5 block h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-2 text-base file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-4 file:py-1.5 file:text-base file:text-emerald-700"
            />
          </label>

          <button
            type="button"
            onClick={handleVerify}
            disabled={!file || loading}
            className="self-end rounded-lg border border-[#ead89b] bg-gradient-to-r from-[#f7e6a9] via-[#f1d88d] to-[#e8c66f] px-6 py-3 text-base font-semibold text-[#5a3908] shadow-sm shadow-amber-900/10 transition hover:from-[#faedbd] hover:via-[#f4df9c] hover:to-[#edcf7d] active:scale-[0.99] disabled:cursor-wait disabled:border-slate-200 disabled:bg-none disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            {loading ? "搜索中..." : "计算并校验存证"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Info label="文件名" value={file?.name || "未选择"} />
          <Info label="文件大小" value={file ? formatBytes(file.size) : "未选择"} />
          <Info label="文件数字指纹（SHA-256）" value={fileHash || "选择文件后自动生成"} />
        </div>
      </section>

      <section className="rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">按数字指纹查询</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              已知 SHA-256 指纹时，可以不上传文件，直接查询当前项目空间内是否存在对应存证记录。
            </p>
          </div>
          <button
            type="button"
            onClick={loadOrganizationEvidence}
            disabled={digestLoading}
            className="rounded-lg border border-[#cbd8e6] bg-[#f3f7fb] px-4 py-2 text-sm font-semibold text-[#334965] transition hover:bg-[#e8f0f8] disabled:cursor-wait disabled:bg-slate-100"
          >
            查看本空间全部记录
          </button>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr_auto]">
          <label className="block">
            <span className="text-base font-semibold text-slate-700">选择项目空间</span>
            <WorkspaceSelect workspaces={workspaces} value={organizationId} onChange={handleWorkspaceChange} />
          </label>
          <label className="block">
            <span className="text-base font-semibold text-slate-700">SHA-256 数字指纹</span>
            <input
              value={digestQuery}
              onChange={(event) => setDigestQuery(event.target.value)}
              placeholder="输入 64 位十六进制 SHA-256"
              className="mt-1.5 h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-2 font-mono text-base outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="button"
            onClick={searchDigest}
            disabled={!digestQuery.trim() || digestLoading}
            className="self-end rounded-lg border border-[#ead89b] bg-gradient-to-r from-[#f7e6a9] via-[#f1d88d] to-[#e8c66f] px-6 py-3 text-base font-semibold text-[#5a3908] shadow-sm shadow-amber-900/10 transition hover:from-[#faedbd] hover:via-[#f4df9c] hover:to-[#edcf7d] disabled:cursor-wait disabled:border-slate-200 disabled:bg-none disabled:bg-slate-200 disabled:text-slate-500"
          >
            {digestLoading ? "查询中..." : "查询指纹"}
          </button>
        </div>

        <DigestSearchResult payload={digestResult} />
      </section>

      {recordsModal.open && (
        <RecordsModal
          organizationId={recordsModal.organizationId}
          records={recordsModal.records}
          onClose={() => setRecordsModal({ open: false, records: [], organizationId: "" })}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold text-slate-900">搜索结果</p>
            {searched && <ResultBadge stored={stored} />}
          </div>

          {!searched ? (
            <p className="text-base leading-7 text-slate-400">上传文件后点击校验，系统会在当前项目空间中查找已存证记录。</p>
          ) : stored ? (
            <div className="space-y-3">
              <StateLine ok label="已存证：系统找到与当前文件一致的存证记录" />
              <StateLine ok={chainRecorded} label={chainRecorded ? "已生成存证/上链记录" : "找到记录，但链上证明暂不完整"} />
              <StateLine
                ok={verification?.result !== "mismatch"}
                label={verification?.result === "mismatch" ? "文件数字指纹不一致" : "文件数字指纹一致"}
              />
              <Info label="文件编号" value={matchedRecord.asset_id} />
              <Info label="版本编号" value={matchedRecord.version_id} />
              <Info label="存证编号" value={matchedRecord.proof_id} />
              <Info label="核验状态" value={displayStatus(verification.result)} />
              <Info label="项目空间编号" value={matchedRecord.organization_id} />
            </div>
          ) : (
            <div className="space-y-3">
              <StateLine ok={false} label="未存证：系统没有找到与当前文件一致的存证记录" emphasis />
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-base leading-8 text-amber-900">
                当前文件的数字指纹没有出现在该项目空间的存证记录中。请确认项目空间编号是否正确，以及该文件是否已经在“文件提交”页面完成上传和存证；如果刚刚提交过，请稍后刷新后再试。
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold text-slate-900">存证详情</p>
            {stored && <StatusBadge status={status} />}
          </div>

          {evidence ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="文件编号" value={evidence.asset_id} />
              <Info label="版本编号" value={evidence.version_id} />
              <Info label="登记数字指纹" value={evidence.sha256} />
              <Info label="项目空间编号" value={evidence.organization_id} />
              <Info label="上链状态" value={displayStatus(evidence.anchor_status)} />
              <Info label="回执状态" value={displayStatus(verification?.proof?.receipt_status || evidence.receipt_status)} />
              <Info label="核验结果" value={displayStatus(verification?.result)} />
            </div>
          ) : (
            <p className="text-base leading-7 text-slate-400">找到存证记录后会显示回执、链上事实、文件保存位置和核验状态。</p>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>;
}

function ResultBadge({ stored }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
      stored ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
    }`}>
      {stored ? "已存证" : "未存证"}
    </span>
  );
}

function StateLine({ ok, label, emphasis = false }) {
  return (
    <div className={`rounded-lg border font-semibold ${
      emphasis ? "min-h-[62px] px-5 py-4 text-lg" : "px-3 py-2 text-base"
    } ${
      ok ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"
    }`}>
      {label}
    </div>
  );
}

function WorkspaceSelect({ workspaces, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1.5 h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-emerald-100"
    >
      <option value={defaultOrganizationId}>默认课程空间</option>
      {workspaces.map((ws) => (
        <option key={ws.workspace_id} value={ws.workspace_id}>{displayWorkspaceName(ws)}</option>
      ))}
    </select>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-[#dfe8e2] bg-[#fbfdfb] px-4 py-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 break-all text-base text-slate-800">{displayValue(value)}</p>
    </div>
  );
}

function DigestSearchResult({ payload }) {
  if (!payload) {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-[#dfe8e2] p-5 text-base leading-7 text-slate-400">
        输入数字指纹后查询，或查看当前项目空间内全部存证记录。
      </p>
    );
  }

  const records = payload.matches || [];
  const title = `匹配结果：${payload.sha256 || ""}`;

  return (
    <div className="mt-5 rounded-xl border border-[#dfe8e2] bg-[#fbfdfb]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfe8e2] px-4 py-3">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          {records.length} 条记录
        </span>
      </div>
      {records.length === 0 ? (
        <p className="px-4 py-6 text-base text-slate-400">没有找到对应的存证记录。</p>
      ) : (
        <div className="divide-y divide-[#e7eee9]">
          {records.map((record) => (
            <div key={record.proof_id || record.version_id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_1fr_1fr]">
              <Info label="文件编号" value={record.asset_id} />
              <Info label="版本编号" value={record.version_id} />
              <Info label="存证编号" value={record.proof_id} />
              <Info label="项目空间编号" value={record.organization_id} />
              <Info label="文件名" value={record.filename} />
              <Info label="存证状态" value={displayStatus(record.receipt_status || record.verification_status)} />
              <div className="lg:col-span-3">
                <Info label="SHA-256" value={record.sha256 || record.digest} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecordsModal({ organizationId, records, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6">
      <section className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white shadow-2xl shadow-slate-900/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dfe8e2] bg-[#fbfdfb] px-6 py-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">本空间存证记录</h2>
            <p className="mt-1 text-sm text-slate-500">
              项目空间：{organizationId} · 共 {records.length} 条记录
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#dfe8e2] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            关闭
          </button>
        </div>

        <div className="max-h-[68vh] overflow-auto p-5">
          {records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#dfe8e2] p-8 text-center text-base text-slate-400">
              当前项目空间暂无存证记录。
            </div>
          ) : (
            <div className="grid gap-4">
              {records.map((record) => (
                <div key={record.proof_id || record.version_id} className="rounded-xl border border-[#dfe8e2] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">
                        {record.filename || record.asset_id || "存证记录"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {record.asset_id} · {record.version_id} · {record.proof_id}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-[#f3f7fb] px-3 py-1 text-xs font-semibold text-[#334965]">
                      {displayStatus(record.receipt_status || record.verification_status)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Info label="提交人" value={record.submitted_by} />
                    <Info label="创建时间" value={record.created_at} />
                    <div className="md:col-span-2">
                      <Info label="SHA-256" value={record.sha256 || record.digest} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
