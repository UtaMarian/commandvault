/**
 * Guards against real secrets ending up in the vault (plan.html §Reguli — "Zero secrete în bază").
 * Runs on both the client (instant feedback while typing) and the server (the actual gate).
 *
 * Strategy: strip {{param}} placeholders first — a command that reads `-Password {{adminPass}}`
 * is exactly what we want and must never trip the scanner. What's left is scanned for patterns
 * that only show up when a real secret was pasted in.
 */

export interface SecretMatch {
  id: string;
  label: string;
  snippet: string;
  index: number;
}

interface Rule {
  id: string;
  label: string;
  pattern: RegExp;
}

const RULES: Rule[] = [
  {
    id: "ps-plaintext-password",
    label: "Parolă PowerShell în text clar",
    pattern: /-AsPlainText\b[^\n]*-Force\b|ConvertTo-SecureString\s+["'][^"'{}]{3,}["']/gi,
  },
  {
    id: "assigned-secret",
    label: "Parolă / secret atribuit direct",
    pattern: /\b(password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"'{}][^\s"']{2,}["']?/gi,
  },
  {
    id: "pem-block",
    label: "Bloc de cheie privată (PEM)",
    pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    id: "aws-key",
    label: "Cheie de acces AWS",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: "github-token",
    label: "Token GitHub",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  },
  {
    id: "slack-token",
    label: "Token Slack",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    id: "generic-bearer",
    label: "Token Bearer în text clar",
    pattern: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/g,
  },
  {
    id: "conn-string-password",
    label: "Parolă într-un connection string",
    pattern: /:\/\/[^\s{}/:@]+:[^\s{}/@]{3,}@/g,
  },
];

/** Replaces {{token}} placeholders with a neutral word so they never match a "real value" rule. */
function stripPlaceholders(text: string): string {
  return text.replace(/\{\{\s*[\w.-]+\s*\}\}/g, "PARAM");
}

export function scanForSecrets(text: string): SecretMatch[] {
  if (!text) return [];
  const cleaned = stripPlaceholders(text);
  const matches: SecretMatch[] = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(cleaned)) !== null) {
      matches.push({
        id: rule.id,
        label: rule.label,
        snippet: m[0].slice(0, 60),
        index: m.index,
      });
      if (m[0].length === 0) rule.pattern.lastIndex++;
    }
  }

  return matches;
}
