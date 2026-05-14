import { cn } from "../../lib/utils";

const variants = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700",
  ghost: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  sidebar: "text-left text-slate-600 hover:bg-emerald-50 hover:text-emerald-800",
};

export function Button({ className, variant = "primary", ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
