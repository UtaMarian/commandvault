import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Link } from "react-router-dom";

export function StatTile({
  label, value, sub, to, tone = "default",
}: {
  label: string; value: ReactNode; sub?: string; to?: string; tone?: "default" | "warn";
}) {
  const content = (
    <div
      className={clsx(
        "flex flex-col gap-1 rounded-lg border px-4 py-3.5 transition-colors",
        tone === "warn" ? "border-signal/40 bg-signal-soft" : "border-line bg-surface",
        to && "hover:border-accent/50"
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</span>
      <span className={clsx("text-2xl font-semibold font-variant-tabular", tone === "warn" ? "text-signal" : "text-ink")}>{value}</span>
      {sub && <span className="text-xs text-ink-3">{sub}</span>}
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}
