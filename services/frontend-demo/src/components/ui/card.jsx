import { cn } from "../../lib/utils";

export function Card({ className, ...props }) {
  return (
    <section
      className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("space-y-1.5 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h2 className={cn("text-base font-semibold text-slate-900", className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn("text-sm leading-6 text-slate-500", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}
