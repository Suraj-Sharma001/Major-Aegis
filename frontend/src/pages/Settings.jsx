import { useState } from 'react';
import { LogOut, Moon, Sun, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { BASE_URL, healthApi } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Badge, PageHeader, RoleBadge, Segmented } from '../components/ui';
import { keyVault } from '../lib/keyVault';
import { initials } from '../lib/format';

const ROLE_INFO = {
  ADMIN: 'Full access: teams, members, provider keys, applications and keys.',
  DEVELOPER: 'Can issue and revoke gateway keys for applications in their teams.',
};

function Section({ title, description, children }) {
  return (
    <section className="grid md:grid-cols-[220px_1fr] gap-4 md:gap-10 py-7 border-t first:border-t-0 first:pt-0">
      <div>
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { user, organization, teams, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const health = useAsync(() => healthApi.get());
  const [sessionKeys, setSessionKeys] = useState(() => keyVault.list());

  const clearSessionKeys = () => {
    sessionStorage.removeItem('aegis_session_keys');
    setSessionKeys([]);
    toast.success('Cleared remembered keys');
  };

  const deps = health.data?.dependencies;

  return (
    <>
      <PageHeader title="Settings" />
      <div className="card px-6 py-7">
        <Section title="Profile">
          <div className="flex items-center gap-4">
            <span className="h-12 w-12 rounded-full bg-accent text-accent-ink grid place-items-center font-semibold">{initials(user.name)}</span>
            <div className="min-w-0">
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted truncate">{user.email}</p>
            </div>
          </div>
          <div className="mt-5 rounded-lg bg-sunken p-4 text-sm">
            <p className="flex items-center gap-2 font-medium"><RoleBadge role={user.role} /> in {organization?.name}</p>
            <p className="text-muted mt-2">{ROLE_INFO[user.role]}</p>
          </div>
        </Section>

        <Section title="Your teams" description="Teams decide which applications you can see.">
          {teams.length === 0 ? <p className="text-sm text-muted">You are not in any team yet.</p> : (
            <div className="flex flex-wrap gap-2">{teams.map((t) => <Badge key={t.id} tone="accent">{t.name}</Badge>)}</div>
          )}
        </Section>

        <Section title="Appearance">
          <Segmented
            value={theme}
            onChange={(v) => v !== theme && toggle()}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          />
          <p className="text-xs text-muted mt-2 flex items-center gap-1.5">{theme === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />} Saved in this browser.</p>
        </Section>

        <Section title="Backend" description="Where this dashboard sends requests.">
          <p className="font-mono text-sm break-all">{BASE_URL}</p>
          <p className="text-xs text-muted mt-1">Change it with <code className="font-mono">VITE_API_URL</code> in <code className="font-mono">.env</code>, then restart Vite.</p>
          <ul className="mt-4 space-y-2 max-w-xs">
            {health.loading ? <li className="text-sm text-muted">Checking…</li> : !deps ? (
              <li className="text-sm text-danger">Backend not reachable.</li>
            ) : Object.entries(deps).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between text-sm">
                <span className="text-muted capitalize">{k}</span>
                <Badge tone={v === 'up' ? 'ok' : 'danger'}>{v}</Badge>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Remembered gateway keys" description="Keys you created in this tab, kept until the tab closes.">
          {sessionKeys.length === 0 ? <p className="text-sm text-muted">None.</p> : (
            <>
              <ul className="text-sm space-y-1.5">{sessionKeys.map((k) => <li key={k.id}>{k.appName} <span className="text-muted">· {k.label}</span></li>)}</ul>
              <button className="btn-ghost mt-4" onClick={clearSessionKeys}><Trash2 className="h-4 w-4" /> Forget them</button>
            </>
          )}
        </Section>

        <Section title="Session">
          <button className="btn-ghost" onClick={logout}><LogOut className="h-4 w-4" /> Sign out</button>
        </Section>
      </div>
    </>
  );
}
