import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { tagInputSchema } from "@command-vault/shared";
import { db } from "../db/client.js";
import { entries, entryTags, tags } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";

const COMBINING_DIACRITICS = new RegExp("[̀-ͯ]", "g");
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function tagRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/api/tags", async (req) => {
    const rows = await db
      .select({
        id: tags.id, name: tags.name, slug: tags.slug, color: tags.color,
        entryCount: sql<number>`count(${entryTags.entryId}) filter (where ${entries.archivedAt} is null and ${entries.ownerId} = ${req.user!.id})::int`,
      })
      .from(tags)
      .leftJoin(entryTags, eq(entryTags.tagId, tags.id))
      .leftJoin(entries, eq(entries.id, entryTags.entryId))
      .groupBy(tags.id)
      .orderBy(tags.name);
    return rows;
  });

  app.post("/api/tags", async (req, reply) => {
    const parsed = tagInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const slug = slugify(parsed.data.name);
    const existing = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
    if (existing.length > 0) return reply.code(200).send(existing[0]); // idempotent from the autocomplete's point of view

    const [row] = await db.insert(tags).values({ ...parsed.data, slug }).returning();
    return reply.code(201).send(row);
  });

  app.patch<{ Params: { id: string } }>("/api/tags/:id", async (req, reply) => {
    const parsed = tagInputSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const patch = parsed.data.name ? { ...parsed.data, slug: slugify(parsed.data.name) } : parsed.data;
    const [row] = await db.update(tags).set(patch).where(eq(tags.id, req.params.id)).returning();
    if (!row) return reply.code(404).send({ error: "Tagul nu există" });
    return row;
  });

  // Merge tag `from` into tag `to` (repoints every entry, then deletes `from`) — the fix
  // for "retea" / "rețea" / "network" all meaning the same thing, called out in the plan.
  app.post<{ Body: { from: string; to: string } }>("/api/tags/merge", async (req, reply) => {
    const { from, to } = req.body ?? {};
    if (!from || !to || from === to) return reply.code(400).send({ error: "Alege două taguri diferite" });

    await db.transaction(async (tx) => {
      const targets = await tx
        .select({ entryId: entryTags.entryId })
        .from(entryTags)
        .where(eq(entryTags.tagId, from));
      for (const t of targets) {
        await tx.insert(entryTags).values({ entryId: t.entryId, tagId: to }).onConflictDoNothing();
      }
      await tx.delete(entryTags).where(eq(entryTags.tagId, from));
      await tx.delete(tags).where(eq(tags.id, from));
    });
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/api/tags/:id", async (req, reply) => {
    await db.delete(tags).where(eq(tags.id, req.params.id));
    return reply.code(204).send();
  });
}
