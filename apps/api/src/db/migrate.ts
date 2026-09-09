/**
 * Runs, in order: extensions the schema depends on -> drizzle-kit's generated migrations ->
 * the search-vector trigger. Split out because drizzle-kit's own migration files can't safely
 * assume pg_trgm/unaccent exist yet (the trgm index in schema.ts needs the operator class present
 * *before* that CREATE INDEX runs), and a tsvector-maintenance trigger isn't something drizzle-kit
 * generates from the schema at all.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, client } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  console.log("→ Extensii PostgreSQL (pgcrypto, pg_trgm, unaccent)...");
  await client.unsafe(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS unaccent;
  `);

  console.log("→ Migrații drizzle (tabele, enum-uri, indecși)...");
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });

  console.log("→ Trigger de întreținere pentru căutare (tsvector)...");
  await client.unsafe(`
    -- Shared by both triggers below so the two paths (an entry's own edit vs. its tags
    -- changing) can never compute the vector two different ways.
    CREATE OR REPLACE FUNCTION entries_build_search(
      p_title text, p_tags_text text, p_category_name text, p_description text, p_body text
    ) RETURNS tsvector AS $$
      SELECT
        setweight(to_tsvector('simple', unaccent(coalesce(p_title, ''))), 'A') ||
        setweight(to_tsvector('simple', unaccent(coalesce(p_tags_text, '') || ' ' || coalesce(p_category_name, ''))), 'B') ||
        setweight(to_tsvector('simple', unaccent(coalesce(p_description, ''))), 'C') ||
        setweight(to_tsvector('simple', coalesce(p_body, '')), 'D');
    $$ LANGUAGE sql IMMUTABLE;

    CREATE OR REPLACE FUNCTION entries_search_update() RETURNS trigger AS $$
    DECLARE
      tags_text text;
      cat_text text;
    BEGIN
      SELECT string_agg(t.name, ' ') INTO tags_text
      FROM entry_tags et JOIN tags t ON t.id = et.tag_id
      WHERE et.entry_id = NEW.id;

      SELECT c.name INTO cat_text FROM categories c WHERE c.id = NEW.category_id;

      NEW.search := entries_build_search(NEW.title, tags_text, cat_text, NEW.description, NEW.body);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS entries_search_trigger ON entries;
    CREATE TRIGGER entries_search_trigger
      BEFORE INSERT OR UPDATE OF title, body, description, category_id
      ON entries
      FOR EACH ROW EXECUTE FUNCTION entries_search_update();

    -- Tags live in a join table, so adding/removing one has to reach back and recompute
    -- the vector on the entry it points at — the trigger above only covers entries' own edits.
    CREATE OR REPLACE FUNCTION entry_tags_touch_search() RETURNS trigger AS $$
    DECLARE
      target_id uuid := COALESCE(NEW.entry_id, OLD.entry_id);
      tags_text text;
    BEGIN
      SELECT string_agg(t.name, ' ') INTO tags_text
      FROM entry_tags et JOIN tags t ON t.id = et.tag_id
      WHERE et.entry_id = target_id;

      UPDATE entries e SET search = entries_build_search(
        e.title, tags_text, (SELECT c.name FROM categories c WHERE c.id = e.category_id), e.description, e.body
      )
      WHERE e.id = target_id;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS entry_tags_touch_search_trigger ON entry_tags;
    CREATE TRIGGER entry_tags_touch_search_trigger
      AFTER INSERT OR DELETE ON entry_tags
      FOR EACH ROW EXECUTE FUNCTION entry_tags_touch_search();

    -- Renaming a category (rare, but "Rețea" -> "Networking") should re-index every entry in it.
    CREATE OR REPLACE FUNCTION category_rename_touch_search() RETURNS trigger AS $$
    BEGIN
      UPDATE entries e SET search = entries_build_search(
        e.title,
        (SELECT string_agg(t.name, ' ') FROM entry_tags et JOIN tags t ON t.id = et.tag_id WHERE et.entry_id = e.id),
        NEW.name, e.description, e.body
      )
      WHERE e.category_id = NEW.id;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS category_rename_touch_search_trigger ON categories;
    CREATE TRIGGER category_rename_touch_search_trigger
      AFTER UPDATE OF name ON categories
      FOR EACH ROW EXECUTE FUNCTION category_rename_touch_search();
  `);

  console.log("✓ Baza de date e pregătită.");
  await client.end();
}

run().catch((err) => {
  console.error("✗ Migrarea a eșuat:", err);
  process.exit(1);
});
