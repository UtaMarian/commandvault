import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { categoryInputSchema } from "@command-vault/shared";
import { db } from "../db/client.js";
import { categories, entries } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";

const COMBINING_DIACRITICS = new RegExp("[̀-ͯ]", "g");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "") // ă/â/î/ș/ț -> a/a/i/s/t once diacritics are split off
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function categoryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/api/categories", async (req) => {
    const rows = await db
      .select({
        id: categories.id, name: categories.name, slug: categories.slug,
        parentId: categories.parentId, icon: categories.icon, sortOrder: categories.sortOrder,
        entryCount: sql<number>`count(${entries.id}) filter (where ${entries.archivedAt} is null and ${entries.ownerId} = ${req.user!.id})::int`,
      })
      .from(categories)
      .leftJoin(entries, eq(entries.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(categories.sortOrder, categories.name);
    return rows;
  });

  app.post("/api/categories", async (req, reply) => {
    const parsed = categoryInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const baseSlug = slugify(parsed.data.name);
    let slug = baseSlug;
    let attempt = 1;
    while ((await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug))).length > 0) {
      attempt += 1;
      slug = `${baseSlug}-${attempt}`;
    }

    const [row] = await db.insert(categories).values({ ...parsed.data, slug }).returning();
    return reply.code(201).send(row);
  });

  app.patch<{ Params: { id: string } }>("/api/categories/:id", async (req, reply) => {
    const parsed = categoryInputSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const [row] = await db.update(categories).set(parsed.data).where(eq(categories.id, req.params.id)).returning();
    if (!row) return reply.code(404).send({ error: "Categoria nu există" });
    return row;
  });

  app.delete<{ Params: { id: string } }>("/api/categories/:id", async (req, reply) => {
    const [inUse] = await db.select({ n: sql<number>`count(*)` }).from(entries).where(eq(entries.categoryId, req.params.id));
    if (Number(inUse.n) > 0) {
      return reply.code(409).send({ error: "Categoria are intrări asociate — mută-le întâi în altă categorie" });
    }
    await db.delete(categories).where(and(eq(categories.id, req.params.id)));
    return reply.code(204).send();
  });
}
