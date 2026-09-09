import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ListChecks, Star, Tags as TagsIcon, Plus, Search,
  Sun, Moon, LogOut, KeyRound, Menu, X,
} from "lucide-react";
import { clsx } from "clsx";
import { CommandPalette } from "./CommandPalette";
import { iconForCategory } from "../lib/category-icons";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth-context";
import { useCategories } from "../hooks/queries";

function NavItem({ to, icon: Icon, label, badge, onNavigate }: { to: string; icon: any; label: string; badge?: number; onNavigate: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-2.5 rounded-md px-2.5 py-2 md:py-1.5 text-sm transition-colors",
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
  const [navOpen, setNavOpen] = useState(false);
  const { isDark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { data: categories } = useCategories();
  const navigate = useNavigate();
  const location = useLocation();

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

  // A route change from any source (nav click, back/forward, the palette) should close the
  // off-canvas drawer — otherwise it's still open over the new page on mobile.
  useEffect(() => setNavOpen(false), [location.pathname, location.search]);

  const roots = (categories ?? []).filter((c) => !c.parentId);
  const closeNav = () => setNavOpen(false);

  const sidebarInner = (
    <>
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-ink">
          <KeyRound size={15} />
        </div>
        <span className="font-semibold text-ink">Command Vault</span>
        <button onClick={closeNav} className="ml-auto rounded p-1 text-ink-3 hover:bg-surface-2 md:hidden" aria-label="Închide meniul">
          <X size={18} />
        </button>
      </div>

      <button
        onClick={() => { setPaletteOpen(true); closeNav(); }}
        className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-line-strong bg-ground px-2.5 py-2 md:py-1.5 text-sm text-ink-3 hover:border-accent"
      >
        <Search size={14} /> Caută… <kbd className="ml-auto hidden rounded border border-line-strong px-1 text-[0.65rem] sm:inline">Ctrl K</kbd>
      </button>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        <NavItem to="/" icon={LayoutDashboard} label="Sumar" onNavigate={closeNav} />
        <NavItem to="/entries" icon={ListChecks} label="Toate intrările" onNavigate={closeNav} />
        <NavItem to="/entries?favoritesOnly=true" icon={Star} label="Favorite" onNavigate={closeNav} />

        <div className="mt-4 mb-1 px-2.5 text-xs font-medium uppercase tracking-wide text-ink-3">Domenii</div>
        {roots.map((c) => {
          const Icon = iconForCategory(c.icon);
          return <NavItem key={c.id} to={`/entries?categoryId=${c.id}`} icon={Icon} label={c.name} badge={c.entryCount} onNavigate={closeNav} />;
        })}

        <div className="mt-4 mb-1 px-2.5 text-xs font-medium uppercase tracking-wide text-ink-3">Organizare</div>
        <NavItem to="/tags" icon={TagsIcon} label="Taguri" onNavigate={closeNav} />
      </nav>

      <div className="border-t border-line px-3 py-3">
        <button
          onClick={() => { navigate("/entries/new"); closeNav(); }}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 md:py-1.5 text-sm font-medium text-accent-ink hover:opacity-90"
        >
          <Plus size={14} /> Adaugă <span className="hidden sm:inline">(Ctrl N)</span>
        </button>
        <div className="flex items-center gap-2 px-1">
          <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{user?.email}</span>
          <button onClick={toggle} className="rounded p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Comută tema">
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={() => logout()} className="rounded p-1.5 text-ink-3 hover:bg-surface-2 hover:text-danger" aria-label="Delogare">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen min-h-0 flex-col bg-ground md:flex-row">
      {/* Mobile-only top bar: hamburger + name + quick search, replaces the always-visible
          desktop sidebar which doesn't fit a phone screen. */}
      <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2.5 md:hidden">
        <button onClick={() => setNavOpen(true)} className="rounded p-1.5 text-ink-2 hover:bg-surface-2" aria-label="Deschide meniul">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-accent-ink">
            <KeyRound size={12} />
          </div>
          <span className="text-sm font-semibold text-ink">Command Vault</span>
        </div>
        <button onClick={() => setPaletteOpen(true)} className="ml-auto rounded p-1.5 text-ink-2 hover:bg-surface-2" aria-label="Caută">
          <Search size={18} />
        </button>
        <button onClick={() => navigate("/entries/new")} className="rounded p-1.5 text-accent hover:bg-accent-soft" aria-label="Adaugă intrare">
          <Plus size={20} />
        </button>
      </div>

      {/* Scrim behind the off-canvas drawer — mobile only, and only while open. */}
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={closeNav} aria-hidden="true" />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] -translate-x-full flex-col border-r border-line bg-surface transition-transform duration-200 ease-out",
          "md:static md:z-auto md:w-60 md:max-w-none md:shrink-0 md:translate-x-0",
          navOpen && "translate-x-0"
        )}
      >
        {sidebarInner}
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
