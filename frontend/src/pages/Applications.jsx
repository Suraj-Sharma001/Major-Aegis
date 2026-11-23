import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppWindow, ChevronRight, KeyRound, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { appsApi, errorMessage, teamsApi } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { Badge, EmptyState, ErrorState, Field, Modal, PageHeader, Skeleton, Spinner } from '../components/ui';
import { fmtDate } from '../lib/format';

function CreateAppModal({ open, onClose, teams }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = 'Give the application a name';
    if (!teamId) errs.teamId = 'Pick a team';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const { application } = await appsApi.create({ name: name.trim(), teamId });
      toast.success(`Created ${application.name}`);
      setName(''); setTeamId('');
      onClose();
      navigate(`/applications/${application.id}?tab=keys`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New application" description="An application is one app that calls the gateway. It belongs to a team.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" error={errors.name}>
          <input className="input" autoFocus placeholder="Support chatbot" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Team" error={errors.teamId} hint={teams.length === 0 ? 'You are not in any team yet. Ask an admin to add you.' : undefined}>
          <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Select a team…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Create application</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Applications() {
  const { canBuild } = useAuth();
  const apps = useAsync(() => appsApi.list());
  const teams = useAsync(() => teamsApi.list());
  const [query, setQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [creating, setCreating] = useState(false);

  const list = apps.data?.applications || [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((a) => (!q || a.name.toLowerCase().includes(q)) && (!teamFilter || a.teamId === teamFilter));
  }, [list, query, teamFilter]);

  return (
    <>
      <PageHeader
        title="Applications"
        description="Each application gets its own gateway keys, request logs and cache analytics."
        actions={canBuild && <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New application</button>}
      />

      {apps.error ? (
        <ErrorState message={apps.error} onRetry={apps.reload} />
      ) : (
        <>
          {list.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="h-4 w-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input className="input pl-9" placeholder="Search applications" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <select className="input !w-auto min-w-[160px]" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} aria-label="Filter by team">
                <option value="">All teams</option>
                {(teams.data?.teams || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div className="card overflow-hidden">
            {apps.loading ? (
              <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : list.length === 0 ? (
              <EmptyState
                icon={AppWindow}
                title="No applications yet"
                description={canBuild ? 'Create your first application, then issue a gateway key for it.' : 'Applications from your teams will show up here.'}
                action={canBuild && <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New application</button>}
              />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Search} title="No matches" description="Try a different name or team." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr><th className="th">Name</th><th className="th">Team</th><th className="th">Keys</th><th className="th">Created</th><th className="th w-8" /></tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => (
                      <tr key={a.id} className="group hover:bg-sunken/50 transition-colors">
                        <td className="td font-medium"><Link to={`/applications/${a.id}`} className="hover:text-accent">{a.name}</Link></td>
                        <td className="td"><Badge>{a.team.name}</Badge></td>
                        <td className="td text-muted"><span className="inline-flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" />{a._count.apiKeys}</span></td>
                        <td className="td text-muted">{fmtDate(a.createdAt)}</td>
                        <td className="td"><Link to={`/applications/${a.id}`} aria-label={`Open ${a.name}`}><ChevronRight className="h-4 w-4 text-muted group-hover:text-ink" /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <CreateAppModal
        open={creating}
        onClose={() => setCreating(false)}
        teams={teams.data?.teams || []}
      />
    </>
  );
}
