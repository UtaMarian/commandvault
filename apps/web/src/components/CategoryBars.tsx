import { Link } from "react-router-dom";
import type { DashboardStats } from "@command-vault/shared";

/** Single-series magnitude bars — one accent hue, direct value labels, no legend needed
 * (dataviz skill: "a single series needs no legend box"). */
export function CategoryBars({ data }: { data: DashboardStats["categoryBreakdown"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => (
        <Link
          key={d.category.id}
          to={`/entries?categoryId=${d.category.id}`}
          className="group flex items-center gap-3 text-sm"
        >
          <span className="w-36 shrink-0 truncate text-ink-2 group-hover:text-ink">{d.category.name}</span>
          <span className="relative h-4 flex-1 rounded-full bg-surface-2">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-accent/70 transition-[width] group-hover:bg-accent"
              style={{ width: `${Math.max(4, (d.count / max) * 100)}%` }}
            />
          </span>
          <span className="w-6 shrink-0 text-right font-variant-tabular text-ink-2">{d.count}</span>
        </Link>
      ))}
      {data.length === 0 && <p className="text-sm text-ink-3">Nimic încă — adaugă prima intrare.</p>}
    </div>
  );
}
