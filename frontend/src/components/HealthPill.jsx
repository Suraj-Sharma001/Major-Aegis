import { useEffect, useRef, useState } from 'react';
import { healthApi } from '../services/api';

const LABELS = { database: 'Database', redis: 'Redis', embedding: 'Embedding service' };

export default function HealthPill() {
  const [health, setHealth] = useState(null); // null = loading, false = unreachable
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    let alive = true;
    const check = () =>
      healthApi.get().then((d) => alive && setHealth(d)).catch(() => alive && setHealth(false));
    check();
    const id = setInterval(check, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const status = health === false ? 'down' : health?.status;
  const tone = { ok: 'bg-ok', degraded: 'bg-saved', down: 'bg-danger' }[status] || 'bg-muted';
  const text = { ok: 'All systems up', degraded: 'Cache offline', down: 'Backend down' }[status] || 'Checking…';

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost !h-8 !px-2.5 text-xs gap-2" aria-expanded={open}>
        <span className={`h-2 w-2 rounded-full ${tone}`} />
        <span className="hidden sm:inline">{text}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 card shadow-pop p-4 z-40">
          <p className="text-sm font-medium mb-3">System status</p>
          {health === false || !health ? (
            <p className="text-sm text-muted">The backend did not respond. Start it with <code className="font-mono text-xs">npm run dev</code>.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {Object.entries(health.dependencies || {}).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{LABELS[k] || k}</span>
                    <span className={`flex items-center gap-1.5 ${v === 'up' ? 'text-ok' : 'text-danger'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${v === 'up' ? 'bg-ok' : 'bg-danger'}`} />{v}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted mt-3 pt-3 border-t">Semantic cache: {health.semanticCache}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
