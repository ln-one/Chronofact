import overviewIllustration from "../assets/overview-illustration.png";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  chronofactApiBaseUrl,
  health,
  listAssets,
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
      const [service, workspaces, assets, reviews, audit] = await Promise.all([
        health(),
        listWorkspaces(),
        listAssets(),
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
  const preservedCount = data?.assets.filter((a) => a.latest_version?.preservation_record?.verification_status === "verified").length ?? 0;
  const attentionCount =
    data?.assets.filter((a) => a.latest_version?.preservation_record?.verification_status && a.latest_version.preservation_record.verification_status !== "verified").length +
      data?.reviews.filter((item) => ["needs_revision", "rejected"].includes(item.decision)).length || 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-[#cce6f5] bg-[linear-gradient(120deg,#fafcfe_0%,#e8f4fb_50%,#d8eef8_100%)] p-6 shadow-sm">
        <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-96 rounded-full bg-sky-200/20 blur-3xl" />

        {/* 右侧插图：四周渐变淡出融合 */}
        <img src={overviewIllustration} alt="" className="pointer-events-none absolute -bottom-4 right-10 hidden w-[420px] object-contain object-right-bottom xl:block" style={{
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 18%, black 78%, transparent 100%), linear-gradient(to top, transparent 0%, black 12%, black 100%)",
          WebkitMaskComposite: "source-in",
          maskImage: "linear-gradient(to right, transparent 0%, black 18%, black 78%, transparent 100%), linear-gradient(to top, transparent 0%, black 12%, black 100%)",
          maskComposite: "intersect",
        }} />

        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <p className="inline-flex rounded-full border border-sky-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 shadow-sm">
              Chronofact Workspace
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">存证管理中心</h1>
            <p className="mt-2 text-base leading-7 text-slate-600">
              查看已提交文件、存证状态、待处理事项和审计链完整性，快速确认当前教学材料是否可以继续核验或导出报告。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill label="服务状态" value={serviceStatusLabels[data?.service.status || (state.loading ? "loading" : "offline")] || data?.service.status} active />
              <StatusPill label="服务地址" value={chronofactApiBaseUrl.replace(/^https?:\/\//, "")} muted />
              <StatusPill label="审计链" value={data?.audit?.valid ? "完整" : state.loading ? "检查中" : "待确认"} active={data?.audit?.valid} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate("/workspaces")}
              className="flex items-center gap-1.5 rounded-lg border border-[#c8dff5] bg-white/90 px-4 py-2.5 text-sm font-semibold text-[#334965] shadow-sm transition hover:-translate-y-0.5 hover:bg-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>
              管理项目空间
            </button>
            <button type="button" onClick={load}
              className="flex items-center gap-1.5 rounded-lg border border-[#dfe8e2] bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
              刷新
            </button>
          </div>
        </div>

        {/* 流程步骤条 */}
        <div className="relative mt-5 flex flex-wrap items-center gap-1 text-sm font-medium">
          {[
            { icon: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5", label: "文件提交", color: "text-emerald-600" },
            { icon: "M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993m1.989 3.559A11.209 11.209 0 0 0 8.25 10.5a3.75 3.75 0 1 1 7.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 0 1-3.6 9.75m6.633-4.596a18.666 18.666 0 0 1-2.485 5.33", label: "指纹生成", color: "text-violet-600" },
            { icon: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244", label: "存证上链", color: "text-sky-600" },
            { icon: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z", label: "核验完成", color: "text-teal-600" },
          ].map((step, i) => (
            <span key={step.label} className="flex items-center gap-1">
              {i > 0 && <span className="mx-1 tracking-widest text-sky-300">·····→</span>}
              <svg className={`h-4 w-4 ${step.color}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d={step.icon} /></svg>
              <span className={step.color}>{step.label}</span>
            </span>
          ))}
        </div>

        {state.error && (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            无法连接存证核验服务：{state.error}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="服务状态" value={serviceStatusLabels[data?.service.status || (state.loading ? "loading" : "offline")] || data?.service.status} accent="teal" icon={<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />} />
        <Stat label="项目空间" value={data?.workspaces.length ?? 0} accent="violet" icon={<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />} />
        <Stat label="文件" value={data?.assets.length ?? 0} accent="pink" icon={<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />} />
        <Stat label="已存证" value={preservedCount} accent="emerald" icon={<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />} />
        <Stat label="待处理" value={attentionCount} accent={attentionCount > 0 ? "amber" : "slate"} icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />} />
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

function Stat({ label, value, accent = "teal", icon }) {
  const accents = {
    teal:   { bar: "from-[#5ecfbe] to-[#38b2a3]", num: "text-[#1a7a6e]", glow: "shadow-[0_4px_20px_rgba(94,207,190,0.25)]", bg: "bg-gradient-to-br from-white to-[#f0fdfb]", icon: "text-[#5ecfbe]" },
    violet: { bar: "from-[#b39ddb] to-[#9575cd]", num: "text-[#5e35b1]", glow: "shadow-[0_4px_20px_rgba(179,157,219,0.28)]", bg: "bg-gradient-to-br from-white to-[#faf7ff]", icon: "text-[#b39ddb]" },
    pink:   { bar: "from-[#f48fb1] to-[#f06292]", num: "text-[#ad1457]", glow: "shadow-[0_4px_20px_rgba(244,143,177,0.28)]", bg: "bg-gradient-to-br from-white to-[#fff5f8]", icon: "text-[#f48fb1]" },
    emerald:{ bar: "from-[#6fcf97] to-[#27ae60]", num: "text-[#1a6e40]", glow: "shadow-[0_4px_20px_rgba(111,207,151,0.28)]", bg: "bg-gradient-to-br from-white to-[#f0fdf4]", icon: "text-[#6fcf97]" },
    amber:  { bar: "from-[#ffd54f] to-[#ffb300]", num: "text-[#8a6000]", glow: "shadow-[0_4px_20px_rgba(255,213,79,0.32)]", bg: "bg-gradient-to-br from-white to-[#fffbeb]", icon: "text-[#ffd54f]" },
    slate:  { bar: "from-[#b0bec5] to-[#90a4ae]", num: "text-[#455a64]", glow: "shadow-[0_4px_20px_rgba(176,190,197,0.2)]",  bg: "bg-gradient-to-br from-white to-[#f5f7f8]", icon: "text-[#b0bec5]" },
  };
  const { bar, num, glow, bg, icon: iconColor } = accents[accent] || accents.teal;
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/80 ${bg} ${glow} p-5`}>
      <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${bar}`} />
      <div className={`pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br ${bar} opacity-10 blur-xl`} />
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`h-5 w-5 ${iconColor} opacity-70`}>
            {icon}
          </svg>
        )}
      </div>
      <p className={`mt-3 text-3xl font-bold tracking-tight ${num}`} style={{ fontFamily: "'Noto Serif SC', 'SimSun', serif" }}>{value}</p>
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
