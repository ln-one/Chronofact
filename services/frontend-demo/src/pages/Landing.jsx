import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  function startApp() {
    setStarting(true);
    window.setTimeout(() => navigate("/dashboard"), 320);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#eef7f1] p-3 text-slate-900">
      <section className="relative mx-auto flex min-h-[calc(100vh-24px)] max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/80 bg-[radial-gradient(circle_at_50%_46%,rgba(16,185,129,0.13),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(52,211,153,0.08),transparent_24%),radial-gradient(circle_at_18%_76%,rgba(52,211,153,0.07),transparent_26%),linear-gradient(180deg,#f8fcfa_0%,#f1f7f2_100%)] px-8 py-6 shadow-2xl shadow-emerald-900/10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(15,143,102,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,143,102,0.045)_1px,transparent_1px)] bg-[size:52px_52px] opacity-80" />
          <div className="absolute left-1/2 top-[47%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.14),transparent_64%)] blur-[18px]" />
          <div className="absolute right-[90px] top-[155px] h-[120px] w-[120px] bg-[radial-gradient(rgba(15,143,102,0.28)_1.4px,transparent_1.4px)] bg-[size:14px_14px] opacity-[0.22]" />
        </div>

        <header className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-lg shadow-emerald-900/20">
              <span>C</span>
              <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[#fbfdfb] bg-[#f4d35e]" />
              <span className="absolute bottom-1.5 right-1.5 h-1.5 w-5 rounded-full bg-[#f7e59a]/90" />
            </div>
            <div>
              <p className="text-base font-bold text-emerald-950">Chronofact</p>
              <p className="text-xs text-emerald-700/70">高校教学证据可信存证与智能核验平台</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-2.5 text-sm font-bold text-emerald-900 shadow-md shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:from-emerald-100 hover:to-emerald-50"
            >
              登录 / 注册
            </button>
            <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-white/70 px-4 py-2 text-xs font-medium text-emerald-700 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              存证服务在线
            </div>
          </div>
        </header>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center pt-6 text-center">
          <h1 className="max-w-4xl text-5xl font-bold leading-tight tracking-tight text-emerald-950">
            高校教学证据可信存证<br />与智能核验平台
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            面向实验报告、作业和课程文件，提供文件提交、数字指纹登记、
            版本追踪、可信核验与辅助解释等完整流程。
          </p>

          <button
            type="button"
            onClick={() => navigate("/auth")}
            disabled={starting}
            className="mt-7 inline-flex min-w-[320px] items-center justify-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-700 px-9 py-4 text-xl font-bold text-white shadow-2xl shadow-emerald-900/20 transition duration-200 hover:-translate-y-1 hover:from-emerald-400 hover:to-emerald-600 hover:shadow-emerald-900/25 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-xl text-emerald-600">
              →
            </span>
            开始使用
          </button>

          <div className="mt-14 grid w-full max-w-3xl gap-5 md:grid-cols-3">
            <Feature icon="▤" title="数字指纹存证" text="登记文件指纹，便于后续核验一致性" />
            <Feature icon="⌁" title="版本链路追踪" text="记录版本变化，追踪文件演化过程" />
            <Feature icon="✓" title="可信核验解释" text="展示核验结果，支持 AI 辅助解释" />
          </div>
        </div>

        <footer className="relative z-10 pb-1 pt-5 text-center text-xs text-slate-500">
          区块链技术及应用课程设计
        </footer>
      </section>
    </main>
  );
}

function Feature({ icon, title, text }) {
  return (
    <div className="rounded-2xl border border-[#dfe8e2] bg-white/80 p-5 text-center font-['Source_Han_Serif_SC','Noto_Serif_SC','SimSun',serif] shadow-lg shadow-emerald-900/5 backdrop-blur">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-xl font-bold text-emerald-600">
        {icon}
      </div>
      <p className="mt-3 text-lg font-bold text-emerald-950">{title}</p>
      <p className="mt-1.5 text-base leading-6 text-slate-500">{text}</p>
    </div>
  );
}
