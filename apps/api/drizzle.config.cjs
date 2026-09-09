// Plain CommonJS on purpose: apps/api's package.json sets "type": "module" for the app's own
// ESM source, but drizzle-kit 0.30.x's config bundler hits "require is not defined" when it
// tries to load a .ts/.mts config from inside an ESM-typed package. A .cjs file is always
// CommonJS to Node regardless of the nearest package.json, which sidesteps that entirely.
const path = require("node:path");
const fs = require("node:fs");
const { defineConfig } = require("drizzle-kit");

function loadRootEnv() {
  const envPath = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadRootEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env at the repo root");
}

module.exports = defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
