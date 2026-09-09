import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { eq, lt } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";

export const SESSION_COOKIE = "cv_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — a technician's own tool, not a bank

export interface AuthedUser {
  id: string;
  email: string;
  displayName: string;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, token));
}

export async function getUserFromToken(token: string | undefined): Promise<AuthedUser | null> {
  if (!token) return null;
  const rows = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await destroySession(token);
    return null;
  }
  return { id: row.id, email: row.email, displayName: row.displayName };
}

export async function pruneExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthedUser | null;
  }
}

/** Populates req.user from the session cookie; does not itself reject unauthenticated requests. */
export async function attachUser(req: FastifyRequest, _reply: FastifyReply) {
  const token = req.cookies[SESSION_COOKIE];
  req.user = await getUserFromToken(token);
}

/** Route-level guard — call as a preHandler on anything that isn't public. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) {
    reply.code(401).send({ error: "Autentificare necesară" });
  }
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}
