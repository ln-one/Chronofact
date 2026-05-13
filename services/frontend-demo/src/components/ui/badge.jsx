import { cn } from "../../lib/utils";

const statusClasses = {
  verified: "border-green-200 bg-green-100 text-green-800",
  failed: "border-red-200 bg-red-100 text-red-800",
  pending: "border-yellow-200 bg-yellow-100 text-yellow-800",
  unsupported: "border-gray-200 bg-gray-100 text-gray-800",
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
