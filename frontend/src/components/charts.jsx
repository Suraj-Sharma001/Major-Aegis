import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { fmtNum, fmtUsd, PROVIDER_LABEL } from '../lib/format';

export function useChartColors() {
  const { theme } = useTheme();
  return theme === 'dark'
    ? { accent: '#34D1BF', saved: '#F0A83C', muted: '#5B6877', grid: '#26303A', text: '#8692A0', tip: '#1A212A' }
    : { accent: '#0B7A75', saved: '#BE7208', muted: '#B5BCC6', grid: '#E3E6EB', text: '#626C79', tip: '#FFFFFF' };
}

function Tip({ active, payload, label, colors, money }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-surface px-3 py-2 text-xs shadow-pop">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey || p.name} className="flex items-center gap-2 text-muted">
          <i className="h-2 w-2 rounded-sm" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: <span className="text-ink num">{money ? fmtUsd(p.value) : fmtNum(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// Cache hits vs misses as a donut.
export function HitMissDonut({ hits, misses }) {
  const c = useChartColors();
  const data = [
    { name: 'Cache hits', value: hits, fill: c.accent },
    { name: 'Live calls', value: misses, fill: c.muted },
  ];
  const empty = hits + misses === 0;
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={empty ? [{ name: 'None', value: 1, fill: c.grid }] : data} dataKey="value" innerRadius={52} outerRadius={74} stroke="none" paddingAngle={empty ? 0 : 2} isAnimationActive={false}>
            {(empty ? [{ fill: c.grid }] : data).map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Pie>
          {!empty && <Tooltip content={<Tip colors={c} />} />}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Spend vs savings per provider.
export function ProviderCostChart({ rows }) {
  const c = useChartColors();
  const data = rows.map((r) => ({ name: PROVIDER_LABEL[r.provider] || r.provider, Spent: r.costUsd, Saved: r.savedUsd }));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4} margin={{ left: -8, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: c.text, fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: c.text, fontSize: 12 }} tickFormatter={(v) => (v === 0 ? '0' : `$${v}`)} width={56} />
          <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} content={<Tip colors={c} money />} />
          <Bar dataKey="Spent" fill={c.muted} radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="Saved" fill={c.saved} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
