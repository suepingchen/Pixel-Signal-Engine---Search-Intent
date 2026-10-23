import { Phase } from '../engine/types';

/** Small SVG line chart with ON / washout / cooldown shading. One region per chart, never a shared scale. */
export function SeriesChart({ dates, values, phases, height = 120 }: { dates: string[]; values: number[]; phases: Phase[]; height?: number }) {
  const W = 520, H = height, pad = 24;
  if (!values.length) return <div className="text-xs text-slate-400">No data</div>;
  const max = Math.max(...values, 1);
  const x = (i: number) => pad + (i / Math.max(values.length - 1, 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const fill: Partial<Record<Phase, string>> = { ON: '#dbeafe', WASHOUT: '#f1f5f9', COOLDOWN: '#fef3c7' };
  const step = (W - pad * 2) / Math.max(values.length - 1, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Search index over time with on weeks shaded">
      {phases.map((p, i) => (fill[p] ? <rect key={i} x={x(i) - step / 2} y={pad / 2} width={step} height={H - pad * 1.5} fill={fill[p]} /> : null))}
      <path d={path} fill="none" stroke="#1d4ed8" strokeWidth={1.4} />
      <text x={pad} y={H - 6} fontSize={9} fill="#64748b">{dates[0]}</text>
      <text x={W - pad} y={H - 6} fontSize={9} fill="#64748b" textAnchor="end">{dates[dates.length - 1]}</text>
      <text x={pad - 4} y={y(max) + 3} fontSize={9} fill="#64748b" textAnchor="end">{Math.round(max)}</text>
    </svg>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
      <span><i className="inline-block w-3 h-3 align-[-2px] mr-1 bg-blue-100" />On weeks (extra Meta)</span>
      <span><i className="inline-block w-3 h-3 align-[-2px] mr-1 bg-slate-100 border border-slate-200" />Washout (not read)</span>
      <span><i className="inline-block w-3 h-3 align-[-2px] mr-1 bg-amber-100" />Cooldown</span>
    </div>
  );
}
