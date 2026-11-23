import { fmtMs, fmtNum, fmtPct, fmtUsd, PROVIDER_LABEL } from '../lib/format';
import { HitMissDonut, ProviderCostChart } from './charts';
import { Skeleton } from './ui';

export function Stat({ label, value, sub, tone }) {
  return (
    <div className="card p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={`text-[28px] leading-9 font-semibold tracking-tight num mt-1 ${tone === 'saved' ? 'text-saved' : tone === 'accent' ? 'text-accent' : ''}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} className="h-[108px]" />)}
    </div>
  );
}

// Works for one application's analytics response (or a merged one built on the Overview page).
export default function AnalyticsPanel({ a }) {
  const cached = a.avgLatencyMs.cached;
  const uncached = a.avgLatencyMs.uncached;
  const speedup = cached != null && uncached != null && cached > 0 ? (uncached / cached).toFixed(1) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Requests" value={fmtNum(a.totalRequests)} sub={`${fmtNum(a.errors)} failed`} />
        <Stat label="Cache hit rate" value={fmtPct(a.cacheHitRate)} sub={`${fmtNum(a.cacheHits)} ${a.cacheHits === 1 ? 'hit' : 'hits'} · ${fmtNum(a.cacheMisses)} live ${a.cacheMisses === 1 ? 'call' : 'calls'}`} tone="accent" />
        <Stat label="Spent" value={fmtUsd(a.costUsd)} sub={`${fmtNum(a.tokens.total)} tokens`} />
        <Stat label="Saved by cache" value={fmtUsd(a.savedByCacheUsd)} sub="Estimated from the pricing table" tone="saved" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col">
          <h3 className="font-medium">Cache outcome</h3>
          <div className="flex-1 grid items-center"><HitMissDonut hits={a.cacheHits} misses={a.cacheMisses} /></div>
        </div>

        <div className="card p-5">
          <h3 className="font-medium">Response time</h3>
          <p className="text-sm text-muted mt-0.5">Average latency</p>
          <dl className="mt-5 space-y-4">
            {[
              ['Overall', a.avgLatencyMs.overall],
              ['Cache hit', cached],
              ['Live call', uncached],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between">
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="font-medium num">{fmtMs(v)}</dd>
              </div>
            ))}
          </dl>
          {speedup && <p className="text-sm mt-5 pt-4 border-t">Cached answers return about <span className="font-semibold text-accent">{speedup}×</span> faster.</p>}
        </div>

        <div className="card p-5">
          <h3 className="font-medium">Tokens</h3>
          <p className="text-sm text-muted mt-0.5">Across all requests</p>
          <dl className="mt-5 space-y-4">
            {[['Prompt', a.tokens.prompt], ['Completion', a.tokens.completion], ['Total', a.tokens.total]].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between">
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="font-medium num">{fmtNum(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-medium">By provider</h3>
        {a.byProvider.length === 0 ? (
          <p className="text-sm text-muted mt-2">No requests yet. Send one from the Playground.</p>
        ) : (
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 mt-3 items-center">
            <ProviderCostChart rows={a.byProvider} />
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted text-left">
                  <th className="py-2 font-medium">Provider</th>
                  <th className="py-2 font-medium text-right">Requests</th>
                  <th className="py-2 font-medium text-right">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {a.byProvider.map((p) => (
                  <tr key={p.provider} className="border-t text-sm">
                    <td className="py-2.5">{PROVIDER_LABEL[p.provider] || p.provider}</td>
                    <td className="py-2.5 text-right num">{fmtNum(p.requests)}</td>
                    <td className="py-2.5 text-right num">{fmtNum(p.tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
