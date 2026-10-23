import { Dataset, MetaMetric, Settings } from './types';
import { addDays } from './util';
import { windowOf } from './schedule';

export interface RegionSeries { region: string; group: number; dates: string[]; values: number[]; zeroShare: number; thin: boolean; }

/**
 * Daily search series per Trends region: the sum of all terms from the same request (they share one scale).
 * Values are never added across regions.
 */
export function regionSeries(ds: Dataset, s: Settings): RegionSeries[] {
  const w = windowOf(s);
  const out: RegionSeries[] = [];
  for (const reg of ds.regions) {
    const pts = ds.trends.filter((p) => p.region === reg.trendsRegion && s.searchTerms.includes(p.term));
    const byDate = new Map<string, number>();
    const zeroByDate = new Map<string, boolean>();
    for (const p of pts) {
      byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
      if (p.term === s.searchTerms[0]) zeroByDate.set(p.date, p.value === 0);
    }
    const dates: string[] = [];
    const values: number[] = [];
    for (let d = w.baselineStart; d <= w.end; d = addDays(d, 1)) {
      if (byDate.has(d)) { dates.push(d); values.push(byDate.get(d)!); }
    }
    const zeros = [...zeroByDate.values()].filter(Boolean).length;
    const zeroShare = zeroByDate.size ? zeros / zeroByDate.size : 1;
    out.push({ region: reg.trendsRegion, group: reg.group, dates, values, zeroShare, thin: zeroShare > s.zeroShareMax || dates.length === 0 });
  }
  return out;
}

/** Daily Meta metric per region and tactic (summed over the region's city ad sets). */
export function metaSeries(ds: Dataset, region: string, tactic: string, metric: MetaMetric): Map<string, number> {
  const m = new Map<string, number>();
  for (const row of ds.meta) {
    if (row.region !== region || row.tactic !== tactic) continue;
    m.set(row.date, (m.get(row.date) ?? 0) + row[metric]);
  }
  return m;
}

export const tacticsOf = (ds: Dataset): string[] => [...new Set(ds.meta.map((r) => r.tactic))].sort();
