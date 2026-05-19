import { cn } from "../../lib/utils";

const statusClasses = {
  verified: "border-teal-200 bg-teal-100 text-teal-800",
  failed: "border-rose-200 bg-rose-100 text-rose-800",
  pending: "border-amber-200 bg-amber-100 text-amber-800",
  unsupported: "border-slate-200 bg-slate-100 text-slate-700",
};

export function Badge({ className, status, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        statusClasses[status] || "border-slate-200 bg-slate-100 text-slate-700",
        className,
      )}
      {...props}
    />
  );
}
