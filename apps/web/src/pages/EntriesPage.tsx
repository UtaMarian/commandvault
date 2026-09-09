import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PackageOpen } from "lucide-react";
import { FilterBar } from "../components/FilterBar";
import { EntryRow } from "../components/EntryRow";
import { EntryDetail } from "../components/EntryDetail";
import { ParamDialog } from "../components/ParamDialog";
import { api } from "../lib/api";
import { copyText } from "../lib/params";
import { useToast } from "../lib/toast-context";
import { filtersFromSearchParams, filtersToSearchParams, type EntryFilters } from "../lib/filters";
import { useCategories, useEntry, useEntrySearch, useTags, useToggleFavorite } from "../hooks/queries";

export { type EntryFilters } from "../lib/filters";

export function EntriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<EntryFilters>(() => filtersFromSearchParams(searchParams));
  const openId = searchParams.get("open") ?? undefined;
  const notify = useToast();

  useEffect(() => {
    const next = filtersToSearchParams(filters);
    if (openId) next.set("open", openId);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { data: results, isFetching } = useEntrySearch({ ...filters, limit: 60 });
  const { data: openEntry } = useEntry(openId);
  const toggleFavorite = useToggleFavorite();
  const [quickCopyEntry, setQuickCopyEntry] = useState<string | null>(null);

  function openDetail(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set("open", id);
    setSearchParams(next);
  }
  function closeDetail() {
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next);
  }

  async function handleQuickCopy(id: string) {
    const entry = results?.items.find((e) => e.id === id);
    if (!entry) return;
    if (entry.paramCount > 0) {
      setQuickCopyEntry(id);
      return;
    }
    const detail = await api.entries.get(id);
    const ok = await copyText(detail.body);
    await api.entries.recordCopy(id).catch(() => {});
    notify(ok ? "success" : "error", ok ? "Copiat în clipboard" : "Nu am putut copia");
  }

  const quickEntry = useEntry(quickCopyEntry ?? undefined).data;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          categories={categories ?? []}
          tags={tags ?? []}
          resultCount={results?.total}
        />
        <div className="flex-1 overflow-y-auto">
          {results?.items.length === 0 && !isFetching && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <PackageOpen size={32} className="text-ink-3" />
              <p className="text-sm text-ink-2">Nimic pe filtrele astea.</p>
              <p className="text-xs text-ink-3">Încearcă alți termeni sau scoate un filtru din bara de mai sus.</p>
            </div>
          )}
          {results?.items.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              selected={entry.id === openId}
              onOpen={() => openDetail(entry.id)}
              onCopy={() => handleQuickCopy(entry.id)}
              onToggleFavorite={() => toggleFavorite.mutate(entry.id)}
              onTagClick={(tagId) => setFilters((f) => ({ ...f, tagIds: f.tagIds?.includes(tagId) ? f.tagIds : [...(f.tagIds ?? []), tagId] }))}
            />
          ))}
        </div>
      </div>

      {openEntry && (
        <div className="w-[26rem] shrink-0 border-l border-line">
          <EntryDetail entry={openEntry} onClose={closeDetail} onDeleted={closeDetail} />
        </div>
      )}

      {quickCopyEntry && quickEntry && (
        <ParamDialog
          title={quickEntry.title}
          body={quickEntry.body}
          params={quickEntry.params}
          onClose={() => setQuickCopyEntry(null)}
          onSubmit={async (text) => {
            const ok = await copyText(text);
            await api.entries.recordCopy(quickCopyEntry).catch(() => {});
            notify(ok ? "success" : "error", ok ? "Copiat în clipboard" : "Nu am putut copia");
            setQuickCopyEntry(null);
          }}
        />
      )}
    </div>
  );
}
