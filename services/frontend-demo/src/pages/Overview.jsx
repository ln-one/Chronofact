import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  chronofactApiBaseUrl,
  health,
  listAssets,
  listEvidence,
  listReviews,
  listWorkspaces,
  verifyAuditLog,
} from "../services/chronofactApi";
import { getStatusMeta } from "../lib/status";
import { displayAssetType, displayStatus, displayValue } from "../lib/display";

const serviceStatusLabels = {
  ok: "正常",
  loading: "加载中",
  offline: "离线",
};

export default function Overview() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", data: null });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const [service, workspaces, assets, evidence, reviews, audit] = await Promise.all([
        health(),
        listWorkspaces(),
        listAssets(),
        listEvidence(),
        listReviews(),
        verifyAuditLog(),
      ]);
      setState({
        loading: false,
        error: "",
        data: {
          service,
          workspaces: workspaces.workspaces || [],
          assets: assets.assets || [],
          evidence: evidence.evidence || [],
          reviews: reviews.reviews || [],
          audit: audit.audit_integrity,
        },
      });
    } catch (error) {
      setState({ loading: false, error: error.message, data: null });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const data = state.data;
  const preservedCount = data?.evidence.filter((item) => item.verification_status === "verified").length ?? 0;
  const attentionCount =
    data?.evidence.filter((item) => item.verification_status !== "verified").length +
      data?.reviews.filter((item) => ["needs_revision", "rejected"].includes(item.decision)).length || 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-[#dfe8e2] bg-[linear-gradient(135deg,#ffffff_0%,#f5fbf8_48%,#eef7fb_100%)] p-6 shadow-sm">
        <div className="pointer-events-none absolute right-8 top-8 h-28 w-28 rounded-full bg-emerald-100/35 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-20 w-72 -translate-x-1/2 rounded-full bg-sky-100/35 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-emerald-100 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 shadow-sm">
              Chronofact Workspace
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">工作台概览</h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
              查看已提交文件、存证状态、待处理事项和审计链完整性，快速确认当前教学材料是否可以继续核验或导出报告。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill label="服务状态" value={serviceStatusLabels[data?.service.status || (state.loading ? "loading" : "offline")] || data?.service.status} active />
              <StatusPill label="服务地址" value={chronofactApiBaseUrl.replace(/^https?:\/\//, "")} muted />
              <StatusPill label="审计链" value={data?.audit?.valid ? "完整" : state.loading ? "检查中" : "待确认"} active={data?.audit?.valid} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate("/workspaces")}
              className="rounded-lg border border-[#cbd8e6] bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#334965] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              管理项目空间
            </button>
            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-[#dfe8e2] bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              刷新
            </button>
          </div>
        </div>

        {state.error && (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            无法连接存证核验服务：{state.error}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="服务状态" value={serviceStatusLabels[data?.service.status || (state.loading ? "loading" : "offline")] || data?.service.status} />
        <Stat label="项目空间" value={data?.workspaces.length ?? 0} />
        <Stat label="文件" value={data?.assets.length ?? 0} />
        <Stat label="已存证" value={preservedCount} />
        <Stat label="待处理" value={attentionCount} tone={attentionCount > 0 ? "amber" : "emerald"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-[#dfe8e2] bg-white shadow-sm">
          <SectionHeader title="最近文件" subtitle="最新提交和存证状态" />
          <div className="divide-y divide-[#e7eee9]">
            {(data?.assets || []).slice(0, 6).map((asset) => {
              const latest = asset.latest_version;
              const meta = getOverviewFileStatusMeta(latest?.preservation_record?.verification_status || "pending");
              return (
                <button
                  key={asset.asset_id}
                  type="button"
                  onClick={() => navigate(`/assets?asset_id=${asset.asset_id}`)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-emerald-50/60"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{asset.title || asset.asset_id}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {displayAssetType(asset.asset_type)} · 最新版本 {latest ? `v${latest.version_no}` : "暂无"}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
                </button>
              );
            })}
            {!state.loading && data?.assets.length === 0 && <Empty text="暂无文件。请先在文件提交页上传需要存证的教学文件。" />}
          </div>
        </section>

        <section className="rounded-2xl border border-[#dfe8e2] bg-white shadow-sm">
          <SectionHeader title="项目空间与审计" subtitle="项目空间状态与审计记录完整性" />
          <div className="space-y-4 p-5">
            {(data?.workspaces || []).slice(0, 4).map((workspace) => (
              <div key={workspace.workspace_id} className="rounded-xl border border-[#dfe8e2] bg-[#fbfdfb] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{workspace.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{workspace.workspace_id} · {displayAssetType(workspace.workspace_type)}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {displayStatus(workspace.status)}
                  </span>
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-[#dfe8e2] bg-white p-4 text-sm">
              <p className="font-semibold text-slate-900">审计校验链</p>
              <p className="mt-2 text-slate-500">
                完整性：{data?.audit?.valid ? "通过" : "未知"} · 已检查 {data?.audit?.checked_count ?? 0} 条记录
              </p>
              <p className="mt-2 break-all font-mono text-xs text-slate-500">
                最新校验值：{displayValue(data?.audit?.latest_entry_hash)}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "emerald" }) {
  const toneClass = tone === "amber" ? "text-amber-700 bg-amber-50" : "text-emerald-700 bg-emerald-50";
  return (
    <div className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 inline-flex rounded-lg px-3 py-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusPill({ label, value, active = false }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm"
    >
      <span className={`h-2 w-2 rounded-full ${active ? "bg-sky-500" : "bg-slate-300"}`} />
      <span className="text-slate-500">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="border-b border-[#dfe8e2] px-5 py-4">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function Empty({ text }) {
  return <div className="px-5 py-8 text-sm text-slate-400">{text}</div>;
}

function getOverviewFileStatusMeta(status) {
  const meta = getStatusMeta(status);
  if (status === "verified") {
    return { ...meta, label: "已存证" };
  }
  return meta;
}
