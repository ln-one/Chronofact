import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { listScenarios } from "../services/mockChronofactApi";
import { getStatusMeta } from "../lib/status";

const stats = [
  { label: "资产总数", value: "7", icon: "▦", tone: "bg-emerald-50 text-emerald-700" },
  { label: "已核验", value: "3", icon: "✓", tone: "bg-teal-50 text-teal-700" },
  { label: "待处理", value: "2", icon: "◷", tone: "bg-amber-50 text-amber-700" },
  { label: "异常", value: "2", icon: "!", tone: "bg-rose-50 text-rose-700" },
];

export default function Overview() {
  const navigate = useNavigate();
  const scenarios = listScenarios();
  const [starting, setStarting] = useState(false);

  async function startSubmit() {
    setStarting(true);
    window.setTimeout(() => {
      navigate("/submit");
    }, 320);
  }

  return (
    <div className="space-y-6">
      <section className="relative grid overflow-hidden rounded-3xl border border-[#dfe8e2] bg-white/80 p-7 shadow-xl shadow-emerald-900/5 backdrop-blur lg:grid-cols-[1fr_430px]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,#d8f3e3_0%,transparent_38%)]" />
        <div className="relative max-w-2xl py-4">
          <div className="mb-4 inline-flex rounded-full border border-[#dfe8e2] bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            高校教学治理 · 可信存证
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-950">
            教学证据可信存证与智能核验
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
            面向实验报告、课程作业和教学文件，帮助完成文件存证、版本追踪、回执核验与 AI 辅助说明。
            用户可以快速查看文件是否被篡改、证明是否可用，并获得下一步人工复核建议。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startSubmit}
              disabled={starting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-900/20 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
            >
              {starting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {starting ? "正在进入" : "提交教学文件"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/verify/normalSubmission")}
              className="rounded-xl border border-[#dfe8e2] bg-white px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm transition duration-200 hover:border-[#cfded4] hover:bg-emerald-50 hover:shadow-lg hover:shadow-emerald-900/10 active:scale-[0.98]"
            >
              查看核验示例
            </button>
          </div>
        </div>
        <div className="relative hidden lg:block">
          <div className="absolute -inset-4 rounded-[2rem] bg-emerald-100/60 blur-xl" />
          <div className="relative flex h-full min-h-[260px] flex-col justify-between rounded-2xl border border-[#dfe8e2] bg-[#fbfdfb] p-6 shadow-lg shadow-emerald-900/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Evidence Flow</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">教学文件证据链</p>
              </div>
              <span className="rounded-full bg-[#f8e8a8] px-3 py-1 text-xs font-semibold text-emerald-950">
                SHA-256
              </span>
            </div>

            <div className="space-y-3">
              <FlowItem index="1" title="文件提交" text="upload_record / storage_ref" />
              <FlowItem index="2" title="摘要固化" text="asset_version / digest" />
              <FlowItem index="3" title="回执核验" text="receipt / trace / result" />
            </div>

            <div className="rounded-2xl border border-[#dfe8e2] bg-white/80 p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">verification result</span>
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 font-semibold text-teal-700 ring-1 ring-[#cfe4de]">
                  verified
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 w-[86%] rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#f4d35e]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map(({ label, value, icon, tone }) => (
          <div key={label} className="rounded-2xl border border-[#dfe8e2] bg-[#fcfefd] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
              </div>
              <span className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-semibold ${tone}`}>
                {icon}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent records */}
      <div className="rounded-2xl border border-[#dfe8e2] bg-[#fcfefd] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#dfe8e2] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">最近提交记录</h2>
            <p className="mt-1 text-sm text-slate-400">点击记录进入对应核验页</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
            {scenarios.length} records
          </span>
        </div>
        <ul className="divide-y divide-[#e7eee9]">
          {scenarios.map((s) => {
            const meta = getStatusMeta(s.status);
            return (
            <li key={s.key} className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-emerald-50/60">
              <div>
                <p className="text-base font-medium text-slate-800">{s.label}</p>
                {s.failure_reason && (
                  <p className="text-sm text-slate-400">{s.failure_reason}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${meta.badge}`}>
                  {meta.label}
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/verify/${s.key}`)}
                  className="rounded-lg border border-[#dfe8e2] bg-white px-3 py-1.5 text-sm font-medium text-slate-600 opacity-70 transition group-hover:opacity-100 hover:border-[#cfded4] hover:bg-emerald-50 hover:text-emerald-700 active:scale-[0.98]"
                >
                  查看详情
                </button>
              </div>
            </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CapabilityCard title="文件可信提交" text="选择教学文件后模拟摘要计算、资产版本创建和回执等待流程。" />
        <CapabilityCard title="版本链路追踪" text="展示 v1 到 v2 的 previous_version_id、digest 和核验状态。" />
        <CapabilityCard title="回执核验与 AI 解释" text="区分结构化证明来源和 AI 辅助说明，保留人工复核建议。" />
      </div>
    </div>
  );
}

function FlowItem({ index, title, text }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#dfe8e2] bg-white/80 p-3">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-sm font-bold text-emerald-700">
        {index}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function CapabilityCard({ title, text }) {
  return (
    <div className="rounded-2xl border border-[#dfe8e2] bg-[#fcfefd] p-5 shadow-sm">
      <div className="mb-4 h-1.5 w-10 rounded-full bg-gradient-to-r from-emerald-500 to-green-500" />
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}
