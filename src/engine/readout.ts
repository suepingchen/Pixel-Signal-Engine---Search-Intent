import { DILUTION_WARNING, fmtP } from './config';
import { Dataset } from './types';
import { ActResult } from './act';
import { FindResult } from './find';
import { ProveResult } from './prove';
import { SizingResult } from './sizing';

export interface Approval { tactic: string; decision: 'Approved' | 'Rejected'; name: string; comment: string; at: string; }

const f1 = (v: number) => (isFinite(v) ? v.toFixed(1) : 'n/a');

/** Weekly readout built in code from computed numbers only. No AI model writes or rewrites it. */
export function readoutMarkdown(ds: Dataset, prv: ProveResult, fnd: FindResult, siz: SizingResult, a: ActResult, approvals: Approval[]): string {
  const L: string[] = [];
  L.push('# Pixel Signal Engine: weekly readout', '');
  L.push(`Data: ${ds.label}`, '');
  L.push('## Main KPI: search intent lift', '');
  L.push(`- Result: **${prv.status}**`);
  L.push(`- Pooled lift in on weeks vs off weeks: ${f1(prv.pooledLiftPct)}% (p ${fmtP(prv.pValue).startsWith('<') ? '' : '= '}${fmtP(prv.pValue)}, ${prv.permutations} reshuffles)`);
  L.push(`- Smallest lift this pilot can reliably detect: about ${f1(siz.mdePct)}%`);
  if (prv.excluded.length) L.push(`- Left out of the read (too many zero days): ${prv.excluded.join(', ')}`);
  L.push(`- Note: ${DILUTION_WARNING}`, '');
  L.push('## Read alongside', '');
  for (const b of ds.brandLift) L.push(`- Meta Brand Lift, ${b.metric}: ${f1(b.liftPct)}% (range ${f1(b.ciLow)} to ${f1(b.ciHigh)})${b.ciLow > 0 ? '' : ', not counted as supporting proof'}`);
  for (const d of ds.deviceLift) L.push(`- Device lift (directional), ${d.cell}: ${f1(d.liftValue)} (range ${f1(d.ciLow)} to ${f1(d.ciHigh)})`);
  L.push('', '## Find: early clues (candidates, not proven)', '');
  if (!fnd.shortlist.length) L.push('- No signal passed all four checks.');
  for (const sgl of fnd.shortlist) L.push(`- ${sgl.tactic} ${sgl.metric}: searches rise about ${sgl.lag} days later (average correlation ${sgl.meanR.toFixed(2)}, strong in ${Math.round(sgl.shareStrong * 100)}% of regions)`);
  L.push('', '## Budget moves', '', `- ${a.note}`);
  for (const m of a.moves) L.push(`- ${m.tactic}: ${m.current.toLocaleString('en-IN')} to ${m.proposed.toLocaleString('en-IN')} INR a week (${m.changePct >= 0 ? '+' : ''}${f1(m.changePct)}%)`);
  L.push('', '## Approvals', '');
  if (!approvals.length) L.push('- None yet. Nothing changes in Meta until the Media Lead approves.');
  for (const ap of approvals) L.push(`- ${ap.tactic}: ${ap.decision} by ${ap.name} at ${ap.at}${ap.comment ? ` (${ap.comment})` : ''}`);
  return L.join('\n');
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}
