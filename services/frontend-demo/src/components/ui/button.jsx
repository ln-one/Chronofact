import { cn } from "../../lib/utils";

const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  ghost: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  sidebar: "text-left text-slate-300 hover:bg-slate-800 hover:text-white",
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
