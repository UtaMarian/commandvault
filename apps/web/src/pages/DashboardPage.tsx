import { Link } from "react-router-dom";
import { AlertTriangle, Clock3, ShieldAlert, FileWarning } from "lucide-react";
import { StatTile } from "../components/StatTile";
import { CategoryBars } from "../components/CategoryBars";
import { ActivitySparkline } from "../components/ActivitySparkline";
import { RiskBadge } from "../components/badges";
import { relativeTime } from "../lib/format";
import { useDashboard } from "../hooks/queries";

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-ink-3">Se încarcă sumarul…</div>;
  }

  const total = data.totalCommands + data.totalScripts;
  const incompleteTotal = data.incomplete.missingDescription + data.incomplete.missingTags;
  const reviewTotal = data.destructiveWithoutRollback.length + data.staleEntries.length;

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-ink">Sumar</h1>
      <p className="mt-0.5 text-sm text-ink-2">Ce ai în vault, ce lipsește și ce merită revizuit.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Comenzi + scripturi" value={total} sub={`${data.totalCommands} comenzi · ${data.totalScripts} scripturi`} to="/entries" />
        <StatTile label="Adăugate în 30 zile" value={data.addedLast30Days} to="/entries?sort=recent" />
        <StatTile label="Domenii · taguri" value={`${data.categoryCount} · ${data.tagCount}`} to="/entries" />
        <StatTile
          label="De completat"
          value={incompleteTotal}
          sub="fără descriere sau tag"
          to="/entries?missingDescription=true"
          tone={incompleteTotal > 0 ? "warn" : "default"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Distribuție pe domenii">
          <CategoryBars data={data.categoryBreakdown} />
        </Panel>

        <Panel title="Cele mai copiate">
          {data.topCopied.length === 0 ? (
            <p className="text-sm text-ink-3">Încă nimic copiat — statisticile apar după prima folosire.</p>
          ) : (
            <div className="flex flex-col">
              {data.topCopied.slice(0, 8).map((t, i) => {
                const max = data.topCopied[0].copyCount || 1;
                return (
                  <Link
                    key={t.entry.id}
                    to={`/entries?open=${t.entry.id}`}
                    className="group relative flex items-center gap-2.5 overflow-hidden rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
                  >
                    <span
                      className="absolute inset-y-0 left-0 bg-accent-soft transition-[width]"
                      style={{ width: `${Math.max(6, (t.copyCount / max) * 100)}%` }}
                    />
                    <span className="relative w-4 shrink-0 text-xs text-ink-3 font-variant-tabular">{i + 1}</span>
                    <span className="relative min-w-0 flex-1 truncate text-ink">{t.entry.title}</span>
                    <span className="relative shrink-0 text-xs font-medium text-ink-2 font-variant-tabular">{t.copyCount}×</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Activitate · ultimele 12 săptămâni">
          <ActivitySparkline data={data.weeklyActivity} />
        </Panel>

        <Panel
          title="De revizuit"
          action={reviewTotal > 0 ? <span className="text-xs text-ink-3">{reviewTotal}</span> : undefined}
        >
          {reviewTotal === 0 ? (
            <p className="text-sm text-ink-3">Nimic de revizuit acum — bine întreținut.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.destructiveWithoutRollback.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-danger">
                    <ShieldAlert size={13} /> Distructive fără rollback
                  </div>
                  <div className="flex flex-col">
                    {data.destructiveWithoutRollback.slice(0, 4).map((e) => (
                      <Link key={e.id} to={`/entries?open=${e.id}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-2">
                        <RiskBadge risk="destructive" compact />
                        <span className="min-w-0 flex-1 truncate text-ink">{e.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {data.staleEntries.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-signal">
                    <Clock3 size={13} /> Nefolosite de peste 180 de zile
                  </div>
                  <div className="flex flex-col">
                    {data.staleEntries.slice(0, 4).map((e) => (
                      <Link key={e.id} to={`/entries?open=${e.id}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-2">
                        <span className="min-w-0 flex-1 truncate text-ink">{e.title}</span>
                        <span className="shrink-0 text-xs text-ink-3">{relativeTime(e.lastUsedAt)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
