import type { EntryKind, Language, Platform, RiskLevel } from "@command-vault/shared";

export interface EntryFilters {
  q?: string;
  categoryId?: string;
  tagIds?: string[];
  language?: Language[];
  platform?: Platform[];
  risk?: RiskLevel[];
  kind?: EntryKind;
  requiresAdmin?: boolean;
  favoritesOnly?: boolean;
  neverUsed?: boolean;
  missingDescription?: boolean;
  stale?: boolean;
  sort?: "relevance" | "recent" | "popular" | "title";
}

export function filtersToSearchParams(f: EntryFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.categoryId) p.set("categoryId", f.categoryId);
  if (f.kind) p.set("kind", f.kind);
  if (f.requiresAdmin) p.set("requiresAdmin", "true");
  if (f.favoritesOnly) p.set("favoritesOnly", "true");
  if (f.neverUsed) p.set("neverUsed", "true");
  if (f.missingDescription) p.set("missingDescription", "true");
  if (f.stale) p.set("stale", "true");
  if (f.sort && f.sort !== "relevance") p.set("sort", f.sort);
  for (const t of f.tagIds ?? []) p.append("tagIds", t);
  for (const l of f.language ?? []) p.append("language", l);
  for (const pl of f.platform ?? []) p.append("platform", pl);
  for (const r of f.risk ?? []) p.append("risk", r);
  return p;
}

export function filtersFromSearchParams(sp: URLSearchParams): EntryFilters {
  return {
    q: sp.get("q") ?? undefined,
    categoryId: sp.get("categoryId") ?? undefined,
    kind: (sp.get("kind") as EntryKind) ?? undefined,
    requiresAdmin: sp.get("requiresAdmin") === "true" || undefined,
    favoritesOnly: sp.get("favoritesOnly") === "true" || undefined,
    neverUsed: sp.get("neverUsed") === "true" || undefined,
    missingDescription: sp.get("missingDescription") === "true" || undefined,
    stale: sp.get("stale") === "true" || undefined,
    sort: (sp.get("sort") as EntryFilters["sort"]) ?? undefined,
    tagIds: sp.getAll("tagIds").length ? sp.getAll("tagIds") : undefined,
    language: sp.getAll("language").length ? (sp.getAll("language") as Language[]) : undefined,
    platform: sp.getAll("platform").length ? (sp.getAll("platform") as Platform[]) : undefined,
    risk: sp.getAll("risk").length ? (sp.getAll("risk") as RiskLevel[]) : undefined,
  };
}
