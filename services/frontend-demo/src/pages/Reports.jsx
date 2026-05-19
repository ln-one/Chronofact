import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getVersionReport, getWorkspaceReport, listAssets, listWorkspaces } from "../services/chronofactApi";
import { getStatusMeta } from "../lib/status";
import { displayDateTime, displayValue } from "../lib/display";

export default function Reports() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [assets, setAssets] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [targetType, setTargetType] = useState(params.get("workspace_id") ? "workspace" : "version");
  const [versionId, setVersionId] = useState(params.get("version_id") || "");
  const [workspaceId, setWorkspaceId] = useState(params.get("workspace_id") || "");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listAssets(), listWorkspaces()])
      .then(([assetPayload, workspacePayload]) => {
        const nextAssets = assetPayload.assets || [];
        const nextWorkspaces = workspacePayload.workspaces || [];
        setAssets(nextAssets);
        setWorkspaces(nextWorkspaces);
        if (!versionId && nextAssets[0]?.latest_version?.version_id) {
          setVersionId(nextAssets[0].latest_version.version_id);
        }
        if (!workspaceId && nextWorkspaces[0]?.workspace_id) {
          setWorkspaceId(nextWorkspaces[0].workspace_id);
        }
      })
      .catch((caught) => setError(caught.message));
  }, []);

  async function generateReport() {
    setLoading(true);
    setError("");
    try {
      if (targetType === "workspace") {
        const payload = await getWorkspaceReport(workspaceId);
        setReport({ type: "workspace", payload });
        setParams({ workspace_id: workspaceId });
      } else {
        const payload = await getVersionReport(versionId);
        setReport({ type: "version", payload });
        setParams({ version_id: versionId });
      }
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  const verification = report?.payload?.verification_result;
  const status = verification ? getStatusMeta(verification.status) : null;
  const markdown = report?.payload?.report?.content || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">报告导出</h1>
          <p className="mt-1 text-sm text-slate-500">生成版本核验报告和项目空间汇总报告。</p>
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
        <div className="mb-5 inline-flex rounded-xl border border-[#dfe8e2] bg-[#f6fbf8] p-1">
          <ModeButton active={targetType === "version"} onClick={() => setTargetType("version")}>
            版本核验报告
          </ModeButton>
          <ModeButton active={targetType === "workspace"} onClick={() => setTargetType("workspace")}>
            项目空间报告
          </ModeButton>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          {targetType === "version" ? (
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">选择版本</span>
              <select
                value={versionId}
                onChange={(event) => setVersionId(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {assets.map((asset) => (
                  <option key={asset.asset_id} value={asset.latest_version?.version_id || ""}>
                    {asset.title || asset.asset_id} · {asset.latest_version ? `v${asset.latest_version.version_no}` : "暂无版本"}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">选择项目空间</span>
              <select
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.workspace_id} value={workspace.workspace_id}>
                    {workspace.title} ({workspace.workspace_id})
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={generateReport}
            disabled={loading || (targetType === "version" ? !versionId : !workspaceId)}
            className="self-end rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-wait disabled:bg-slate-300"
          >
            {loading ? "生成中..." : "生成报告"}
          </button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm">
          <p className="font-semibold text-slate-900">报告信息</p>
          {!report ? (
            <p className="mt-4 text-sm text-slate-400">请选择目标并生成报告。</p>
          ) : (
            <div className="mt-4 space-y-3">
              <Info label="报告类型" value={report.type === "version" ? "版本核验报告" : "项目空间汇总报告"} />
              <Info label="报告格式" value={report.payload.report.format === "markdown" ? "文本报告" : report.payload.report.format} />
              <Info label="生成时间" value={displayDateTime(report.payload.report.generated_at)} />
              {status && (
                <div>
                  <p className="mb-1 text-sm text-slate-500">核验状态</p>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${status.badge}`}>{status.label}</span>
                </div>
              )}
              {report.type === "version" && (
                <>
                  <Info label="版本编号" value={report.payload.evidence.asset_version.version_id} />
                  <Info label="文件数字指纹" value={report.payload.evidence.preservation_record.digest} />
                  <Info label="回执编号" value={report.payload.evidence.preservation_record.receipt_id} />
                </>
              )}
              {report.type === "workspace" && (
                <>
                  <Info label="项目空间编号" value={report.payload.workspace.workspace_id} />
                  <Info label="文件数量" value={String(report.payload.workspace.assets.length)} />
                </>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-semibold text-slate-900">报告内容预览</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {report ? "已生成" : "等待生成"}
            </span>
          </div>
          {markdown ? (
            <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-xl border border-[#dfe8e2] bg-[#fbfdfb] p-4 text-sm leading-6 text-slate-800">
              {markdown}
            </pre>
          ) : (
            <div className="rounded-xl border border-dashed border-[#dfe8e2] p-8 text-sm text-slate-400">
              这里会展示系统生成的版本核验报告或项目空间汇总报告。
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ModeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-lg px-4 text-sm font-semibold transition ${
        active ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500 hover:text-emerald-700"
      }`}
    >
      {children}
    </button>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-[#dfe8e2] bg-[#fbfdfb] px-4 py-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1.5 break-all text-base text-slate-800">{displayValue(value)}</p>
    </div>
  );
}
