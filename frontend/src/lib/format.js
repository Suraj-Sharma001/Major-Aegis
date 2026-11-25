export const fmtNum = (n) => new Intl.NumberFormat('en-US').format(n ?? 0);

export const fmtCompact = (n) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n ?? 0);

// Costs are tiny (fractions of a cent), so show more digits for small values.
export function fmtUsd(n) {
  const v = n ?? 0;
  if (v === 0) return '$0.00';
  if (v < 0.01) return `$${v.toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}`;
  return `$${v.toFixed(v < 1 ? 4 : 2)}`;
}

export const fmtPct = (n) => `${((n ?? 0) * 100).toFixed(1)}%`;

export const fmtMs = (n) => (n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`);

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(iso) {
  if (!iso) return 'Never';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const units = [['d', 86400], ['h', 3600], ['m', 60]];
  for (const [u, sec] of units) if (s >= sec) return `${Math.floor(s / sec)}${u} ago`;
  return 'just now';
}

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

export const PROVIDER_LABEL = { OPENAI: 'OpenAI', CLAUDE: 'Claude', GEMINI: 'Gemini', GROK: 'Grok', OLLAMA: 'Ollama' };
