import { z } from "zod";
import { ENTRY_KINDS, LANGUAGES, PLATFORMS, RISK_LEVELS } from "./constants.js";

export const paramSchema = z.object({
  name: z
    .string()
    .min(1, "Numele parametrului e obligatoriu")
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Folosește doar litere, cifre și _ (fără spații)"),
  label: z.string().min(1, "Eticheta e obligatorie").max(80),
  default: z.string().max(200).optional(),
  example: z.string().max(200).optional(),
  required: z.boolean().default(true),
});
export type ParamInput = z.infer<typeof paramSchema>;

export const categoryInputSchema = z.object({
  name: z.string().min(1).max(80),
  parentId: z.string().uuid().nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
  sortOrder: z.number().int().default(0),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const tagInputSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});
export type TagInput = z.infer<typeof tagInputSchema>;

const paramsInBody = (body: string, params: ParamInput[]) => {
  const used = new Set(
    Array.from(body.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)).map((m) => m[1])
  );
  return params.every((p) => used.has(p.name));
};

export const entryInputSchema = z
  .object({
    kind: z.enum(ENTRY_KINDS),
    title: z.string().min(1, "Titlul e obligatoriu").max(200),
    body: z.string().min(1, "Comanda sau scriptul nu poate fi gol"),
    language: z.enum(LANGUAGES),
    platform: z.array(z.enum(PLATFORMS)).default([]),
    description: z.string().max(20000).optional().default(""),
    rollback: z.string().max(5000).optional().default(""),
    risk: z.enum(RISK_LEVELS).default("safe"),
    requiresAdmin: z.boolean().default(false),
    params: z.array(paramSchema).default([]),
    categoryId: z.string().uuid().nullable().optional(),
    sourceUrl: z.string().url().max(500).optional().or(z.literal("")),
    isFavorite: z.boolean().default(false),
    tagIds: z.array(z.string().uuid()).default([]),
    /** Set true once the user has confirmed a secret-scan hit is intentional (an example/placeholder). */
    secretsAcknowledged: z.boolean().default(false),
  })
  .refine((v) => v.risk !== "destructive" || v.rollback.trim().length > 0, {
    message: "O comandă marcată distructivă are nevoie de pașii de rollback",
    path: ["rollback"],
  })
  .refine((v) => paramsInBody(v.body, v.params), {
    message: "Fiecare parametru definit trebuie să apară în text ca {{nume}}",
    path: ["params"],
  });
export type EntryInput = z.infer<typeof entryInputSchema>;

export const entryUpdateSchema = entryInputSchema.and(
  z.object({ versionNote: z.string().max(200).optional() })
);
export type EntryUpdate = z.infer<typeof entryUpdateSchema>;

export const searchQuerySchema = z.object({
  q: z.string().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  language: z.array(z.enum(LANGUAGES)).optional(),
  platform: z.array(z.enum(PLATFORMS)).optional(),
  risk: z.array(z.enum(RISK_LEVELS)).optional(),
  kind: z.enum(ENTRY_KINDS).optional(),
  requiresAdmin: z.boolean().optional(),
  favoritesOnly: z.boolean().optional(),
  neverUsed: z.boolean().optional(),
  missingDescription: z.boolean().optional(),
  stale: z.boolean().optional(),
  sort: z.enum(["relevance", "recent", "popular", "title"]).default("relevance"),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** Command patterns that hint an entry should default to a higher risk level. */
const DESTRUCTIVE_HINTS: RegExp[] = [
  /\bRemove-\w+/i,
  /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i,
  /\bDROP\s+(TABLE|DATABASE|INDEX)\b/i,
  /\bformat\s+[a-z]:/i,
  /\bdd\s+if=/i,
  /reset\s+factory|factory-reset/i,
  /\bShutdown-Computer\b|\bRestart-Computer\b.*-Force/i,
  /\bGroup-Policy\b.*-Remove|\bRemove-GPLink\b/i,
  /\bDisable-ADAccount\b|\bRemove-ADUser\b|\bRemove-ADGroupMember\b/i,
  /\btruncate\s+table/i,
];

const CAUTION_HINTS: RegExp[] = [
  /\bSet-\w+/i,
  /\bnetsh\b/i,
  /\bReset-\w+/i,
  /\bStop-Service\b|\bRestart-Service\b/i,
  /\bUPDATE\s+\w+\s+SET\b/i,
];

export function suggestRiskLevel(body: string): (typeof RISK_LEVELS)[number] {
  if (DESTRUCTIVE_HINTS.some((re) => re.test(body))) return "destructive";
  if (CAUTION_HINTS.some((re) => re.test(body))) return "caution";
  return "safe";
}

/** Guesses the language from shebangs/cmdlet shape, used to preselect the field on quick-add. */
export function detectLanguage(body: string): (typeof LANGUAGES)[number] {
  const b = body.trim();
  if (/^#!.*\b(bash|sh|zsh)\b/.test(b)) return "bash";
  if (/^#!.*python/.test(b)) return "python";
  if (/\b(Get|Set|New|Remove|Enable|Disable|Test|Export|Import)-[A-Z]\w+/.test(b)) return "powershell";
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(b)) return "sql";
  if (/^\s*(interface|router|switchport|ip route|access-list)\b/im.test(b)) return "cisco";
  if (/^\s*(\/ip|\/interface|\/system)\b/m.test(b)) return "mikrotik";
  if (/^\s*(sudo\s|apt-get|systemctl|chmod|chown|grep\s|awk\s|\$\()/m.test(b)) return "bash";
  if (/^\s*(net\s|reg\s|sc\s|wmic\s|ipconfig)/im.test(b)) return "cmd";
  return "text";
}
