import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import {
  entryInputSchema,
  entryUpdateSchema,
  searchQuerySchema,
  scanForSecrets,
  LANGUAGE_EXTENSIONS,
  type Language,
} from "@command-vault/shared";
import { db } from "../db/client.js";
import { entries, entryTags, entryVersions, usageLog } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import { getEntryDetail, getEntryVersions, searchEntries } from "../lib/search.js";

async function setEntryTags(entryId: string, tagIds: string[]) {
  await db.delete(entryTags).where(eq(entryTags.entryId, entryId));
  if (tagIds.length > 0) {
    await db.insert(entryTags).values(tagIds.map((tagId) => ({ entryId, tagId })));
  }
}

export default async function entryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/api/entries", async (req, reply) => {
    const raw = req.query as Record<string, any>;
    const parsed = searchQuerySchema.safeParse({
      ...raw,
      tagIds: raw.tagIds ? [].concat(raw.tagIds) : undefined,
      language: raw.language ? [].concat(raw.language) : undefined,
      platform: raw.platform ? [].concat(raw.platform) : undefined,
      risk: raw.risk ? [].concat(raw.risk) : undefined,
      requiresAdmin: raw.requiresAdmin !== undefined ? raw.requiresAdmin === "true" : undefined,
      favoritesOnly: raw.favoritesOnly === "true",
      neverUsed: raw.neverUsed === "true",
      missingDescription: raw.missingDescription === "true",
      stale: raw.stale === "true",
      limit: raw.limit ? Number(raw.limit) : undefined,
      offset: raw.offset ? Number(raw.offset) : undefined,
    });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    return searchEntries(req.user!.id, parsed.data);
  });

  app.post("/api/entries/secret-scan", async (req, reply) => {
    const body = (req.body as { body?: string })?.body ?? "";
    const matches = scanForSecrets(body);
    return { clean: matches.length === 0, matches: matches.map(({ id, label, snippet }) => ({ id, label, snippet })) };
  });

  app.get<{ Params: { id: string } }>("/api/entries/:id", async (req, reply) => {
    const entry = await getEntryDetail(req.user!.id, req.params.id);
    if (!entry) return reply.code(404).send({ error: "Intrarea nu există" });
    return entry;
  });

  app.get<{ Params: { id: string } }>("/api/entries/:id/versions", async (req, reply) => {
    const entry = await getEntryDetail(req.user!.id, req.params.id);
    if (!entry) return reply.code(404).send({ error: "Intrarea nu există" });
    return getEntryVersions(req.params.id);
  });

  app.post("/api/entries", async (req, reply) => {
    const parsed = entryInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message, issues: parsed.error.issues });

    const secretMatches = scanForSecrets(parsed.data.body);
    if (secretMatches.length > 0 && !parsed.data.secretsAcknowledged) {
      return reply.code(422).send({
        error: "Am găsit ceva ce arată a secret în text",
        secretMatches: secretMatches.map(({ id, label, snippet }) => ({ id, label, snippet })),
      });
    }

    const { tagIds, secretsAcknowledged, sourceUrl, ...rest } = parsed.data;
    const [row] = await db.insert(entries).values({
      ...rest,
      sourceUrl: sourceUrl || null,
      ownerId: req.user!.id,
    }).returning();

    if (tagIds.length > 0) await setEntryTags(row.id, tagIds);
    if (parsed.data.kind === "script") {
      await db.insert(entryVersions).values({ entryId: row.id, version: 1, body: parsed.data.body, note: "Versiune inițială" });
    }

    const detail = await getEntryDetail(req.user!.id, row.id);
    return reply.code(201).send(detail);
  });

  app.patch<{ Params: { id: string } }>("/api/entries/:id", async (req, reply) => {
    const existing = await getEntryDetail(req.user!.id, req.params.id);
    if (!existing) return reply.code(404).send({ error: "Intrarea nu există" });

    const parsed = entryUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message, issues: parsed.error.issues });

    const secretMatches = scanForSecrets(parsed.data.body);
    if (secretMatches.length > 0 && !parsed.data.secretsAcknowledged) {
      return reply.code(422).send({
        error: "Am găsit ceva ce arată a secret în text",
        secretMatches: secretMatches.map(({ id, label, snippet }) => ({ id, label, snippet })),
      });
    }

    const { tagIds, secretsAcknowledged, sourceUrl, versionNote, ...rest } = parsed.data;
    const bodyChanged = rest.body !== existing.body;

    await db.update(entries).set({
      ...rest,
      sourceUrl: sourceUrl || null,
      updatedAt: new Date(),
    }).where(and(eq(entries.id, req.params.id), eq(entries.ownerId, req.user!.id)));

    await setEntryTags(req.params.id, tagIds);

    if (bodyChanged && parsed.data.kind === "script") {
      const nextVersion = existing.currentVersion + 1;
      await db.insert(entryVersions).values({
        entryId: req.params.id, version: nextVersion, body: rest.body, note: versionNote || null,
      });
    }

    const detail = await getEntryDetail(req.user!.id, req.params.id);
    return detail;
  });

  app.post<{ Params: { id: string } }>("/api/entries/:id/favorite", async (req, reply) => {
    const entry = await getEntryDetail(req.user!.id, req.params.id);
    if (!entry) return reply.code(404).send({ error: "Intrarea nu există" });
    const [row] = await db.update(entries)
      .set({ isFavorite: !entry.isFavorite })
      .where(and(eq(entries.id, req.params.id), eq(entries.ownerId, req.user!.id)))
      .returning({ isFavorite: entries.isFavorite });
    return row;
  });

  app.post<{ Params: { id: string } }>("/api/entries/:id/copy", async (req, reply) => {
    const entry = await getEntryDetail(req.user!.id, req.params.id);
    if (!entry) return reply.code(404).send({ error: "Intrarea nu există" });
    await db.update(entries)
      .set({ copyCount: entry.copyCount + 1, lastUsedAt: new Date() })
      .where(eq(entries.id, req.params.id));
    await db.insert(usageLog).values({ entryId: req.params.id, action: "copy" });
    return { ok: true };
  });

  // GET (not POST) so the browser can hit it with a plain <a href download> navigation,
  // which is the only way to get a native "Save As" without extra JS ceremony.
  app.get<{ Params: { id: string } }>("/api/entries/:id/download", async (req, reply) => {
    const entry = await getEntryDetail(req.user!.id, req.params.id);
    if (!entry) return reply.code(404).send({ error: "Intrarea nu există" });
    await db.update(entries)
      .set({ copyCount: entry.copyCount + 1, lastUsedAt: new Date() })
      .where(eq(entries.id, req.params.id));
    await db.insert(usageLog).values({ entryId: req.params.id, action: "download" });

    const ext = LANGUAGE_EXTENSIONS[entry.language as Language] ?? "txt";
    const filename = `${entry.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "script"}.${ext}`;
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    reply.header("Content-Type", "text/plain; charset=utf-8");
    return entry.body;
  });

  app.post<{ Params: { id: string; version: string } }>("/api/entries/:id/versions/:version/restore", async (req, reply) => {
    const existing = await getEntryDetail(req.user!.id, req.params.id);
    if (!existing) return reply.code(404).send({ error: "Intrarea nu există" });

    const versions = await getEntryVersions(req.params.id);
    const target = versions.find((v) => v.version === Number(req.params.version));
    if (!target) return reply.code(404).send({ error: "Versiunea nu există" });

    const nextVersion = existing.currentVersion + 1;
    await db.update(entries).set({ body: target.body, updatedAt: new Date() }).where(eq(entries.id, req.params.id));
    await db.insert(entryVersions).values({
      entryId: req.params.id, version: nextVersion, body: target.body, note: `Restaurat din v${target.version}`,
    });

    return getEntryDetail(req.user!.id, req.params.id);
  });

  app.delete<{ Params: { id: string } }>("/api/entries/:id", async (req, reply) => {
    const [row] = await db.update(entries)
      .set({ archivedAt: new Date() })
      .where(and(eq(entries.id, req.params.id), eq(entries.ownerId, req.user!.id)))
      .returning({ id: entries.id });
    if (!row) return reply.code(404).send({ error: "Intrarea nu există" });
    return reply.code(204).send();
  });
}
