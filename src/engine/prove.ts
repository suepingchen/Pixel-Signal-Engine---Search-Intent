import { Dataset, Half, Phase, Settings } from './types';
import { RegionSeries, regionSeries } from './series';
import { phaseBetween, windowOf } from './schedule';
import { dayOfWeek, mean, ols, rng } from './util';

export interface RegionLift { region: string; group: number; half: Half; liftPct: number; offMean: number; n: number; }
export interface ProveResult {
  status: 'Validated' | 'Not confirmed' | 'Waiting for search data';
  pooledLiftPct: number;
  pValue: number;
  regions: RegionLift[];
  excluded: string[]; // thin regions left out of the read
  permutations: number;
}

/**
 * Lift for one region: OLS of the search index on an ON indicator, the region's own trend, day of week and events,
 * over baseline + test days, leaving out washout and cooldown days. Lift % = ON coefficient / OFF average.
 */
export function regionLift(
  rs: RegionSeries, half: Half, s: Settings, start: string, endExclusive: string, events: Set<string>,
): { liftPct: number; offMean: number; n: number } {
  const X: number[][] = [];
  const y: number[] = [];
  const offVals: number[] = [];
  rs.dates.forEach((d, i) => {
    const ph: Phase = phaseBetween(d, half, s, start, endExclusive);
    if (ph === 'WASHOUT' || ph === 'COOLDOWN') return;
    const on = ph === 'ON' ? 1 : 0;
    const dow = dayOfWeek(d);
    const t = i / 100;
    X.push([1, on, t, ...[1, 2, 3, 4, 5, 6].map((k) => (dow === k ? 1 : 0)), events.has(d) ? 1 : 0]);
    y.push(rs.values[i]);
    if (!on) offVals.push(rs.values[i]);
  });
  if (y.length < 20 || !offVals.length) return { liftPct: NaN, offMean: NaN, n: y.length };
  const beta = ols(X, y);
  const offMean = mean(offVals);
  return { liftPct: offMean > 0 ? (beta[1] / offMean) * 100 : NaN, offMean, n: y.length };
}

export function eventDates(ds: Dataset, region: string): Set<string> {
  return new Set(ds.calendar.filter((c) => c.region === 'ALL' || c.region === region).map((c) => c.date));
}

export function prove(ds: Dataset, s: Settings, seed = 11): ProveResult {
  const all = regionSeries(ds, s);
  const readable = all.filter((r) => !r.thin);
  const excluded = all.filter((r) => r.thin).map((r) => r.region);
  const w = windowOf(s);
  const hasTest = readable.some((r) => r.dates.some((d) => d >= w.testStart));
  if (!readable.length || !hasTest) {
    return { status: 'Waiting for search data', pooledLiftPct: NaN, pValue: NaN, regions: [], excluded, permutations: 0 };
  }
  const halves: Record<number, Half> = Object.fromEntries(ds.groups.map((g) => [g.id, g.half]));
  // Each region has only two possible schedules (half A or half B), so work out both once.
  const both = readable.map((rs) => {
    const ev = eventDates(ds, rs.region);
    return {
      rs,
      A: regionLift(rs, 'A', s, w.testStart, w.cooldownStart, ev),
      B: regionLift(rs, 'B', s, w.testStart, w.cooldownStart, ev),
    };
  });
  const pooledFor = (h: Record<number, Half>) => mean(both.map((b) => b[h[b.rs.group]].liftPct).filter((v) => isFinite(v)));
  const observed = pooledFor(halves);
  // Permutation test: re-randomise which half each group is in, many times, and see how often chance matches the real lift.
  const r = rng(seed);
  let beat = 0;
  for (let k = 0; k < s.permutations; k++) {
    const h: Record<number, Half> = {};
    for (const g of ds.groups) h[g.id] = r() < 0.5 ? 'A' : 'B';
    if (pooledFor(h) >= observed) beat++;
  }
  const pValue = (beat + 1) / (s.permutations + 1);
  const status = observed > 0 && pValue < s.pMax ? 'Validated' : 'Not confirmed';
  return {
    status, pooledLiftPct: observed, pValue, excluded, permutations: s.permutations,
    regions: both.map((b) => {
      const half = halves[b.rs.group];
      const x = b[half];
      return { region: b.rs.region, group: b.rs.group, half, liftPct: x.liftPct, offMean: x.offMean, n: x.n };
    }),
  };
}
