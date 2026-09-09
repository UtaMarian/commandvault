import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Plus, X, ArrowLeft, ShieldAlert, Wand2 } from "lucide-react";
import { clsx } from "clsx";
import {
  ENTRY_KINDS, LANGUAGES, LANGUAGE_LABELS, PLATFORMS, RISK_LEVELS, RISK_LABELS,
  detectLanguage, suggestRiskLevel,
  type EntryKind, type Language, type Platform, type RiskLevel, type ParamInput,
} from "@command-vault/shared";
import { CodeView } from "../components/CodeView";
import { TagChip } from "../components/badges";
import { api } from "../lib/api";
import { useToast } from "../lib/toast-context";
import { useCategories, useCreateEntry, useEntry, useTags, useUpdateEntry } from "../hooks/queries";

const PLATFORM_LABELS: Record<string, string> = {
  windows: "Windows", linux: "Linux", macos: "macOS", "active-directory": "Active Directory",
  m365: "M365", esxi: "ESXi", "hyper-v": "Hyper-V", network: "Rețea", "cisco-ios": "Cisco IOS", "mikrotik-ros": "MikroTik",
};

interface FormState {
  kind: EntryKind;
  title: string;
  body: string;
  language: Language;
  platform: Platform[];
  description: string;
  rollback: string;
  risk: RiskLevel;
  requiresAdmin: boolean;
  params: ParamInput[];
  categoryId: string | null;
  sourceUrl: string;
  tagIds: string[];
  isFavorite: boolean;
}

const EMPTY: FormState = {
  kind: "command", title: "", body: "", language: "text", platform: [],
  description: "", rollback: "", risk: "safe", requiresAdmin: false, params: [],
  categoryId: null, sourceUrl: "", tagIds: [], isFavorite: false,
};

export function EntryFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const notify = useToast();
  const { data: existing } = useEntry(id);
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [touchedLanguage, setTouchedLanguage] = useState(false);
  const [touchedRisk, setTouchedRisk] = useState(false);
  const [secretMatches, setSecretMatches] = useState<{ id: string; label: string; snippet: string }[]>([]);
  const [secretsAcknowledged, setSecretsAcknowledged] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        kind: existing.kind, title: existing.title, body: existing.body, language: existing.language,
        platform: existing.platform, description: existing.description, rollback: existing.rollback,
        risk: existing.risk, requiresAdmin: existing.requiresAdmin, params: existing.params,
        categoryId: existing.category?.id ?? null, sourceUrl: existing.sourceUrl ?? "",
        tagIds: existing.tags.map((t) => t.id), isFavorite: existing.isFavorite,
      });
      setTouchedLanguage(true);
      setTouchedRisk(true);
    }
  }, [existing]);

  // Live suggestions from pasted text — only while the user hasn't overridden them, and never
  // once they've started editing an existing entry (its own values already win).
  useEffect(() => {
    if (isEdit || !form.body.trim()) return;
    if (!touchedLanguage) setForm((f) => ({ ...f, language: detectLanguage(f.body) }));
    if (!touchedRisk) setForm((f) => ({ ...f, risk: suggestRiskLevel(f.body) }));
  }, [form.body, touchedLanguage, touchedRisk, isEdit]);

  // Debounced secret scan against the server's canonical rule set.
  useEffect(() => {
    if (!form.body.trim()) { setSecretMatches([]); return; }
    const t = setTimeout(() => {
      api.entries.scanSecrets(form.body).then((r) => {
        setSecretMatches(r.matches);
        if (r.clean) setSecretsAcknowledged(false);
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [form.body]);

  const usedParamNames = useMemo(
    () => new Set(Array.from(form.body.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)).map((m) => m[1])),
    [form.body]
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function togglePlatform(p: Platform) {
    set("platform", form.platform.includes(p) ? form.platform.filter((x) => x !== p) : [...form.platform, p]);
  }

  function toggleTag(id: string) {
    set("tagIds", form.tagIds.includes(id) ? form.tagIds.filter((x) => x !== id) : [...form.tagIds, id]);
  }

  async function addNewTag() {
    const name = newTagName.trim();
    if (!name) return;
    const tag = await api.tags.create(name);
    setNewTagName("");
    set("tagIds", [...form.tagIds, tag.id]);
  }

  async function addNewCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const cat = await api.categories.create({ name, parentId: null, sortOrder: 0 });
    setNewCategoryName("");
    setShowNewCategory(false);
    set("categoryId", cat.id);
  }

  function addParam() {
    set("params", [...form.params, { name: "", label: "", required: true }]);
  }
  function updateParam(i: number, patch: Partial<ParamInput>) {
    set("params", form.params.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function removeParam(i: number) {
    set("params", form.params.filter((_, idx) => idx !== i));
  }

  const titleValid = form.title.trim().length > 0;
  const bodyValid = form.body.trim().length > 0;
  const rollbackValid = form.risk !== "destructive" || form.rollback.trim().length > 0;
  const paramsValid = form.params.every((p) => p.name && p.label && usedParamNames.has(p.name));
  const canSubmit = titleValid && bodyValid && rollbackValid && paramsValid && (secretMatches.length === 0 || secretsAcknowledged);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = { ...form, sourceUrl: form.sourceUrl || undefined, secretsAcknowledged };
      if (isEdit) {
        const saved = await updateEntry.mutateAsync({ id: id!, data: payload });
        notify("success", "Intrarea a fost actualizată");
        navigate(`/entries?open=${saved.id}`);
      } else {
        const saved = await createEntry.mutateAsync(payload);
        notify("success", "Intrarea a fost salvată");
        navigate(`/entries?open=${saved.id}`);
      }
    } catch (err: any) {
      if (err?.payload?.secretMatches) {
        setSecretMatches(err.payload.secretMatches);
        notify("error", "Am găsit ceva ce arată a secret — confirmă mai jos sau înlocuiește cu un parametru");
      } else {
        notify("error", err?.message ?? "Nu am putut salva intrarea");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-6 sm:px-6">
      <Link to="/entries" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> Înapoi la listă
      </Link>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-ink sm:text-xl">{isEdit ? "Editează intrarea" : "Adaugă o intrare"}</h1>
          <div className="ml-auto flex rounded-md border border-line-strong p-0.5">
            {ENTRY_KINDS.map((k) => (
              <button
                key={k} type="button" onClick={() => set("kind", k)}
                className={clsx("rounded px-3 py-1 text-sm", form.kind === k ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2")}
              >
                {k === "command" ? "Comandă" : "Script"}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-2">Titlu *</span>
          <input
            value={form.title} onChange={(e) => set("title", e.target.value)} required
            placeholder="ex: Golește cache-ul DNS local"
            className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-2">{form.kind === "script" ? "Conținutul scriptului *" : "Comanda *"}</span>
          <CodeView value={form.body} language={form.language} editable onChange={(v) => set("body", v)} minHeight="8rem" maxHeight="24rem" />
          <span className="text-xs text-ink-3">Folosește <code>{"{{nume}}"}</code> pentru orice ar trebui completat la copiere (server, cale, cont…).</span>
        </label>

        {secretMatches.length > 0 && (
          <div className="rounded-lg border border-danger/40 bg-danger-soft px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-danger">
              <ShieldAlert size={15} /> Am găsit ceva ce arată a secret
            </div>
            <ul className="mt-1.5 flex flex-col gap-0.5 text-sm text-ink">
              {secretMatches.map((m) => (
                <li key={m.id + m.snippet}>
                  <span className="text-ink-2">{m.label}:</span> <code className="text-danger">{m.snippet}</code>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-2">Cea mai sigură rezolvare e să înlocuiești valoarea cu un parametru <code>{"{{...}}"}</code>. Dacă e sigur un exemplu (nu o valoare reală), confirmă mai jos.</p>
            <label className="mt-2 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={secretsAcknowledged} onChange={(e) => setSecretsAcknowledged(e.target.checked)} />
              E un exemplu / placeholder, nu un secret real — salvează oricum
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-2 flex items-center gap-1">
              Limbaj / shell
              {!touchedLanguage && !isEdit && <Wand2 size={11} className="text-accent" aria-label="detectat automat" />}
            </span>
            <select
              value={form.language}
              onChange={(e) => { set("language", e.target.value as Language); setTouchedLanguage(true); }}
              className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
            >
              {LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-2 flex items-center gap-1">
              Nivel de risc
              {!touchedRisk && !isEdit && <Wand2 size={11} className="text-accent" aria-label="sugerat automat" />}
            </span>
            <select
              value={form.risk}
              onChange={(e) => { set("risk", e.target.value as RiskLevel); setTouchedRisk(true); }}
              className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
            >
              {RISK_LEVELS.map((r) => <option key={r} value={r}>{RISK_LABELS[r]}</option>)}
            </select>
          </label>
        </div>

        {form.risk === "destructive" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-2">Cum dai înapoi (rollback) *</span>
            <textarea
              value={form.rollback} onChange={(e) => set("rollback", e.target.value)} rows={3} required
              placeholder="Ce faci dacă lucrurile merg prost — comandă de revert, backup de restaurat, pas manual…"
              className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent"
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-2">Descriere / explicație</span>
          <textarea
            value={form.description} onChange={(e) => set("description", e.target.value)} rows={4}
            placeholder="Ce face, când o folosești, ce trebuie să știi înainte s-o rulezi…"
            className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent"
          />
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-2">Parametri</span>
            <button type="button" onClick={addParam} className="flex items-center gap-1 text-xs text-accent hover:underline">
              <Plus size={13} /> Adaugă parametru
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {form.params.map((p, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5">
                <input
                  value={p.name} onChange={(e) => updateParam(i, { name: e.target.value.replace(/\s/g, "_") })}
                  placeholder="nume_param" className={clsx("w-32 rounded border bg-surface px-2 py-1 font-mono text-xs", usedParamNames.has(p.name) ? "border-line-strong" : "border-signal")}
                />
                <input
                  value={p.label} onChange={(e) => updateParam(i, { label: e.target.value })}
                  placeholder="Etichetă" className="flex-1 rounded border border-line-strong bg-surface px-2 py-1 text-xs"
                />
                <input
                  value={p.example ?? ""} onChange={(e) => updateParam(i, { example: e.target.value })}
                  placeholder="Exemplu" className="flex-1 rounded border border-line-strong bg-surface px-2 py-1 text-xs"
                />
                <button type="button" onClick={() => removeParam(i)} className="text-ink-3 hover:text-danger"><X size={14} /></button>
              </div>
            ))}
            {form.params.some((p) => !usedParamNames.has(p.name)) && (
              <p className="text-xs text-signal">Fiecare parametru trebuie să apară în text ca {"{{nume}}"}.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-ink-2">Domeniu</span>
            <div className="mt-1 flex gap-1.5">
              <select
                value={form.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}
                className="flex-1 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
              >
                <option value="">Fără domeniu</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.parentId ? "— " : ""}{c.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowNewCategory((v) => !v)} className="rounded-md border border-line-strong px-2 text-ink-2 hover:bg-surface-2">
                <Plus size={15} />
              </button>
            </div>
            {showNewCategory && (
              <div className="mt-1.5 flex gap-1.5">
                <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Domeniu nou"
                  className="flex-1 rounded-md border border-line-strong bg-surface px-2 py-1 text-xs" />
                <button type="button" onClick={addNewCategory} className="rounded-md bg-accent px-2 py-1 text-xs text-accent-ink">Adaugă</button>
              </div>
            )}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-2">Sursă (link, opțional)</span>
            <input
              value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://…"
              className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>

        <div>
          <span className="text-xs font-medium text-ink-2">Platformă</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p} type="button" onClick={() => togglePlatform(p)}
                className={clsx(
                  "rounded-full border px-2.5 py-1 text-xs",
                  form.platform.includes(p) ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-ink-2 hover:bg-surface-2"
                )}
              >
                {PLATFORM_LABELS[p] ?? p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs font-medium text-ink-2">Taguri</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {tags?.map((t) => (
              <TagChip key={t.id} name={t.name} active={form.tagIds.includes(t.id)} onClick={() => toggleTag(t.id)} />
            ))}
            <input
              value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewTag(); } }}
              placeholder="+ tag nou" className="w-24 rounded-full border border-dashed border-line-strong bg-surface px-2.5 py-1 text-xs"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={form.requiresAdmin} onChange={(e) => set("requiresAdmin", e.target.checked)} />
          Necesită drepturi de administrator
        </label>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-line bg-ground px-4 py-3.5 sm:-mx-6 sm:px-6">
          <Link to="/entries" className="rounded-md border border-line-strong px-4 py-2 text-sm text-ink hover:bg-surface-2">Renunță</Link>
          <button
            type="submit" disabled={!canSubmit || submitting}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Se salvează…" : isEdit ? "Salvează modificările" : "Salvează intrarea"}
          </button>
        </div>
      </form>
    </div>
  );
}
