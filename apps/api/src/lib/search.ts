import type { SearchQuery } from "@command-vault/shared";
import type { EntrySummary, EntryDetail, EntryVersion } from "@command-vault/shared";
import { client } from "../db/client.js";

// Fragments with no dynamic values, built once and nested into the queries below — postgres.js
// inlines a `client\`\`` result's SQL text (and merges its params) wherever it's interpolated
// into another tagged template, which is what lets SUMMARY_COLUMNS/TAG_JOIN stay reusable
// instead of duplicating this column list in every query.
export const SUMMARY_COLUMNS = client`
  e.id, e.kind, e.title,
  left(e.body, 220) as body_preview,
  e.language, e.platform, e.risk, e.requires_admin, e.is_favorite,
  e.copy_count, e.last_used_at, e.updated_at, e.created_at,
  (e.description <> '') as has_description,
  jsonb_array_length(e.params) as param_count,
  c.id as cat_id, c.name as cat_name, c.slug as cat_slug, c.parent_id as cat_parent_id, c.icon as cat_icon, c.sort_order as cat_sort_order,
  COALESCE(tag_agg.tags, '[]'::json) as tags
`;

// Aggregating tags via a lateral join (instead of GROUP BY e.id, c.id + array_agg) keeps the
// row shape simple and avoids re-deriving the GROUP BY column list every time SUMMARY_COLUMNS changes.
export const TAG_JOIN = client`
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'color', t.color) ORDER BY t.name) as tags
    FROM entry_tags et JOIN tags t ON t.id = et.tag_id
    WHERE et.entry_id = e.id
  ) tag_agg ON true
`;

export function mapSummaryRow(r: any): EntrySummary {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    bodyPreview: r.body_preview,
    language: r.language,
    platform: r.platform ?? [],
    risk: r.risk,
    requiresAdmin: r.requires_admin,
    isFavorite: r.is_favorite,
    copyCount: r.copy_count,
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
    updatedAt: new Date(r.updated_at).toISOString(),
    createdAt: new Date(r.created_at).toISOString(),
    category: r.cat_id
      ? { id: r.cat_id, name: r.cat_name, slug: r.cat_slug, parentId: r.cat_parent_id, icon: r.cat_icon, sortOrder: r.cat_sort_order }
      : null,
    tags: r.tags ?? [],
    hasDescription: r.has_description,
    paramCount: Number(r.param_count ?? 0),
    ...(r.rank !== undefined ? { rank: Number(r.rank) } : {}),
  };
}

export async function searchEntries(ownerId: string, q: SearchQuery): Promise<{ items: EntrySummary[]; total: number }> {
  const conditions: any[] = [client`e.archived_at IS NULL`, client`e.owner_id = ${ownerId}`];
  const hasQuery = !!q.q && q.q.trim().length > 0;

  if (hasQuery) {
    conditions.push(client`(
      e.search @@ websearch_to_tsquery('simple', unaccent(${q.q!})) OR
      e.title % ${q.q!}
    )`);
  }
  if (q.categoryId) conditions.push(client`e.category_id = ${q.categoryId}`);
  if (q.kind) conditions.push(client`e.kind = ${q.kind}`);
  if (q.language && q.language.length > 0) conditions.push(client`e.language = ANY(${q.language})`);
  if (q.platform && q.platform.length > 0) conditions.push(client`e.platform && ${q.platform}`);
  if (q.risk && q.risk.length > 0) conditions.push(client`e.risk = ANY(${q.risk})`);
  if (q.requiresAdmin !== undefined) conditions.push(client`e.requires_admin = ${q.requiresAdmin}`);
  if (q.favoritesOnly) conditions.push(client`e.is_favorite = true`);
  if (q.neverUsed) conditions.push(client`e.last_used_at IS NULL`);
  if (q.missingDescription) conditions.push(client`e.description = ''`);
  if (q.stale) conditions.push(client`(e.last_used_at IS NULL OR e.last_used_at < now() - interval '180 days') AND e.created_at < now() - interval '30 days'`);
  if (q.tagIds && q.tagIds.length > 0) {
    conditions.push(client`e.id IN (
      SELECT entry_id FROM entry_tags WHERE tag_id = ANY(${q.tagIds}) GROUP BY entry_id HAVING COUNT(DISTINCT tag_id) = ${q.tagIds.length}
    )`);
  }

  let where = conditions[0];
  for (let i = 1; i < conditions.length; i++) where = client`${where} AND ${conditions[i]}`;

  const rankExpr = hasQuery
    ? client`ts_rank(e.search, websearch_to_tsquery('simple', unaccent(${q.q!})))`
    : client`0`;

  let orderBy;
  switch (q.sort) {
    case "recent": orderBy = client`e.updated_at DESC`; break;
    case "popular": orderBy = client`e.copy_count DESC, e.updated_at DESC`; break;
    case "title": orderBy = client`e.title ASC`; break;
    default: orderBy = hasQuery ? client`rank DESC, e.copy_count DESC` : client`e.is_favorite DESC, e.updated_at DESC`;
  }

  const rows = await client`
    SELECT ${SUMMARY_COLUMNS}, ${rankExpr} as rank
    FROM entries e
    LEFT JOIN categories c ON c.id = e.category_id
    ${TAG_JOIN}
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ${q.limit} OFFSET ${q.offset}
  `;

  const countRows = await client`SELECT count(*)::int as n FROM entries e WHERE ${where}`;

  return { items: rows.map(mapSummaryRow), total: countRows[0].n as number };
}

export async function getEntryDetail(ownerId: string, id: string): Promise<EntryDetail | null> {
  const rows = await client`
    SELECT ${SUMMARY_COLUMNS},
      e.body, e.description, e.rollback, e.params, e.source_url,
      (SELECT COALESCE(MAX(version), 1) FROM entry_versions WHERE entry_id = e.id) as current_version
    FROM entries e
    LEFT JOIN categories c ON c.id = e.category_id
    ${TAG_JOIN}
    WHERE e.id = ${id} AND e.owner_id = ${ownerId} AND e.archived_at IS NULL
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  const summary = mapSummaryRow(r);
  return {
    ...summary,
    body: r.body,
    description: r.description,
    rollback: r.rollback,
    params: r.params ?? [],
    sourceUrl: r.source_url,
    currentVersion: Number(r.current_version),
  };
}

export async function getEntryVersions(entryId: string): Promise<EntryVersion[]> {
  const rows = await client`
    SELECT id, version, body, note, created_at FROM entry_versions
    WHERE entry_id = ${entryId} ORDER BY version DESC
  `;
  return rows.map((r) => ({ id: r.id, version: r.version, body: r.body, note: r.note, createdAt: new Date(r.created_at).toISOString() }));
}
