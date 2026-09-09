import { Modal } from "./Modal";
import { clsx } from "clsx";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmă",
  tone = "default",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel} width="sm">
      <p className="text-sm text-ink-2 leading-relaxed">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-line-strong px-3.5 py-1.5 text-sm text-ink hover:bg-surface-2"
        >
          Renunță
        </button>
        <button
          data-autofocus
          onClick={onConfirm}
          className={clsx(
            "rounded-md px-3.5 py-1.5 text-sm font-medium hover:opacity-90",
            tone === "danger" ? "bg-danger text-white" : "bg-accent text-accent-ink"
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
