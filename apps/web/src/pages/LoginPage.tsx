import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { ApiError } from "../lib/api";

export function LoginPage() {
  const { login, register, setupRequired } = useAuth();
  const [email, setEmail] = useState(setupRequired ? "" : "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (setupRequired && password !== confirm) {
      setError("Parolele nu coincid");
      return;
    }
    setSubmitting(true);
    try {
      if (setupRequired) await register(email, password);
      else await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "A apărut o eroare");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-7 shadow-panel">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-ink">
            <KeyRound size={20} />
          </div>
          <h1 className="text-lg font-semibold text-ink">Command Vault</h1>
          <p className="text-sm text-ink-2">
            {setupRequired ? "Primul lucru: creează contul de administrator." : "Autentifică-te pentru a continua."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-2">Email</span>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-2">Parolă</span>
            <input
              type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent"
            />
          </label>
          {setupRequired && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-2">Confirmă parola</span>
              <input
                type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent"
              />
            </label>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit" disabled={submitting}
            className="mt-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "…" : setupRequired ? "Creează contul" : "Intră"}
          </button>
        </form>
      </div>
    </div>
  );
}
