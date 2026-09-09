import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { clearSessionCookie, createSession, destroySession, requireAuth, SESSION_COOKIE, setSessionCookie } from "../lib/auth.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Parola trebuie să aibă minim 8 caractere"),
});

export default async function authRoutes(app: FastifyInstance) {
  // Only works while the vault has no account yet — the one-time setup screen on first launch.
  app.post("/api/auth/register", async (req, reply) => {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length > 0) {
      return reply.code(403).send({ error: "Există deja un cont. Folosește autentificarea." });
    }
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const passwordHash = await argon2.hash(parsed.data.password);
    const [user] = await db.insert(users).values({ email: parsed.data.email, passwordHash }).returning();
    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(reply, token, expiresAt);
    return { id: user.id, email: user.email, displayName: user.displayName };
  });

  app.get("/api/auth/setup-required", async () => {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    return { setupRequired: existing.length === 0 };
  });

  app.post("/api/auth/login", async (req, reply) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
    const genericError = { error: "Email sau parolă greșită" };
    if (!user) return reply.code(401).send(genericError);

    const valid = await argon2.verify(user.passwordHash, parsed.data.password);
    if (!valid) return reply.code(401).send(genericError);

    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(reply, token, expiresAt);
    return { id: user.id, email: user.email, displayName: user.displayName };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await destroySession(token);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (req) => {
    return req.user;
  });
}
