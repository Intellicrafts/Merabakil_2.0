import { cn } from "@/lib/utils";

function tone(value: number): string {
  if (value >= 0.66) return "bg-emerald-500/90";
  if (value >= 0.33) return "bg-amber-500/85";
  return "bg-rose-500/85";
}

export function ConfidenceMeter({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums font-semibold text-foreground/80">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", tone(value))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
