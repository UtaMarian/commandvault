import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env at the repo root");
}

// Neon's pooled endpoint is PgBouncer in transaction mode: no session-level prepared statements.
export const client = postgres(process.env.DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema });
