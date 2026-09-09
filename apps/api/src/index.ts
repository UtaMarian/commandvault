import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { attachUser } from "./lib/auth.js";
import authRoutes from "./routes/auth.js";
import categoryRoutes from "./routes/categories.js";
import tagRoutes from "./routes/tags.js";
import entryRoutes from "./routes/entries.js";
import dashboardRoutes from "./routes/dashboard.js";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
const PORT = Number(process.env.PORT ?? 4000);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

await app.register(cors, { origin: WEB_ORIGIN, credentials: true });
await app.register(cookie);

app.addHook("preHandler", attachUser);

app.get("/api/health", async () => ({ ok: true, time: new Date().toISOString() }));

await app.register(authRoutes);
await app.register(categoryRoutes);
await app.register(tagRoutes);
await app.register(entryRoutes);
await app.register(dashboardRoutes);

app.setErrorHandler((err: FastifyError, _req, reply) => {
  app.log.error(err);
  const status = err.statusCode ?? 500;
  reply.code(status).send({ error: status === 500 ? "Eroare internă de server" : err.message });
});

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`Command Vault API pornit pe portul ${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
