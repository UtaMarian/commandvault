export const ENTRY_KINDS = ["command", "script"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const RISK_LEVELS = ["safe", "caution", "destructive"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const LANGUAGES = [
  "powershell",
  "cmd",
  "bash",
  "sql",
  "python",
  "cisco",
  "mikrotik",
  "yaml",
  "json",
  "text",
] as const;
export type Language = (typeof LANGUAGES)[number];

export const PLATFORMS = [
  "windows",
  "linux",
  "macos",
  "active-directory",
  "m365",
  "esxi",
  "hyper-v",
  "network",
  "cisco-ios",
  "mikrotik-ros",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const USAGE_ACTIONS = ["copy", "download", "open"] as const;
export type UsageAction = (typeof USAGE_ACTIONS)[number];

export const RISK_LABELS: Record<RiskLevel, string> = {
  safe: "Sigur",
  caution: "Atenție",
  destructive: "Distructiv",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  powershell: "PowerShell",
  cmd: "CMD",
  bash: "Bash",
  sql: "SQL",
  python: "Python",
  cisco: "Cisco IOS",
  mikrotik: "MikroTik",
  yaml: "YAML",
  json: "JSON",
  text: "Text simplu",
};

/** File extension used when a script entry is downloaded, keyed by language. */
export const LANGUAGE_EXTENSIONS: Record<Language, string> = {
  powershell: "ps1",
  cmd: "bat",
  bash: "sh",
  sql: "sql",
  python: "py",
  cisco: "txt",
  mikrotik: "rsc",
  yaml: "yaml",
  json: "json",
  text: "txt",
};
