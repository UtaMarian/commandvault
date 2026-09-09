import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ListChecks, Star, Tags as TagsIcon, Plus, Search,
  Sun, Moon, LogOut, KeyRound,
} from "lucide-react";
import { clsx } from "clsx";
import { CommandPalette } from "./CommandPalette";
import { iconForCategory } from "../lib/category-icons";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth-context";
import { useCategories } from "../hooks/queries";

function NavItem({ to, icon: Icon, label, badge }: { to: string; icon: any; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
          isActive ? "bg-accent-soft text-accent font-medium" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
        )
      }
    >
      <Icon size={16} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && <span className="text-xs text-ink-3 font-variant-tabular">{badge}</span>}
    </NavLink>
  );
}

export function Layout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { isDark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { data: categories } = useCategories();
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && !typing) {
        e.preventDefault();
        navigate("/entries/new");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate]);

  const roots = (categories ?? []).filter((c) => !c.parentId);

  return (
    <div className="flex h-screen min-h-0 bg-ground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-ink">
            <KeyRound size={15} />
          </div>
          <span className="font-semibold text-ink">Command Vault</span>
        </div>

        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-line-strong bg-ground px-2.5 py-1.5 text-sm text-ink-3 hover:border-accent"
        >
          <Search size={14} /> Caută… <kbd className="ml-auto rounded border border-line-strong px-1 text-[0.65rem]">Ctrl K</kbd>
        </button>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          <NavItem to="/" icon={LayoutDashboard} label="Sumar" />
          <NavItem to="/entries" icon={ListChecks} label="Toate intrările" />
          <NavItem to="/entries?favoritesOnly=true" icon={Star} label="Favorite" />

          <div className="mt-4 mb-1 px-2.5 text-xs font-medium uppercase tracking-wide text-ink-3">Domenii</div>
          {roots.map((c) => {
            const Icon = iconForCategory(c.icon);
            return <NavItem key={c.id} to={`/entries?categoryId=${c.id}`} icon={Icon} label={c.name} badge={c.entryCount} />;
          })}

          <div className="mt-4 mb-1 px-2.5 text-xs font-medium uppercase tracking-wide text-ink-3">Organizare</div>
          <NavItem to="/tags" icon={TagsIcon} label="Taguri" />
        </nav>

        <div className="border-t border-line px-3 py-3">
          <button
            onClick={() => navigate("/entries/new")}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            <Plus size={14} /> Adaugă (Ctrl N)
          </button>
          <div className="flex items-center gap-2 px-1">
            <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{user?.email}</span>
            <button onClick={toggle} className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Comută tema">
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={() => logout()} className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-danger" aria-label="Delogare">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
