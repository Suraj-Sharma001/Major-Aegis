import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Ban, KeyRound, Plus, ScrollText, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { appsApi, errorMessage } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { Badge, ConfirmDialog, CopyButton, EmptyState, ErrorState, Field, Modal, PageHeader, Segmented, Skeleton, Spinner } from '../components/ui';
import AnalyticsPanel, { StatsSkeleton } from '../components/AnalyticsPanel';
import RequestTape from '../components/RequestTape';
import { keyVault } from '../lib/keyVault';
import { fmtDateTime, fmtMs, fmtUsd, fmtNum, PROVIDER_LABEL, timeAgo } from '../lib/format';

/* ---------------- Analytics ---------------- */
function AnalyticsTab({ appId }) {
  const a = useAsync(() => appsApi.analytics(appId), [appId]);
  const logs = useAsync(() => appsApi.logs(appId, 60), [appId]);

  if (a.error) return <ErrorState message={a.error} onRetry={a.reload} />;
  if (a.loading) return <StatsSkeleton />;
  return (
    <div className="space-y-6">
      {logs.data?.logs?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-medium mb-4">Recent requests</h3>
          <RequestTape logs={logs.data.logs} />
        </div>
      )}
      <AnalyticsPanel a={a.data} />
    </div>
  );
}

/* ---------------- API keys ---------------- */
function KeysTab({ appId, appName }) {
  const { canBuild } = useAuth();
  const keys = useAsync(() => appsApi.keys(appId), [appId]);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null); // the one-time key reveal
  const [revoking, setRevoking] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const k = await appsApi.issueKey(appId, label.trim() || 'default');
      keyVault.save({ id: k.id, key: k.key, label: k.label, appId, appName });
      setCreating(false);
      setLabel('');
      setFresh(k);
      keys.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    try {
      await appsApi.revokeKey(appId, revoking.id);
      keyVault.remove(revoking.id);
      toast.success('Key revoked');
      keys.reload();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">Client apps send one of these in the <code className="font-mono text-xs bg-sunken rounded px-1.5 py-0.5">x-api-key</code> header.</p>
        {canBuild && <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New key</button>}
      </div>

      {keys.error ? (
        <ErrorState message={keys.error} onRetry={keys.reload} />
      ) : (
        <div className="card overflow-hidden">
          {keys.loading ? (
            <div className="p-4 space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : keys.data.keys.length === 0 ? (
            <EmptyState icon={KeyRound} title="No gateway keys" description="Issue a key so this application can call the gateway." action={canBuild && <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New key</button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead><tr><th className="th">Label</th><th className="th">Key</th><th className="th">Status</th><th className="th">Last used</th><th className="th">Created</th><th className="th" /></tr></thead>
                <tbody>
                  {keys.data.keys.map((k) => (
                    <tr key={k.id}>
                      <td className="td font-medium">{k.label}</td>
                      <td className="td font-mono text-xs text-muted">{k.keyPrefix}…</td>
                      <td className="td">{k.isActive ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Revoked</Badge>}</td>
                      <td className="td text-muted">{timeAgo(k.lastUsedAt)}</td>
                      <td className="td text-muted">{fmtDateTime(k.createdAt)}</td>
                      <td className="td text-right">
                        {canBuild && k.isActive && <button className="btn-quiet !h-8 text-danger hover:!text-danger" onClick={() => setRevoking(k)}><Ban className="h-4 w-4" /> Revoke</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New gateway key" description={`For ${appName}`}>
        <form onSubmit={create} className="space-y-4">
          <Field label="Label" hint="Helps you tell keys apart, for example “production”.">
            <input className="input" autoFocus placeholder="default" value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Create key</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!fresh} onClose={() => setFresh(null)} title="Copy your key now" width="max-w-lg">
        {fresh && (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-lg bg-saved/15 text-saved p-3 text-sm">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{fresh.warning}</p>
            </div>
            <div className="rounded-lg border bg-sunken p-3 font-mono text-[13px] break-all select-all">{fresh.key}</div>
            <p className="text-xs text-muted">For convenience, this tab also remembers the key until you close it, so you can use it in the Playground.</p>
            <div className="flex justify-end gap-2">
              <CopyButton text={fresh.key} label="Copy key" />
              <button className="btn-primary" onClick={() => setFresh(null)}>Done</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        title="Revoke this key?"
        description={`Any app using “${revoking?.label}” will start getting 401 errors immediately. This cannot be undone.`}
        confirmLabel="Revoke key"
      />
    </>
  );
}

/* ---------------- Logs ---------------- */
const STATUS_BADGE = {
  SUCCESS: <Badge>Live</Badge>,
  CACHED: <Badge tone="accent">Cache hit</Badge>,
  ERROR: <Badge tone="danger">Error</Badge>,
};

function LogsTab({ appId }) {
  const [limit, setLimit] = useState(50);
  const logs = useAsync(() => appsApi.logs(appId, limit), [appId, limit]);
  const rows = logs.data?.logs || [];

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-sm text-muted">Newest requests first.</p>
        <div className="flex items-center gap-2">
          <select className="input !w-auto !h-9" value={limit} onChange={(e) => setLimit(Number(e.target.value))} aria-label="Rows to load">
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>Last {n}</option>)}
          </select>
          <button className="btn-ghost" onClick={logs.reload} disabled={logs.loading}>{logs.loading && <Spinner />} Refresh</button>
        </div>
      </div>

      {logs.error ? (
        <ErrorState message={logs.error} onRetry={logs.reload} />
      ) : (
        <div className="card overflow-hidden">
          {logs.loading && !logs.data ? (
            <div className="p-4 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={ScrollText} title="No requests yet" description="Requests made through the gateway with this application's keys will be listed here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr>
                    <th className="th">Time</th><th className="th">Model</th><th className="th">Status</th>
                    <th className="th text-right">Tokens</th><th className="th text-right">Latency</th>
                    <th className="th text-right">Cost</th><th className="th text-right">Saved</th><th className="th text-right">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id} className="hover:bg-sunken/50">
                      <td className="td text-muted whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                      <td className="td">
                        <span className="font-mono text-xs">{l.model}</span>
                        <span className="text-xs text-muted ml-2">{PROVIDER_LABEL[l.provider] || l.provider}</span>
                        {l.errorMessage && <p className="text-xs text-danger mt-1 max-w-sm break-words">{l.errorMessage}</p>}
                      </td>
                      <td className="td">{STATUS_BADGE[l.status]}</td>
                      <td className="td text-right num">{fmtNum(l.totalTokens)}</td>
                      <td className="td text-right num">{fmtMs(l.latencyMs)}</td>
                      <td className="td text-right num">{fmtUsd(l.costUsd)}</td>
                      <td className="td text-right num text-saved">{l.savedCostUsd ? fmtUsd(l.savedCostUsd) : '—'}</td>
                      <td className="td text-right num text-muted">{l.similarityScore != null ? l.similarityScore.toFixed(3) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- Page ---------------- */
export default function ApplicationDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = ['analytics', 'keys', 'logs'].includes(params.get('tab')) ? params.get('tab') : 'analytics';
  const apps = useAsync(() => appsApi.list());
  const app = apps.data?.applications.find((a) => a.id === id);

  if (apps.error) return <ErrorState message={apps.error} onRetry={apps.reload} />;
  if (!apps.loading && !app) {
    return (
      <EmptyState icon={KeyRound} title="Application not found" description="It may have been removed, or you are not in its team." action={<Link to="/applications" className="btn-primary">Back to applications</Link>} />
    );
  }

  return (
    <>
      <Link to="/applications" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-4">
        <ArrowLeft className="h-4 w-4" /> Applications
      </Link>
      <PageHeader
        title={app ? app.name : 'Loading…'}
        description={app && <>Team <span className="text-ink">{app.team.name}</span></>}
        actions={
          <Segmented
            value={tab}
            onChange={(v) => setParams({ tab: v }, { replace: true })}
            options={[{ value: 'analytics', label: 'Analytics' }, { value: 'keys', label: 'API keys' }, { value: 'logs', label: 'Logs' }]}
          />
        }
      />
      {app && tab === 'analytics' && <AnalyticsTab appId={id} />}
      {app && tab === 'keys' && <KeysTab appId={id} appName={app.name} />}
      {app && tab === 'logs' && <LogsTab appId={id} />}
    </>
  );
}
