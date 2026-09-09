import type { EntryKind, Language, Platform, RiskLevel } from "./constants.js";
import type { ParamInput } from "./schemas.js";

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  icon: string | null;
  sortOrder: number;
}

export interface EntrySummary {
  id: string;
  kind: EntryKind;
  title: string;
  bodyPreview: string;
  language: Language;
  platform: Platform[];
  risk: RiskLevel;
  requiresAdmin: boolean;
  isFavorite: boolean;
  copyCount: number;
  lastUsedAt: string | null;
  updatedAt: string;
  createdAt: string;
  category: Category | null;
  tags: Tag[];
  hasDescription: boolean;
  paramCount: number;
  rank?: number;
}

export interface EntryDetail extends Omit<EntrySummary, "bodyPreview"> {
  body: string;
  description: string;
  rollback: string;
  params: ParamInput[];
  sourceUrl: string | null;
  currentVersion: number;
}

export interface EntryVersion {
  id: string;
  version: number;
  body: string;
  note: string | null;
  createdAt: string;
}

export interface SearchResult {
  items: EntrySummary[];
  total: number;
}

export interface DashboardStats {
  totalCommands: number;
  totalScripts: number;
  addedLast30Days: number;
  categoryBreakdown: { category: Category; count: number }[];
  topCopied: { entry: EntrySummary; copyCount: number }[];
  weeklyActivity: { weekStart: string; count: number }[];
  incomplete: { missingDescription: number; missingTags: number };
  destructiveWithoutRollback: EntrySummary[];
  staleEntries: EntrySummary[];
  tagCount: number;
  categoryCount: number;
}

export interface SecretScanResponse {
  clean: boolean;
  matches: { id: string; label: string; snippet: string }[];
}
