import type { FastifyInstance } from "fastify";
import type { DashboardStats } from "@command-vault/shared";
import { client } from "../db/client.js";
import { requireAuth } from "../lib/auth.js";
import { mapSummaryRow, SUMMARY_COLUMNS, TAG_JOIN } from "../lib/search.js";

export default async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/api/dashboard", async (req): Promise<DashboardStats> => {
    const ownerId = req.user!.id;

    const [totals] = await client`
      SELECT
        count(*) filter (where kind = 'command') as commands,
        count(*) filter (where kind = 'script') as scripts,
        count(*) filter (where created_at >= now() - interval '30 days') as added_30d,
        count(*) filter (where description = '') as missing_description,
        count(*) filter (where id NOT IN (SELECT entry_id FROM entry_tags)) as missing_tags
      FROM entries WHERE owner_id = ${ownerId} AND archived_at IS NULL
    `;

    const [{ n: tagCount }] = await client`SELECT count(*)::int as n FROM tags`;
    const [{ n: categoryCount }] = await client`SELECT count(*)::int as n FROM categories`;

    const categoryBreakdown = await client`
      SELECT
        COALESCE(parent.id, c.id) as root_id, COALESCE(parent.name, c.name) as root_name,
        COALESCE(parent.slug, c.slug) as root_slug, COALESCE(parent.icon, c.icon) as root_icon,
        count(e.id)::int as cnt
      FROM entries e
      JOIN categories c ON c.id = e.category_id
      LEFT JOIN categories parent ON parent.id = c.parent_id
      WHERE e.owner_id = ${ownerId} AND e.archived_at IS NULL
      GROUP BY root_id, root_name, root_slug, root_icon
      ORDER BY cnt DESC
    `;

    const topCopiedRows = await client`
      SELECT ${SUMMARY_COLUMNS} FROM entries e
      LEFT JOIN categories c ON c.id = e.category_id
      ${TAG_JOIN}
      WHERE e.owner_id = ${ownerId} AND e.archived_at IS NULL AND e.copy_count > 0
      ORDER BY e.copy_count DESC LIMIT 10
    `;

    const weeklyActivity = await client`
      SELECT date_trunc('week', at)::date as week_start, count(*)::int as cnt
      FROM usage_log ul
      JOIN entries e ON e.id = ul.entry_id
      WHERE e.owner_id = ${ownerId} AND ul.at >= now() - interval '12 weeks'
      GROUP BY week_start ORDER BY week_start ASC
    `;

    const destructiveRows = await client`
      SELECT ${SUMMARY_COLUMNS} FROM entries e
      LEFT JOIN categories c ON c.id = e.category_id
      ${TAG_JOIN}
      WHERE e.owner_id = ${ownerId} AND e.archived_at IS NULL AND e.risk = 'destructive' AND e.rollback = ''
      ORDER BY e.updated_at DESC LIMIT 20
    `;

    const staleRows = await client`
      SELECT ${SUMMARY_COLUMNS} FROM entries e
      LEFT JOIN categories c ON c.id = e.category_id
      ${TAG_JOIN}
      WHERE e.owner_id = ${ownerId} AND e.archived_at IS NULL
        AND e.created_at < now() - interval '30 days'
        AND (e.last_used_at IS NULL OR e.last_used_at < now() - interval '180 days')
      ORDER BY COALESCE(e.last_used_at, e.created_at) ASC LIMIT 20
    `;

    return {
      totalCommands: Number(totals.commands),
      totalScripts: Number(totals.scripts),
      addedLast30Days: Number(totals.added_30d),
      categoryBreakdown: categoryBreakdown.map((r) => ({
        category: { id: r.root_id, name: r.root_name, slug: r.root_slug, parentId: null, icon: r.root_icon, sortOrder: 0 },
        count: r.cnt,
      })),
      topCopied: topCopiedRows.map((r) => ({ entry: mapSummaryRow(r), copyCount: r.copy_count })),
      weeklyActivity: weeklyActivity.map((r) => ({ weekStart: new Date(r.week_start).toISOString(), count: r.cnt })),
      incomplete: {
        missingDescription: Number(totals.missing_description),
        missingTags: Number(totals.missing_tags),
      },
      destructiveWithoutRollback: destructiveRows.map(mapSummaryRow),
      staleEntries: staleRows.map(mapSummaryRow),
      tagCount: Number(tagCount),
      categoryCount: Number(categoryCount),
    };
  });
}
