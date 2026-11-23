import { Link } from 'react-router-dom';
import { ArrowRight, Check, Circle } from 'lucide-react';
import { appsApi, providerKeysApi } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { mergeAnalytics } from '../lib/aggregate';
import { ErrorState, PageHeader, Skeleton } from '../components/ui';
import AnalyticsPanel, { StatsSkeleton } from '../components/AnalyticsPanel';
import RequestTape from '../components/RequestTape';
import { fmtNum, fmtPct, fmtUsd } from '../lib/format';

// Loads every visible application, then its analytics and recent logs in parallel.
async function loadOverview(isAdmin) {
  const { applications } = await appsApi.list();
  const settled = await Promise.allSettled(
    applications.map(async (app) => {
      const [analytics, logs] = await Promise.all([appsApi.analytics(app.id), appsApi.logs(app.id, 40)]);
      return { app, analytics, logs: logs.logs };
    }),
  );
  const rows = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  const failed = settled.length - rows.length;
  const providerKeys = isAdmin ? (await providerKeysApi.list().catch(() => null))?.keys ?? null : null;
  const recent = rows.flatMap((r) => r.logs).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 60);
  return { applications, rows, failed, providerKeys, recent };
}

function GettingStarted({ data, isAdmin, canBuild }) {
  const hasKeys = data.applications.some((a) => a._count.apiKeys > 0);
  const hasRequests = data.rows.some((r) => r.analytics.totalRequests > 0);
  const steps = [
    ...(isAdmin ? [{ done: (data.providerKeys || []).some((k) => k.isActive), title: 'Add a provider key', text: 'Bring your own OpenAI, Claude or Gemini key.', to: '/provider-keys' }] : []),
    { done: data.applications.length > 0, title: 'Create an application', text: 'One per client app, owned by a team.', to: '/applications', hide: !canBuild },
    { done: hasKeys, title: 'Issue a gateway key', text: 'Your app sends this key with every request.', to: '/applications', hide: !canBuild },
    { done: hasRequests, title: 'Send a request', text: 'Try it in the Playground, then ask the same thing again.', to: '/playground' },
  ].filter((s) => !s.hide);

  return (
    <div className="card p-6">
      <h2 className="font-semibold">Get your first request through</h2>
      <p className="text-sm text-muted mt-1">Four steps and the gateway is live.</p>
      <ol className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((s) => (
          <li key={s.title}>
            <Link to={s.to} className={`block h-full rounded-lg border p-4 transition-colors hover:border-accent/50 ${s.done ? 'bg-sunken/60' : ''}`}>
              <span className={`h-5 w-5 rounded-full grid place-items-center mb-3 ${s.done ? 'bg-ok text-white' : 'text-muted'}`}>
                {s.done ? <Check className="h-3 w-3" strokeWidth={3} /> : <Circle className="h-4 w-4" />}
              </span>
              <p className={`text-sm font-medium ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</p>
              <p className="text-xs text-muted mt-1">{s.text}</p>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Overview() {
  const { user, isAdmin, canBuild } = useAuth();
  const ov = useAsync(() => loadOverview(isAdmin), [isAdmin]);

  if (ov.error) return <ErrorState message={ov.error} onRetry={ov.reload} />;
  if (ov.loading) {
    return (
      <>
        <PageHeader title="Overview" />
        <div className="space-y-6"><Skeleton className="h-52" /><StatsSkeleton /></div>
      </>
    );
  }

  const { rows, recent, applications, failed } = ov.data;
  const merged = mergeAnalytics(rows.map((r) => r.analytics));
  const hasTraffic = merged.totalRequests > 0;

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} description="Everything your applications sent through the gateway, across all teams you can see." />

      {failed > 0 && <p className="mb-4 text-sm text-danger">Analytics could not be loaded for {failed} application{failed > 1 ? 's' : ''}. Totals below are partial.</p>}

      {!hasTraffic ? (
        <GettingStarted data={ov.data} isAdmin={isAdmin} canBuild={canBuild} />
      ) : (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-wrap items-end justify-between gap-6 mb-6">
              <div>
                <p className="text-sm text-muted">Saved by the cache</p>
                <p className="text-[44px] leading-[1.1] font-semibold tracking-tight num text-saved mt-1">{fmtUsd(merged.savedByCacheUsd)}</p>
                <p className="text-sm text-muted mt-2">
                  {fmtNum(merged.cacheHits)} of {fmtNum(merged.cacheHits + merged.cacheMisses)} answers came from the cache ({fmtPct(merged.cacheHitRate)}).
                </p>
              </div>
              <Link to="/playground" className="btn-ghost">Open Playground <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <RequestTape logs={recent} height={84} />
          </div>

          <AnalyticsPanel a={merged} />

          <div className="card overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <h3 className="font-medium">Applications</h3>
              <Link to="/applications" className="text-sm text-accent hover:underline">View all</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead><tr><th className="th">Name</th><th className="th text-right">Requests</th><th className="th text-right">Hit rate</th><th className="th text-right">Spent</th><th className="th text-right">Saved</th></tr></thead>
                <tbody>
                  {rows.map(({ app, analytics: a }) => (
                    <tr key={app.id} className="hover:bg-sunken/50">
                      <td className="td font-medium"><Link to={`/applications/${app.id}`} className="hover:text-accent">{app.name}</Link> <span className="text-xs text-muted font-normal ml-1">{app.team.name}</span></td>
                      <td className="td text-right num">{fmtNum(a.totalRequests)}</td>
                      <td className="td text-right num">{fmtPct(a.cacheHitRate)}</td>
                      <td className="td text-right num">{fmtUsd(a.costUsd)}</td>
                      <td className="td text-right num text-saved">{fmtUsd(a.savedByCacheUsd)}</td>
                    </tr>
                  ))}
                  {applications.length === 0 && null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
