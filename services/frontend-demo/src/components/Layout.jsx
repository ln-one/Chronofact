import { NavLink, Outlet, useLocation } from "react-router-dom";
import { isLiveApiEnabled } from "../services/mockChronofactApi";

const navItems = [
  { to: "/dashboard", label: "概览", icon: "◈", end: true },
  { to: "/submit", label: "文件提交", icon: "↑" },
  { to: "/assets", label: "资产库", icon: "▦" },
  { to: "/verify", label: "核验中心", icon: "✓" },
  { to: "/reports", label: "报告导出", icon: "⎙" },
];

const breadcrumbMap = {
  "/dashboard": "概览",
  "/submit": "文件提交",
  "/assets": "资产库",
  "/verify": "核验中心",
  "/reports": "报告导出",
};

export default function Layout() {
  const { pathname } = useLocation();
  const crumb = breadcrumbMap[pathname] ?? "页面";
  const liveApiEnabled = isLiveApiEnabled();

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbfdfb] font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="flex h-screen w-72 flex-shrink-0 flex-col border-r border-[#d8e3dc] bg-[#f2faf5] text-slate-700 shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#d8e3dc] px-5 py-5">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold text-white text-sm shadow-md shadow-emerald-900/20">
            <span>C</span>
            <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[#f2faf5] bg-[#f4d35e]" />
            <span className="absolute bottom-1.5 right-1.5 h-1.5 w-4 rounded-full bg-[#f7e59a]/90" />
          </div>
          <div>
            <p className="text-base font-semibold text-emerald-950">Chronofact</p>
            <p className="text-sm text-emerald-700/80">教学证据链系统</p>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-base transition-all duration-200 ${
                  isActive
                    ? "bg-[#dcebdd] font-semibold text-[#063b32] ring-1 ring-[#ccd9cf]"
                    : "font-semibold text-[#263d38] hover:bg-white/75 hover:text-[#063b32]"
                }`
              }
            >
              <span
                className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full transition-all ${
                  pathname === to || (to !== "/" && pathname.startsWith(to))
                    ? "bg-emerald-400 opacity-100"
                    : "bg-emerald-300 opacity-0 group-hover:opacity-40"
                }`}
              />
              <span
                className={`grid h-7 w-7 place-items-center rounded-md text-center text-base transition-transform duration-200 group-hover:scale-105 ${
                  pathname === to || (to !== "/" && pathname.startsWith(to))
                    ? "bg-[#d0e7da] text-[#064238]"
                    : "bg-[#f7fcf9] text-[#5d7b76] group-hover:text-[#064238]"
                }`}
              >
                {icon}
              </span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-shrink-0 border-t border-[#dfe8e2] px-5 py-4">
          <div className="rounded-2xl border border-[#dfe8e2] bg-white/70 p-3 font-['Source_Han_Serif_SC','Noto_Serif_SC','SimSun',serif]">
            <p className="text-sm font-semibold text-emerald-800">存证核验服务</p>
            <p className="mt-1.5 whitespace-nowrap text-sm leading-6 text-slate-500">文件存证、回执核验与结果解释</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between border-b border-[#dfe8e2] bg-[#fbfdfb]/90 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Chronofact</span>
            <span>/</span>
            <span className="font-medium text-slate-800">{crumb}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            {liveApiEnabled ? "后端实时模式" : "前端演示模式"}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
