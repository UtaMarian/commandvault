import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import type { EntryDetail } from "@command-vault/shared";
import { RiskBadge, LanguageTag } from "./badges";
import { ParamDialog } from "./ParamDialog";
import { api } from "../lib/api";
import { copyText } from "../lib/params";
import { useToast } from "../lib/toast-context";
import { useEntrySearch } from "../hooks/queries";

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [paramEntry, setParamEntry] = useState<EntryDetail | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const notify = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 120);
    return () => clearTimeout(t);
  }, [q]);

  const { data } = useEntrySearch({ q: debounced, limit: 8 });
  const items = data?.items ?? [];

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActiveIndex(0); }, [items.length, debounced]);

  async function activate(id: string) {
    const entry = await api.entries.get(id);
    if (entry.params.length > 0) {
      setParamEntry(entry);
      return;
    }
    const ok = await copyText(entry.body);
    await api.entries.recordCopy(id).catch(() => {});
    notify(ok ? "success" : "error", ok ? `Copiat: ${entry.title}` : "Nu am putut copia");
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[activeIndex]) activate(items[activeIndex].id); }
    else if (e.key === "Tab") { e.preventDefault(); if (items[activeIndex]) { navigate(`/entries?open=${items[activeIndex].id}`); onClose(); } }
    else if (e.key === "Escape") onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[14vh] backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-popover">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search size={17} className="text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Caută o comandă sau un script…"
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          />
          <kbd className="rounded border border-line-strong px-1.5 py-0.5 text-[0.65rem] text-ink-3">Esc</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-1.5">
          {items.length === 0 && debounced && (
            <p className="px-4 py-6 text-center text-sm text-ink-3">Nimic găsit pentru „{debounced}”.</p>
          )}
          {items.map((entry, i) => (
            <button
              key={entry.id}
              onClick={() => activate(entry.id)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === activeIndex ? "bg-accent-soft" : "hover:bg-surface-2"}`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-ink">{entry.title}</div>
                <div className="truncate font-mono text-xs text-ink-3">{entry.bodyPreview}</div>
              </div>
              <RiskBadge risk={entry.risk} compact />
              <LanguageTag language={entry.language} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-xs text-ink-3">
          <span className="flex items-center gap-1"><ArrowUp size={11} /><ArrowDown size={11} /> navighează</span>
          <span className="flex items-center gap-1"><CornerDownLeft size={11} /> copiază</span>
          <span>Tab deschide detaliul</span>
        </div>
      </div>

      {paramEntry && (
        <ParamDialog
          title={paramEntry.title}
          body={paramEntry.body}
          params={paramEntry.params}
          onClose={() => setParamEntry(null)}
          onSubmit={async (text) => {
            const ok = await copyText(text);
            await api.entries.recordCopy(paramEntry.id).catch(() => {});
            notify(ok ? "success" : "error", ok ? `Copiat: ${paramEntry.title}` : "Nu am putut copia");
            setParamEntry(null);
            onClose();
          }}
        />
      )}
    </div>
  );
}
