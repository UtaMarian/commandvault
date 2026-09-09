import { useState } from "react";
import type { DashboardStats } from "@command-vault/shared";
import { formatDate } from "../lib/format";

/** 12-week column sparkline — past weeks in the de-emphasis tone, the current week in the
 * accent (dataviz skill's stat-tile trend spec), with a per-column hover tooltip. */
export function ActivitySparkline({ data }: { data: DashboardStats["weeklyActivity"] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) {
    return <p className="text-sm text-ink-3">Nicio copiere sau descărcare în ultimele 12 săptămâni.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  const lastIndex = data.length - 1;

  return (
    <div className="relative">
      <div className="flex h-24 items-end gap-1">
        {data.map((d, i) => (
          <div
            key={d.weekStart}
            className="group relative flex-1"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          >
            <div
              className={
                "w-full rounded-t-[4px] transition-colors " +
                (i === lastIndex ? "bg-accent" : "bg-ink-3/35 group-hover:bg-accent/60")
              }
              style={{ height: `${Math.max(3, (d.count / max) * 96)}px` }}
            />
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-ink shadow-popover">
                <span className="font-variant-tabular font-medium">{d.count}</span> · {formatDate(d.weekStart)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.65rem] text-ink-3">
        <span>{formatDate(data[0].weekStart)}</span>
        <span>{formatDate(data[lastIndex].weekStart)}</span>
      </div>
    </div>
  );
}
