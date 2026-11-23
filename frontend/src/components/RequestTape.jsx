import { fmtMs } from '../lib/format';

const COLORS = {
  CACHED: 'bg-accent',
  SUCCESS: 'bg-muted/50',
  ERROR: 'bg-danger',
};
const NAMES = { CACHED: 'Cache hit', SUCCESS: 'Live call', ERROR: 'Error' };

// One bar per request (oldest on the left). Height = latency, colour = what happened.
export default function RequestTape({ logs, height = 72 }) {
  if (!logs?.length) return null;
  const ordered = [...logs].reverse();
  const max = Math.max(...ordered.map((l) => l.latencyMs), 1);

  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }} role="img" aria-label="Recent requests by latency and outcome">
        {ordered.map((l) => (
          <div
            key={l.id}
            title={`${NAMES[l.status]} · ${l.model} · ${fmtMs(l.latencyMs)}`}
            className={`flex-1 min-w-[3px] max-w-[14px] rounded-sm ${COLORS[l.status]} transition-opacity hover:opacity-70`}
            style={{ height: `${Math.max((l.latencyMs / max) * 100, 8)}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-accent" />Cache hit</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-muted/50" />Live call</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-danger" />Error</span>
        <span className="ml-auto">Bar height is latency</span>
      </div>
    </div>
  );
}
