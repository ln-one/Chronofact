import { useEffect, useState } from "react";
import { createWorkspace, listWorkspaces, updateWorkspaceStatus } from "../services/chronofactApi";
import { displayAssetType, displayDateTime, displayStatus } from "../lib/display";

const initialForm = {
  title: "",
  workspace_type: "experiment",
  description: "",
};

const workspaceTypes = [
  { value: "experiment", label: "实验空间" },
  { value: "course_project", label: "课程项目" },
  { value: "assignment", label: "作业提交" },
];

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const payload = await listWorkspaces();
      setWorkspaces(payload.workspaces || []);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const payload = await createWorkspace({
        title: form.title.trim(),
        workspace_type: form.workspace_type,
        description: form.description.trim(),
      });
      setMessage(`已创建项目空间：${payload.workspace.workspace_id}`);
      setForm(initialForm);
      await load();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function changeWorkspaceStatus(workspaceId, status) {
    setUpdatingId(workspaceId);
    setError("");
    setMessage("");
    try {
      const payload = await updateWorkspaceStatus(workspaceId, { status });
      setMessage(`已更新项目空间状态：${payload.workspace.title}（${displayStatus(payload.workspace.status)}）`);
      await load();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">项目空间</h1>
          <p className="mt-1 max-w-3xl text-base leading-7 text-slate-500">
            为实验、作业或课程项目创建独立空间，后续提交的文件会归入对应空间，便于按项目查看存证记录和报告。
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-[#dfe8e2] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          刷新
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">创建项目空间</h2>
          <form className="mt-5 space-y-5" onSubmit={submit}>
            <label className="block">
              <span className="text-base font-semibold text-slate-700">空间名称</span>
              <input
                name="title"
                value={form.title}
                onChange={updateField}
                placeholder="例如：实验六材料提交"
                className="mt-1.5 h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="block">
              <span className="text-base font-semibold text-slate-700">空间类型</span>
              <select
                name="workspace_type"
                value={form.workspace_type}
                onChange={updateField}
                className="mt-1.5 h-12 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {workspaceTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-base font-semibold text-slate-700">说明</span>
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                placeholder="填写提交范围、课程要求或审核说明"
                className="mt-1.5 min-h-28 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <button
              type="submit"
              disabled={submitting || !form.title.trim()}
              className="w-full rounded-lg border border-[#ead89b] bg-gradient-to-r from-[#f7e6a9] via-[#f1d88d] to-[#e8c66f] px-5 py-3 text-base font-semibold text-[#5a3908] shadow-sm shadow-amber-900/10 transition hover:from-[#faedbd] hover:via-[#f4df9c] hover:to-[#edcf7d] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-none disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
            >
              {submitting ? "正在创建..." : "创建项目空间"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#dfe8e2] bg-white shadow-sm">
          <div className="border-b border-[#dfe8e2] px-5 py-4">
            <h2 className="text-xl font-bold text-slate-900">已有项目空间</h2>
            <p className="mt-1 text-sm text-slate-500">文件提交页会同步显示这些空间。</p>
          </div>
          <div className="divide-y divide-[#e7eee9]">
            {workspaces.map((workspace) => (
              <div key={workspace.workspace_id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{workspace.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {workspace.workspace_id} · {displayAssetType(workspace.workspace_type)} · {displayDateTime(workspace.created_at)}
                    </p>
                    {workspace.description && (
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{workspace.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {displayStatus(workspace.status)}
                    </span>
                    <select
                      value={workspace.status}
                      disabled={updatingId === workspace.workspace_id}
                      onChange={(event) => changeWorkspaceStatus(workspace.workspace_id, event.target.value)}
                      className="h-8 rounded-lg border border-[#dfe8e2] bg-white px-2 text-xs font-semibold text-slate-600 outline-none disabled:cursor-wait disabled:bg-slate-100"
                    >
                      <option value="active">启用</option>
                      <option value="under_review">审核中</option>
                      <option value="archived">归档</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            {!loading && workspaces.length === 0 && (
              <div className="px-5 py-10 text-sm text-slate-400">暂无项目空间。创建后即可在文件提交页选择。</div>
            )}
            {loading && <div className="px-5 py-10 text-sm text-slate-400">正在读取项目空间...</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
