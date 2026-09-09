import { useState } from "react";
import { Merge, Pencil, Trash2, Check, X } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../lib/toast-context";
import { useCategories, useTags } from "../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { iconForCategory } from "../lib/category-icons";

export function TagsAdminPage() {
  const { data: tags } = useTags();
  const { data: categories } = useCategories();
  const qc = useQueryClient();
  const notify = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tags"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["entries"] });
  };

  async function saveRename(id: string) {
    if (!editName.trim()) return;
    await api.tags.update(id, { name: editName.trim() });
    setEditingId(null);
    refresh();
    notify("success", "Tag redenumit");
  }

  async function handleMerge() {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) return;
    const fromName = tags?.find((t) => t.id === mergeFrom)?.name;
    const toName = tags?.find((t) => t.id === mergeTo)?.name;
    await api.tags.merge(mergeFrom, mergeTo);
    setMergeFrom(""); setMergeTo("");
    refresh();
    notify("success", `„${fromName}” a fost combinat în „${toName}”`);
  }

  async function handleDelete(id: string) {
    await api.tags.remove(id);
    refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-xl font-semibold text-ink">Organizare</h1>
      <p className="mt-0.5 text-sm text-ink-2">Domeniile și tagurile țin căutarea utilă — evită dubluri ca „rețea” / „retea” / „network”.</p>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink">Domenii</h2>
        <div className="rounded-lg border border-line bg-surface">
          {categories?.filter((c) => !c.parentId).map((root) => (
            <div key={root.id}>
              <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm">
                {(() => { const Icon = iconForCategory(root.icon); return <Icon size={14} className="text-ink-3" />; })()}
                <span className="font-medium text-ink">{root.name}</span>
                <span className="ml-auto text-xs text-ink-3 font-variant-tabular">{root.entryCount}</span>
              </div>
              {categories.filter((c) => c.parentId === root.id).map((child) => (
                <div key={child.id} className="flex items-center gap-2 border-b border-line px-3 py-1.5 pl-8 text-sm">
                  <span className="text-ink-2">{child.name}</span>
                  <span className="ml-auto text-xs text-ink-3 font-variant-tabular">{child.entryCount}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-3">Un domeniu nou se creează direct din formularul de adăugare a unei intrări.</p>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink">Taguri ({tags?.length ?? 0})</h2>
        <div className="rounded-lg border border-line bg-surface">
          {tags?.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm last:border-b-0">
              {editingId === tag.id ? (
                <>
                  <input
                    value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveRename(tag.id); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 rounded border border-line-strong bg-surface px-2 py-1 text-sm"
                  />
                  <button onClick={() => saveRename(tag.id)} className="text-ok"><Check size={15} /></button>
                  <button onClick={() => setEditingId(null)} className="text-ink-3"><X size={15} /></button>
                </>
              ) : (
                <>
                  <span className="text-ink">#{tag.name}</span>
                  <span className="text-xs text-ink-3 font-variant-tabular">{tag.entryCount}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => { setEditingId(tag.id); setEditName(tag.name); }} className="text-ink-3 hover:text-ink" aria-label="Redenumește">
                      <Pencil size={13} />
                    </button>
                    {tag.entryCount === 0 && (
                      <button onClick={() => handleDelete(tag.id)} className="text-ink-3 hover:text-danger" aria-label="Șterge">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink"><Merge size={14} /> Combină două taguri</h2>
        <p className="mb-2 text-xs text-ink-2">Toate intrările primului tag trec pe al doilea, apoi primul e șters.</p>
        <div className="flex items-center gap-2">
          <select value={mergeFrom} onChange={(e) => setMergeFrom(e.target.value)} className="flex-1 rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-sm">
            <option value="">Tag de combinat</option>
            {tags?.map((t) => <option key={t.id} value={t.id}>#{t.name}</option>)}
          </select>
          <span className="text-ink-3">→</span>
          <select value={mergeTo} onChange={(e) => setMergeTo(e.target.value)} className="flex-1 rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-sm">
            <option value="">Tag rezultat</option>
            {tags?.map((t) => <option key={t.id} value={t.id}>#{t.name}</option>)}
          </select>
          <button
            onClick={handleMerge}
            disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            Combină
          </button>
        </div>
      </section>
    </div>
  );
}
