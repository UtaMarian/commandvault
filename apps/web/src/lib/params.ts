import type { ParamInput } from "@command-vault/shared";

export function substituteParams(body: string, params: ParamInput[], values: Record<string, string>): string {
  let result = body;
  for (const p of params) {
    const value = values[p.name] ?? p.default ?? "";
    result = result.replaceAll(`{{${p.name}}}`, value);
  }
  return result;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be blocked (insecure context, permission denied) — fall back to
    // the old textarea+execCommand trick rather than leaving the user with nothing.
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}
