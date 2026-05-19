import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loginIdentity, registerIdentity } from "../services/limoraAuth";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const isRegister = mode === "register";
  const title = isRegister ? "创建 Chronofact 账户" : "登录 Chronofact";
  const subtitle = isRegister
    ? "填写基本信息后即可进入教学证据链系统。"
    : "进入教学证据链工作台，继续处理文件提交和核验记录。";

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSearchParams(nextMode === "register" ? { mode: "register" } : {});
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (isRegister) {
        await registerIdentity(form);
      } else {
        await loginIdentity(form);
      }
      window.setTimeout(() => navigate("/dashboard"), 260);
    } catch (caught) {
      setError(caught.message || "认证失败，请检查输入。");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef7f1] p-4 text-slate-900">
      <section className="mx-auto grid min-h-[calc(100vh-32px)] max-w-7xl overflow-hidden rounded-2xl border border-white/80 bg-[#fbfdfb] shadow-2xl shadow-emerald-900/10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="relative hidden bg-[#f2faf5] px-8 py-9 lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(15,143,102,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(15,143,102,0.055)_1px,transparent_1px)] bg-[size:44px_44px]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <Link to="/" className="inline-flex items-center gap-3">
                <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-lg shadow-emerald-900/20">
                  C
                  <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[#f2faf5] bg-[#f4d35e]" />
                </span>
                <span>
                  <span className="block text-base font-bold text-emerald-950">Chronofact</span>
                  <span className="block text-xs text-emerald-700/75">教学证据链系统</span>
                </span>
              </Link>
            </div>

            <div className="max-w-md">
              <p className="mb-3 inline-flex rounded-full border border-emerald-100 bg-white/75 px-3 py-1 text-xs font-semibold text-emerald-700">
                用户身份
              </p>
              <h1 className="text-3xl font-bold leading-tight text-emerald-950">
                让每一次提交都绑定到明确的课程身份
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                系统会将文件提交、版本记录和核验操作关联到当前账户，便于后续追踪责任、查看历史和进行人工复核。
              </p>
            </div>

            <div className="grid max-w-md -translate-y-6 gap-3">
              <FlowItem index="1" title="确认身份" text="明确文件由谁提交和复核" />
              <FlowItem index="2" title="提交文件" text="保存文件并生成版本记录" />
              <FlowItem index="3" title="核验证据" text="查看存证回执、版本链和审计记录" />
            </div>
          </div>
        </div>

        <div className="flex min-h-full flex-col justify-center px-6 py-8 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-7 flex rounded-xl border border-[#dfe8e2] bg-[#f6fbf8] p-1">
              <ModeButton active={!isRegister} onClick={() => switchMode("login")}>
                登录
              </ModeButton>
              <ModeButton active={isRegister} onClick={() => switchMode("register")}>
                注册
              </ModeButton>
            </div>

            <h2 className="text-3xl font-bold text-slate-950">{title}</h2>
            <p className="mt-3 text-lg leading-8 text-slate-500">{subtitle}</p>
            <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-base leading-7 text-emerald-800">
              {isRegister ? "账户创建后即可进入系统；课程和角色信息可由管理员后续分配。" : "请使用已注册的邮箱和密码登录。"}
            </p>

            <form className="mt-7 space-y-5" onSubmit={submit}>
              {isRegister && (
                <TextField
                  label="姓名"
                  name="displayName"
                  value={form.displayName}
                  onChange={updateField}
                  placeholder="例如 Student A"
                />
              )}

              <TextField
                label="邮箱"
                name="email"
                type="email"
                value={form.email}
                onChange={updateField}
                placeholder="student@example.edu"
              />

              {isRegister && (
                <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
                  密码建议不少于 8 位，并避免使用课程号、姓名或生日等容易被猜到的信息。
                </div>
              )}

              <TextField
                label="密码"
                name="password"
                type="password"
                value={form.password}
                onChange={updateField}
                placeholder="输入密码"
              />

              {isRegister && (
                <TextField
                  label="确认密码"
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={updateField}
                  placeholder="再次输入密码"
                />
              )}

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-base text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-lg font-semibold text-white shadow-md shadow-emerald-900/15 transition hover:bg-emerald-600 active:scale-[0.99] disabled:cursor-wait disabled:opacity-75"
              >
                {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {submitting ? "正在进入" : isRegister ? "创建账户并进入" : "登录并进入"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

function ModeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 flex-1 rounded-lg text-lg font-semibold transition ${
        active ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500 hover:text-emerald-700"
      }`}
    >
      {children}
    </button>
  );
}

function TextField({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-lg font-medium text-slate-700">{label}</span>
      <input
        className="mt-2 h-14 w-full rounded-lg border border-[#dfe8e2] bg-white px-4 text-lg text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-3 focus:ring-emerald-100"
        {...props}
      />
    </label>
  );
}

function FlowItem({ index, title, text }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#dfe8e2] bg-white/80 p-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-700">
        {index}
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{text}</span>
      </span>
    </div>
  );
}
