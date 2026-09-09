import { useState } from "react";
import type { ParamInput } from "@command-vault/shared";
import { Modal } from "./Modal";
import { substituteParams } from "../lib/params";

export function ParamDialog({
  title,
  body,
  params,
  onClose,
  onSubmit,
}: {
  title: string;
  body: string;
  params: ParamInput[];
  onClose: () => void;
  onSubmit: (finalText: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(params.map((p) => [p.name, p.default ?? ""]))
  );

  const preview = substituteParams(body, params, values);
  const missing = params.filter((p) => p.required && !values[p.name]?.trim());

  return (
    <Modal title={`Completează parametrii — ${title}`} onClose={onClose} width="md">
      <div className="flex flex-col gap-3.5">
        {params.map((p, i) => (
          <label key={p.name} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-2">
              {p.label} <code className="text-ink-3">{`{{${p.name}}}`}</code>
              {p.required && <span className="text-danger"> *</span>}
            </span>
            <input
              data-autofocus={i === 0 || undefined}
              value={values[p.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
              placeholder={p.example ?? ""}
              className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink font-mono focus:border-accent"
            />
          </label>
        ))}

        <div className="mt-1">
          <div className="mb-1 text-xs font-medium text-ink-2">Previzualizare</div>
          <pre className="max-h-40 overflow-auto rounded-md bg-[rgb(var(--ink))] px-3 py-2.5 font-mono text-xs text-[rgb(var(--ground))] whitespace-pre-wrap break-words">
            {preview}
          </pre>
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-line-strong px-3.5 py-1.5 text-sm hover:bg-surface-2">
            Renunță
          </button>
          <button
            disabled={missing.length > 0}
            onClick={() => onSubmit(preview)}
            className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Copiază completat
          </button>
        </div>
      </div>
    </Modal>
  );
}
