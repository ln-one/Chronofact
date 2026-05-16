import { cn } from "../../lib/utils";

export function Select({ className, ...props }) {
  return (
    <select
      className={cn(
        "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100",
        className,
      )}
      {...props}
    />
  );
}
