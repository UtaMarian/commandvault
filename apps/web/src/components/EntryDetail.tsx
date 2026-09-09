import { useState } from "react";
import {
  Star, Copy, Download, Pencil, Trash2, ExternalLink, History, AlertTriangle,
  Terminal as TerminalIcon, FileCode2, RotateCcw, X,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { EntryDetail as EntryDetailT } from "@command-vault/shared";
import { RiskBadge, LanguageTag, TagChip, AdminBadge } from "./badges";
import { CodeView } from "./CodeView";
import { ParamDialog } from "./ParamDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { api } from "../lib/api";
import { copyText } from "../lib/params";
import { useToast } from "../lib/toast-context";
import { formatDateTime, relativeTime } from "../lib/format";
import { useDeleteEntry, useEntryVersions, useRestoreVersion, useToggleFavorite } from "../hooks/queries";

export function EntryDetail({ entry, onClose, onDeleted }: { entry: EntryDetailT; onClose: () => void; onDeleted: () => void }) {
  const [showParamDialog, setShowParamDialog] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const notify = useToast();
  const toggleFavorite = useToggleFavorite();
  const deleteEntry = useDeleteEntry();

  const KindIcon = entry.kind === "script" ? FileCode2 : TerminalIcon;

  async function doCopy(text: string) {
    const ok = await copyText(text);
    await api.entries.recordCopy(entry.id).catch(() => {});
    notify(ok ? "success" : "error", ok ? "Copiat în clipboard" : "Nu am putut copia — selectează manual textul");
  }

  function handleCopyClick() {
    if (entry.params.length > 0) {
      setShowParamDialog(true);
    } else {
      doCopy(entry.body);
    }
  }

  async function handleDelete() {
    await deleteEntry.mutateAsync(entry.id);
    setShowDelete(false);
    notify("success", "Intrarea a fost arhivată");
    onDeleted();
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-ink-3">
            <KindIcon size={14} />
            <span className="text-xs uppercase tracking-wide">{entry.kind === "script" ? "Script" : "Comandă"}</span>
            {entry.category && <span className="text-xs">· {entry.category.name}</span>}
          </div>
          <h2 className="mt-0.5 text-lg font-semibold text-ink text-balance">{entry.title}</h2>
        </div>
        <button onClick={onClose} className="shrink-0 rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Închide detaliul">
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <RiskBadge risk={entry.risk} />
        <LanguageTag language={entry.language} />
        {entry.requiresAdmin && <AdminBadge />}
        {entry.kind === "script" && (
          <span className="text-xs text-ink-3">v{entry.currentVersion}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
        <button onClick={handleCopyClick} className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90">
          <Copy size={14} /> Copiază
        </button>
        {entry.kind === "script" && (
          <a
            href={api.entries.downloadUrl(entry.id)}
            download
            className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-2"
          >
            <Download size={14} /> Descarcă
          </a>
        )}
        <button
          onClick={() => toggleFavorite.mutate(entry.id)}
          className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-2"
        >
          <Star size={14} fill={entry.isFavorite ? "currentColor" : "none"} className={entry.isFavorite ? "text-signal" : ""} />
          {entry.isFavorite ? "Favorit" : "Adaugă la favorite"}
        </button>
        <Link to={`/entries/${entry.id}/edit`} className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-2">
          <Pencil size={14} /> Editează
        </Link>
        {entry.kind === "script" && (
          <button onClick={() => setShowVersions((v) => !v)} className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-2">
            <History size={14} /> Istoric
          </button>
        )}
        <button onClick={() => setShowDelete(true)} className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-danger hover:bg-danger-soft">
          <Trash2 size={14} /> Arhivează
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {entry.risk === "destructive" && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger-soft px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-danger">
              <AlertTriangle size={15} /> Comandă distructivă — cum dai înapoi
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink leading-relaxed">
              {entry.rollback || "Nu a fost completat un pas de rollback."}
            </p>
          </div>
        )}

        <CodeView value={entry.body} language={entry.language} />

        {entry.params.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Parametri</h3>
            <div className="flex flex-col gap-1.5">
              {entry.params.map((p) => (
                <div key={p.name} className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm">
                  <code className="text-accent">{`{{${p.name}}}`}</code>
                  <span className="text-ink-2">{p.label}</span>
                  {p.example && <span className="ml-auto text-xs text-ink-3">ex: {p.example}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {entry.description && (
          <div className="mt-4">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Descriere</h3>
            <p className="whitespace-pre-wrap text-sm text-ink leading-relaxed">{entry.description}</p>
          </div>
        )}

        {entry.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {entry.tags.map((t) => <TagChip key={t.id} name={t.name} />)}
          </div>
        )}

        {entry.sourceUrl && (
          <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-1.5 text-sm text-accent hover:underline">
            <ExternalLink size={14} /> Sursă
          </a>
        )}

        {showVersions && <VersionHistory entryId={entry.id} currentVersion={entry.currentVersion} language={entry.language} />}

        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line pt-4 text-xs text-ink-3">
          <span>Copiat de {entry.copyCount} ori</span>
          <span>Folosit {relativeTime(entry.lastUsedAt)}</span>
          <span>Creat {formatDateTime(entry.createdAt)}</span>
          <span>Actualizat {formatDateTime(entry.updatedAt)}</span>
        </div>
      </div>

      {showParamDialog && (
        <ParamDialog
          title={entry.title}
          body={entry.body}
          params={entry.params}
          onClose={() => setShowParamDialog(false)}
          onSubmit={(text) => { doCopy(text); setShowParamDialog(false); }}
        />
      )}

      {showDelete && (
        <ConfirmDialog
          title="Arhivează intrarea"
          message={`"${entry.title}" va fi scoasă din listă, dar rămâne în baza de date și poate fi recuperată din baza de date direct dacă e nevoie.`}
          confirmLabel="Arhivează"
          tone="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}

function VersionHistory({ entryId, currentVersion, language }: { entryId: string; currentVersion: number; language: EntryDetailT["language"] }) {
  const { data: versions, isLoading } = useEntryVersions(entryId);
  const restore = useRestoreVersion();
  const notify = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Istoric versiuni</h3>
      {isLoading && <p className="text-sm text-ink-3">Se încarcă…</p>}
      <div className="flex flex-col gap-1.5">
        {versions?.map((v) => (
          <div key={v.id} className="rounded-md border border-line">
            <button
              onClick={() => setExpanded(expanded === v.version ? null : v.version)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
            >
              <span className="font-mono font-medium text-ink">v{v.version}</span>
              {v.version === currentVersion && <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[0.65rem] text-accent">curentă</span>}
              <span className="text-xs text-ink-3">{formatDateTime(v.createdAt)}</span>
              {v.note && <span className="truncate text-xs text-ink-3">— {v.note}</span>}
              {v.version !== currentVersion && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await restore.mutateAsync({ id: entryId, version: v.version });
                    notify("success", `Restaurat la v${v.version} (creează v${currentVersion + 1})`);
                  }}
                  className="ml-auto flex items-center gap-1 rounded border border-line-strong px-2 py-0.5 text-xs text-ink-2 hover:bg-surface"
                >
                  <RotateCcw size={11} /> Restaurează
                </button>
              )}
            </button>
            {expanded === v.version && (
              <div className="border-t border-line p-2">
                <CodeView value={v.body} language={language} maxHeight="16rem" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
