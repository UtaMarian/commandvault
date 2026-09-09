import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  bigserial,
  primaryKey,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// tsvector has no first-class drizzle type — this is the standard escape hatch.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const entryKindEnum = pgEnum("entry_kind", ["command", "script"]);
export const riskLevelEnum = pgEnum("risk_level", ["safe", "caution", "destructive"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull().default("Admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // opaque random token, also the cookie value
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  parentId: uuid("parent_id"),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({
  slugIdx: uniqueIndex("categories_slug_idx").on(t.slug),
  parentFk: index("categories_parent_idx").on(t.parentId),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  children: many(categories),
}));

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  color: text("color"),
}, (t) => ({
  slugIdx: uniqueIndex("tags_slug_idx").on(t.slug),
}));

export const entries = pgTable("entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  kind: entryKindEnum("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  language: text("language").notNull(),
  platform: text("platform").array().notNull().default(sql`'{}'::text[]`),
  description: text("description").notNull().default(""),
  rollback: text("rollback").notNull().default(""),
  risk: riskLevelEnum("risk").notNull().default("safe"),
  requiresAdmin: boolean("requires_admin").notNull().default(false),
  params: jsonb("params").notNull().default(sql`'[]'::jsonb`),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  sourceUrl: text("source_url"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  copyCount: integer("copy_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  search: tsvector("search"),
}, (t) => ({
  categoryIdx: index("entries_category_idx").on(t.categoryId),
  ownerIdx: index("entries_owner_idx").on(t.ownerId),
  archivedIdx: index("entries_archived_idx").on(t.archivedAt),
  searchIdx: index("entries_search_idx").using("gin", t.search),
  titleTrgmIdx: index("entries_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
}));

export const entriesRelations = relations(entries, ({ one, many }) => ({
  category: one(categories, { fields: [entries.categoryId], references: [categories.id] }),
  owner: one(users, { fields: [entries.ownerId], references: [users.id] }),
  entryTags: many(entryTags),
  versions: many(entryVersions),
}));

export const entryTags = pgTable("entry_tags", {
  entryId: uuid("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.entryId, t.tagId] }),
}));

export const entryTagsRelations = relations(entryTags, ({ one }) => ({
  entry: one(entries, { fields: [entryTags.entryId], references: [entries.id] }),
  tag: one(tags, { fields: [entryTags.tagId], references: [tags.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  entryTags: many(entryTags),
}));

export const entryVersions = pgTable("entry_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  body: text("body").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entryVersionIdx: uniqueIndex("entry_versions_entry_version_idx").on(t.entryId, t.version),
}));

export const entryVersionsRelations = relations(entryVersions, ({ one }) => ({
  entry: one(entries, { fields: [entryVersions.entryId], references: [entries.id] }),
}));

export const usageLog = pgTable("usage_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  entryId: uuid("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entryIdx: index("usage_log_entry_idx").on(t.entryId),
  atIdx: index("usage_log_at_idx").on(t.at),
}));
