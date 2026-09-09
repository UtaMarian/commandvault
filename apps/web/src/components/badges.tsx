import { clsx } from "clsx";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { LANGUAGE_LABELS, RISK_LABELS, type Language, type RiskLevel } from "@command-vault/shared";

const RISK_STYLE: Record<RiskLevel, { tone: string; icon: typeof ShieldCheck }> = {
  safe: { tone: "text-ok bg-ok-soft", icon: ShieldCheck },
  caution: { tone: "text-signal bg-signal-soft", icon: ShieldQuestion },
  destructive: { tone: "text-danger bg-danger-soft", icon: ShieldAlert },
};

export function RiskBadge({ risk, compact = false }: { risk: RiskLevel; compact?: boolean }) {
  const { tone, icon: Icon } = RISK_STYLE[risk];
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      <Icon size={12} strokeWidth={2.5} />
      {!compact && RISK_LABELS[risk]}
    </span>
  );
}

export function LanguageTag({ language }: { language: Language }) {
  return (
    <span className="inline-flex items-center rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[0.7rem] text-ink-2">
      {LANGUAGE_LABELS[language] ?? language}
    </span>
  );
}

export function TagChip({
  name,
  onClick,
  active = false,
  onRemove,
}: {
  name: string;
  onClick?: () => void;
  active?: boolean;
  onRemove?: () => void;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-line-strong bg-surface text-ink-2",
        onClick && "hover:border-accent hover:text-accent cursor-pointer"
      )}
    >
      #{name}
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onRemove(); } }}
          className="ml-0.5 -mr-0.5 rounded-full hover:text-danger"
          aria-label={`Elimină tagul ${name}`}
        >
          ×
        </span>
      )}
    </Comp>
  );
}

export function AdminBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-line-strong px-2 py-0.5 text-xs text-ink-2">
      necesită admin
    </span>
  );
}
