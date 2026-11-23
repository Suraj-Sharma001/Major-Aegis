import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, UserMinus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, teamsApi } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, RoleBadge, Skeleton, Spinner } from '../components/ui';
import { fmtDate, initials } from '../lib/format';

function CreateTeamModal({ open, onClose, onDone }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Enter a team name');
    setBusy(true);
    try {
      await teamsApi.create(name.trim());
      toast.success('Team created');
      setName('');
      onClose();
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New team" description="Teams decide who can see which applications.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Team name"><input className="input" autoFocus placeholder="Platform" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Create team</button>
        </div>
      </form>
    </Modal>
  );
}

function AddMemberModal({ open, onClose, team, onDone }) {
  const empty = { email: '', name: '', password: '', role: 'DEVELOPER' };
  const [form, setForm] = useState(empty);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const close = () => { setForm(empty); setNeedsAccount(false); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return toast.error('Enter a valid email address');
    if (needsAccount && (!form.name.trim() || form.password.length < 8)) {
      return toast.error('New accounts need a name and a password of at least 8 characters');
    }
    const body = { email: form.email.trim() };
    if (needsAccount) Object.assign(body, { name: form.name.trim(), password: form.password, role: form.role });

    setBusy(true);
    try {
      const res = await teamsApi.addMember(team.id, body);
      toast.success(res.created ? `Account created and added to ${team.name}` : `${res.member.name} added to ${team.name}`);
      close();
      onDone();
    } catch (err) {
      // The backend asks for name + password when the email has no account yet.
      if (err.response?.status === 400 && /No account exists/i.test(err.response.data?.error || '')) {
        setNeedsAccount(true);
        toast.message('No account with this email. Fill in the details to create one.');
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={`Add to ${team?.name || 'team'}`} description="Add someone from your organization, or create an account for them.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email"><input className="input" type="email" autoFocus placeholder="teammate@company.com" value={form.email} onChange={set('email')} /></Field>
        {needsAccount && (
          <>
            <Field label="Name"><input className="input" value={form.name} onChange={set('name')} /></Field>
            <Field label="Temporary password" hint="At least 8 characters. Share it with them securely."><input className="input" type="text" autoComplete="off" value={form.password} onChange={set('password')} /></Field>
            <Field label="Role">
              <select className="input" value={form.role} onChange={set('role')}>
                <option value="DEVELOPER">Developer: can create applications and keys</option>
                <option value="VIEWER">Viewer: read-only</option>
                <option value="ADMIN">Admin: full access</option>
              </select>
            </Field>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner />} {needsAccount ? 'Create and add' : 'Add member'}</button>
        </div>
      </form>
    </Modal>
  );
}

function TeamMembers({ team, onBack, onChanged }) {
  const { user } = useAuth();
  const members = useAsync(() => teamsApi.members(team.id), [team.id]);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);

  const remove = async () => {
    try {
      await teamsApi.removeMember(team.id, removing.id);
      toast.success(`${removing.name} removed`);
      members.reload();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  return (
    <>
      <button className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-4" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Teams</button>
      <PageHeader
        title={team.name}
        description={`${team._count.members} members · ${team._count.applications} applications`}
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" /> Add member</button>}
      />

      {members.error ? (
        <ErrorState message={members.error} onRetry={members.reload} />
      ) : (
        <div className="card overflow-hidden">
          {members.loading ? (
            <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : members.data.members.length === 0 ? (
            <EmptyState icon={Users} title="No members" description="Add people so they can see this team's applications." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead><tr><th className="th">Member</th><th className="th">Role</th><th className="th">Joined</th><th className="th" /></tr></thead>
                <tbody>
                  {members.data.members.map((m) => (
                    <tr key={m.id}>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <span className="h-8 w-8 rounded-full bg-sunken grid place-items-center text-xs font-semibold">{initials(m.name)}</span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{m.name}{m.id === user.id && <span className="text-muted font-normal"> (you)</span>}</p>
                            <p className="text-xs text-muted truncate">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td"><RoleBadge role={m.role} /></td>
                      <td className="td text-muted">{fmtDate(m.joinedAt)}</td>
                      <td className="td text-right"><button className="btn-quiet !h-8 hover:!text-danger" onClick={() => setRemoving(m)}><UserMinus className="h-4 w-4" /> Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <AddMemberModal open={adding} onClose={() => setAdding(false)} team={team} onDone={() => { members.reload(); onChanged(); }} />
      <ConfirmDialog
        open={!!removing} onClose={() => setRemoving(null)} onConfirm={remove}
        title={`Remove ${removing?.name}?`}
        description={`They will lose access to ${team.name}'s applications. Their account stays in your organization.`}
        confirmLabel="Remove"
      />
    </>
  );
}

export default function Teams() {
  const { isAdmin, refreshProfile } = useAuth();
  const teams = useAsync(() => teamsApi.list());
  const [creating, setCreating] = useState(false);
  const [params, setParams] = useSearchParams();
  const openId = params.get('team');
  const setOpenId = (id) => setParams(id ? { team: id } : {});

  const list = teams.data?.teams || [];
  const open = list.find((t) => t.id === openId);
  const changed = () => { teams.reload(); refreshProfile().catch(() => {}); };

  if (open && isAdmin) return <TeamMembers team={open} onBack={() => setOpenId(null)} onChanged={changed} />;

  return (
    <>
      <PageHeader
        title="Teams"
        description={isAdmin ? 'Teams scope who can see each application. Open a team to manage its members.' : 'The teams you belong to.'}
        actions={isAdmin && <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New team</button>}
      />

      {teams.error ? (
        <ErrorState message={teams.error} onRetry={teams.reload} />
      ) : teams.loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : list.length === 0 ? (
        <div className="card"><EmptyState icon={Users} title="No teams" description="You are not a member of any team yet. Ask an admin to add you." /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((t) => {
            const Tag = isAdmin ? 'button' : 'div';
            return (
              <Tag key={t.id} onClick={isAdmin ? () => setOpenId(t.id) : undefined} className={`card p-5 text-left transition-colors ${isAdmin ? 'hover:border-accent/50 hover:bg-sunken/40' : ''}`}>
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{t.name}</h3>
                  <Users className="h-4 w-4 text-muted" />
                </div>
                <div className="flex gap-5 mt-5 text-sm">
                  <p><span className="font-semibold num">{t._count.members}</span> <span className="text-muted">members</span></p>
                  <p><span className="font-semibold num">{t._count.applications}</span> <span className="text-muted">apps</span></p>
                </div>
                <p className="text-xs text-muted mt-3">Created {fmtDate(t.createdAt)}</p>
              </Tag>
            );
          })}
        </div>
      )}
      <CreateTeamModal open={creating} onClose={() => setCreating(false)} onDone={teams.reload} />
    </>
  );
}
