import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppWindow, KeyRound, LayoutDashboard, LogOut, Menu, Moon, Settings, Sun, SquareTerminal, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Logo from './Logo';
import HealthPill from './HealthPill';
import { RoleBadge } from './ui';
import { initials } from '../lib/format';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/applications', label: 'Applications', icon: AppWindow },
  { to: '/playground', label: 'Playground', icon: SquareTerminal },
  { to: '/teams', label: 'Teams', icon: Users },
  { to: '/provider-keys', label: 'Provider keys', icon: KeyRound, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function Sidebar({ onNavigate }) {
  const { organization, isAdmin } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 h-16">
        <Logo />
        <div className="leading-tight min-w-0">
          <p className="font-semibold tracking-tight">Aegis</p>
          <p className="text-xs text-muted truncate">{organization?.name}</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {NAV.filter((n) => !n.adminOnly || isAdmin).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to} to={to} end={end} onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 h-9 text-sm font-medium transition-colors ${
                isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:text-ink hover:bg-sunken'
              }`
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-8 w-8 rounded-full bg-accent text-accent-ink text-xs font-semibold grid place-items-center"
        aria-label="Account menu" aria-expanded={open}
      >
        {initials(user?.name)}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 card shadow-pop p-2 z-40">
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted truncate">{user?.email}</p>
            <div className="mt-2"><RoleBadge role={user?.role || 'DEVELOPER'} /></div>
          </div>
          <div className="border-t my-1" />
          <button className="btn-quiet w-full !justify-start" onClick={() => { setOpen(false); navigate('/settings'); }}>
            <Settings className="h-4 w-4" /> Settings
          </button>
          <button className="btn-quiet w-full !justify-start" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [drawer, setDrawer] = useState(false);
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();

  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-full">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 border-r bg-surface z-30">
        <Sidebar />
      </aside>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-surface border-r">
            <button className="btn-quiet !h-8 !w-8 !p-0 absolute right-3 top-4" onClick={() => setDrawer(false)} aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60 min-h-full flex flex-col">
        <header className="sticky top-0 z-20 h-16 flex items-center justify-between gap-3 px-4 sm:px-8 bg-bg/85 backdrop-blur border-b">
          <button className="btn-quiet !px-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <HealthPill />
          <button className="btn-ghost !h-8 !w-8 !p-0" onClick={toggle} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <UserMenu />
        </header>
        <main className="flex-1 px-4 sm:px-8 py-8 w-full max-w-[1200px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
