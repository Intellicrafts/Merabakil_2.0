import type { CaseTimelineEvent } from "@/lib/types";

function formatAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface CaseTimelineProps {
  events: CaseTimelineEvent[];
}

export function CaseTimeline({ events }: CaseTimelineProps) {
  const ordered = [...events].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  if (ordered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No timeline events yet.</p>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-black/[0.08] pl-6 dark:border-white/10">
      {ordered.map((event, idx) => (
        <li key={event.id} className="relative pb-6 last:pb-0">
          <span
            className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[hsl(220_14%_8%)] ${
              idx === ordered.length - 1
                ? "bg-slate-800 dark:bg-slate-200"
                : "bg-slate-400 dark:bg-slate-500"
            }`}
          />
          <p className="text-sm font-semibold tracking-tight">{event.label}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{event.description}</p>
          <p className="mt-1 text-[11px] text-muted-foreground/80">{formatAt(event.at)}</p>
        </li>
      ))}
    </ol>
  );
}
