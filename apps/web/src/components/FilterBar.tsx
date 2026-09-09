import { useState } from "react";
import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import {
  LANGUAGES, LANGUAGE_LABELS, PLATFORMS, RISK_LEVELS, RISK_LABELS,
  type Category, type Tag,
} from "@command-vault/shared";
import type { EntryFilters } from "../lib/filters";
import { TagChip } from "./badges";

const PLATFORM_LABELS: Record<string, string> = {
  windows: "Windows", linux: "Linux", macos: "macOS", "active-directory": "Active Directory",
  m365: "M365", esxi: "ESXi", "hyper-v": "Hyper-V", network: "Rețea", "cisco-ios": "Cisco IOS", "mikrotik-ros": "MikroTik",
};

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-ink-2 hover:border-line-strong hover:bg-surface-2"
      )}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  filters,
  onChange,
  categories,
  tags,
  resultCount,
}: {
  filters: EntryFilters;
  onChange: (next: EntryFilters) => void;
  categories: (Category & { entryCount: number })[];
  tags: (Tag & { entryCount: number })[];
  resultCount: number | undefined;
}) {
  // Collapsed by default on mobile — the full filter set (4 selects + 7 toggles + every tag)
  // is a lot of scrolling before the first result on a phone. Desktop ignores this and always
  // shows everything, since there's room and a collapse there would just be an extra click.
  const [expanded, setExpanded] = useState(false);

  const activeCount = [
    filters.categoryId, filters.language, filters.risk, filters.kind,
    filters.requiresAdmin, filters.favoritesOnly, filters.neverUsed, filters.missingDescription, filters.stale,
    filters.tagIds?.length ? "t" : undefined,
  ].filter(Boolean).length;

  const set = <K extends keyof EntryFilters>(key: K, value: EntryFilters[K]) => onChange({ ...filters, [key]: value });
  const toggleTag = (id: string) => {
    const cur = filters.tagIds ?? [];
    set("tagIds", cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]);
  };

  return (
    <div className="flex flex-col gap-3 border-b border-line bg-surface px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            id="entry-search"
            value={filters.q ?? ""}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Caută comandă, tag, descriere…"
            className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filters.sort ?? "relevance"}
            onChange={(e) => set("sort", e.target.value as EntryFilters["sort"])}
            className="flex-1 rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-sm text-ink-2 sm:flex-none"
            aria-label="Sortare"
          >
            <option value="relevance">Relevanță</option>
            <option value="recent">Recent modificate</option>
            <option value="popular">Cele mai copiate</option>
            <option value="title">Titlu (A-Z)</option>
          </select>
          {activeCount > 0 && (
            <button
              onClick={() => onChange({ q: filters.q, sort: filters.sort })}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-line-strong px-2.5 py-2 text-xs text-ink-2 hover:bg-surface-2"
            >
              <X size={13} /> <span className="hidden sm:inline">Șterge filtre</span> ({activeCount})
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-line-strong px-2.5 py-2 text-xs text-ink-2 hover:bg-surface-2 md:hidden"
          >
            <SlidersHorizontal size={13} /> Filtre {activeCount > 0 && `(${activeCount})`}
            <ChevronDown size={13} className={clsx("transition-transform", expanded && "rotate-180")} />
          </button>
          {resultCount !== undefined && (
            <span className="shrink-0 text-xs text-ink-3 font-variant-tabular md:hidden">
              {resultCount} {resultCount === 1 ? "rezultat" : "rezultate"}
            </span>
          )}
        </div>
      </div>

      <div className={clsx("flex-col gap-3", expanded ? "flex" : "hidden md:flex")}>
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal size={14} className="hidden text-ink-3 md:block" />
        <select
          value={filters.categoryId ?? ""}
          onChange={(e) => set("categoryId", e.target.value || undefined)}
          className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-ink-2"
        >
          <option value="">Toate domeniile</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentId ? "— " : ""}{c.name} ({c.entryCount})
            </option>
          ))}
        </select>

        <select
          value={filters.language?.[0] ?? ""}
          onChange={(e) => set("language", e.target.value ? [e.target.value as any] : undefined)}
          className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-ink-2"
        >
          <option value="">Orice shell</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
          ))}
        </select>

        <select
          value={filters.platform?.[0] ?? ""}
          onChange={(e) => set("platform", e.target.value ? [e.target.value as any] : undefined)}
          className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-ink-2"
        >
          <option value="">Orice platformă</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>
          ))}
        </select>

        <select
          value={filters.risk?.[0] ?? ""}
          onChange={(e) => set("risk", e.target.value ? [e.target.value as any] : undefined)}
          className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-ink-2"
        >
          <option value="">Orice risc</option>
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r}>{RISK_LABELS[r]}</option>
          ))}
        </select>

        <span className="mx-0.5 h-4 w-px bg-line" />

        <Toggle active={filters.kind === "command"} onClick={() => set("kind", filters.kind === "command" ? undefined : "command")}>Comenzi</Toggle>
        <Toggle active={filters.kind === "script"} onClick={() => set("kind", filters.kind === "script" ? undefined : "script")}>Scripturi</Toggle>
        <Toggle active={!!filters.favoritesOnly} onClick={() => set("favoritesOnly", !filters.favoritesOnly || undefined)}>★ Favorite</Toggle>
        <Toggle active={!!filters.requiresAdmin} onClick={() => set("requiresAdmin", !filters.requiresAdmin || undefined)}>Necesită admin</Toggle>
        <Toggle active={!!filters.neverUsed} onClick={() => set("neverUsed", !filters.neverUsed || undefined)}>Niciodată folosite</Toggle>
        <Toggle active={!!filters.missingDescription} onClick={() => set("missingDescription", !filters.missingDescription || undefined)}>Fără descriere</Toggle>
        <Toggle active={!!filters.stale} onClick={() => set("stale", !filters.stale || undefined)}>De revizuit</Toggle>

        {resultCount !== undefined && (
          <span className="ml-auto hidden text-xs text-ink-3 font-variant-tabular md:inline">{resultCount} {resultCount === 1 ? "rezultat" : "rezultate"}</span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <TagChip key={t.id} name={t.name} active={filters.tagIds?.includes(t.id)} onClick={() => toggleTag(t.id)} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
