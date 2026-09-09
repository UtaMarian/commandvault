import { Star, Copy, FileCode2, Terminal as TerminalIcon } from "lucide-react";
import { clsx } from "clsx";
import type { EntrySummary } from "@command-vault/shared";
import { RiskBadge, LanguageTag, TagChip, AdminBadge } from "./badges";
import { relativeTime } from "../lib/format";

export function EntryRow({
  entry,
  selected,
  onOpen,
  onCopy,
  onToggleFavorite,
  onTagClick,
}: {
  entry: EntrySummary;
  selected: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onToggleFavorite: () => void;
  onTagClick?: (tagId: string) => void;
}) {
  const KindIcon = entry.kind === "script" ? FileCode2 : TerminalIcon;

  return (
    <div
      className={clsx(
        "group flex cursor-pointer gap-3 border-b border-line px-4 py-3 transition-colors",
        selected ? "bg-accent-soft" : "hover:bg-surface-2"
      )}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
    >
      <KindIcon size={16} className={clsx("mt-0.5 shrink-0", selected ? "text-accent" : "text-ink-3")} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink text-[0.925rem]">{entry.title}</span>
          {!entry.hasDescription && (
            <span className="shrink-0 rounded-full bg-signal-soft px-1.5 py-0.5 text-[0.65rem] font-medium text-signal">
              fără descriere
            </span>
          )}
        </div>
        <div className="mt-1 truncate font-mono text-xs text-ink-3">{entry.bodyPreview}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <RiskBadge risk={entry.risk} compact />
          <LanguageTag language={entry.language} />
          {entry.requiresAdmin && <AdminBadge />}
          {entry.category && (
            <span className="text-xs text-ink-3">{entry.category.name}</span>
          )}
          {entry.tags.slice(0, 3).map((t) => (
            <TagChip key={t.id} name={t.name} onClick={onTagClick ? () => onTagClick(t.id) : undefined} />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className={clsx("rounded p-1 hover:bg-surface-2", entry.isFavorite ? "text-signal" : "text-ink-3 opacity-0 group-hover:opacity-100")}
            aria-label={entry.isFavorite ? "Scoate din favorite" : "Adaugă la favorite"}
          >
            <Star size={15} fill={entry.isFavorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className="rounded p-1 text-ink-3 opacity-0 hover:bg-surface-2 hover:text-accent group-hover:opacity-100"
            aria-label="Copiază"
          >
            <Copy size={15} />
          </button>
        </div>
        <span className="text-[0.7rem] text-ink-3 font-variant-tabular">{relativeTime(entry.lastUsedAt)}</span>
      </div>
    </div>
  );
}
