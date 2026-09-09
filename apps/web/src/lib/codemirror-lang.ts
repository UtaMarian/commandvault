import { StreamLanguage, type LanguageSupport } from "@codemirror/language";
import { sql } from "@codemirror/lang-sql";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { python } from "@codemirror/legacy-modes/mode/python";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import type { Extension } from "@codemirror/state";
import type { Language } from "@command-vault/shared";

const CACHE = new Map<Language, Extension>();

/** No CodeMirror mode fits Cisco IOS/RouterOS syntax well enough to bother — plain text avoids
 *  mis-highlighting `interface` or `/ip` as something they're not. */
export function langExtension(language: Language): Extension | null {
  if (CACHE.has(language)) return CACHE.get(language)!;

  let ext: Extension | null = null;
  switch (language) {
    case "powershell":
      ext = StreamLanguage.define(powerShell);
      break;
    case "bash":
    case "cmd":
      ext = StreamLanguage.define(shell);
      break;
    case "python":
      ext = StreamLanguage.define(python);
      break;
    case "yaml":
      ext = StreamLanguage.define(yaml);
      break;
    case "sql":
      ext = sql() as LanguageSupport;
      break;
    default:
      ext = null;
  }

  if (ext) CACHE.set(language, ext);
  return ext;
}
