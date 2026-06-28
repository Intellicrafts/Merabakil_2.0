import { cn } from "@/lib/utils";

function tone(value: number): string {
  if (value >= 0.66) return "bg-emerald-500";
  if (value >= 0.33) return "bg-amber-500";
  return "bg-red-500";
}

export function ConfidenceMeter({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone(value))} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
