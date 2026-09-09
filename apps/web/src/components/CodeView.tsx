import { useCallback, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Language } from "@command-vault/shared";
import { langExtension } from "../lib/codemirror-lang";

// One dark "terminal" surface for code regardless of the app's own light/dark theme — echoes
// the vault/terminal identity from the plan doc and keeps every code block visually consistent.
// `!important` on colors: @uiw/react-codemirror's own default "light" theme (its fallback when
// no `theme` prop is given) was winning the cascade over this — same background wins on
// insertion order, but the earlier bug was leaving *white bg + light text*, unreadable in both
// app themes. We now also pass `theme="none"` below so this is the only theme in play, but the
// !important stays as a second line of defense against another built-in theme sneaking back in.
const vaultTheme = EditorView.theme(
  {
    "&": { backgroundColor: "rgb(var(--code-bg)) !important", color: "rgb(var(--code-ink)) !important" },
    ".cm-content": { caretColor: "rgb(var(--accent))" },
    ".cm-gutters": { backgroundColor: "rgb(var(--code-bg)) !important", color: "rgb(var(--code-dim))", border: "none" },
    ".cm-activeLine": { backgroundColor: "rgb(var(--code-line) / 0.5)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgb(var(--accent) / 0.25) !important",
    },
    ".cm-cursor": { borderLeftColor: "rgb(var(--accent))" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace" },
    // Defense in depth for any popup the editor itself can open (Ctrl+F search panel, a
    // future autocomplete) — without this they render in CodeMirror's unstyled white default.
    ".cm-panels": { backgroundColor: "rgb(var(--code-line))", color: "rgb(var(--code-ink))" },
    ".cm-tooltip": {
      backgroundColor: "rgb(var(--code-line))",
      color: "rgb(var(--code-ink))",
      border: "1px solid rgb(var(--code-dim) / 0.4)",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "rgb(var(--accent) / 0.25)" },
  },
  { dark: true }
);

// Explicit token colors — without this, tokens fall back to whichever default highlight style
// is loaded (tuned for a light surface), which is exactly what made keywords/strings unreadable
// against our dark code surface. Colors echo plan.html's code block (keyword cyan, string amber).
const vaultHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword], color: "#7FD1DC" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#E3B06B" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "rgb(var(--code-dim))", fontStyle: "italic" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#C9A9E0" },
  { tag: [t.function(t.variableName), t.definition(t.variableName)], color: "#9FE3C4" },
  { tag: [t.typeName, t.className, t.namespace], color: "#E8C879" },
  { tag: [t.variableName, t.propertyName, t.attributeName], color: "rgb(var(--code-ink))" },
  { tag: [t.operator, t.punctuation, t.paren, t.bracket, t.squareBracket], color: "rgb(var(--code-dim))" },
  { tag: t.meta, color: "rgb(var(--code-dim))" },
  { tag: t.invalid, color: "#E88176" },
]);

export function CodeView({
  value,
  language,
  editable = false,
  onChange,
  minHeight = "3rem",
  maxHeight = "50vh",
}: {
  value: string;
  language: Language;
  editable?: boolean;
  onChange?: (value: string) => void;
  minHeight?: string;
  maxHeight?: string;
}) {
  const extensions = useMemo(() => {
    const lang = langExtension(language);
    return [vaultTheme, syntaxHighlighting(vaultHighlightStyle), EditorView.lineWrapping, ...(lang ? [lang] : [])];
  }, [language]);

  // @uiw/react-codemirror reconfigures the editor whenever `basicSetup` is a *new* object —
  // an inline literal here would do that on every keystroke (new value -> re-render -> new
  // object -> reconfigure -> emits a change -> setState -> re-render -> ...), which is exactly
  // the infinite-update loop this used to hit. Memoize it so it's only ever two stable objects.
  const basicSetup = useMemo(
    // autocompletion off: it's plain command/script text, not a language server, and its
    // default popup theme is unstyled white-on-white against our dark surface.
    () => ({ lineNumbers: editable, foldGutter: false, highlightActiveLine: editable, autocompletion: false }),
    [editable]
  );

  // The real fix for the loop above: an inline `onChange={(v) => ...}` at the call site is a
  // *new function every render*, and @uiw/react-codemirror reconfigures its update-listener
  // extension whenever the onChange reference changes — which itself fires onChange with the
  // current doc, causing setState -> re-render -> new inline fn -> reconfigure -> onChange ->
  // forever. Routing every call through a ref keeps the prop we hand the library permanently
  // stable no matter what the caller passes in, without asking every call site to useCallback.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const stableOnChange = useCallback((v: string) => onChangeRef.current?.(v), []);

  return (
    <div className="overflow-hidden rounded-lg border border-line-strong">
      <CodeMirror
        value={value}
        onChange={stableOnChange}
        editable={editable}
        theme="none"
        extensions={extensions}
        basicSetup={basicSetup}
        minHeight={minHeight}
        maxHeight={maxHeight}
      />
    </div>
  );
}
