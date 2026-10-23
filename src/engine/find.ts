import { Dataset, META_METRICS, MetaMetric, Settings } from './types';
import { metaSeries, regionSeries, tacticsOf } from './series';
import { windowOf } from './schedule';
import { addDays, benjaminiHochberg, corrPValue, mean, pearson } from './util';

export interface FindCheck { tactic: string; metric: MetaMetric; lag: number; meanR: number; shareStrong: number; shareFirstHalf: number; shareSecondHalf: number; p: number; fdrPass: boolean; pass: boolean; }
export interface FindSignal { tactic: string; metric: MetaMetric; lag: number; meanR: number; shareStrong: number; }
export interface FindResult { checks: FindCheck[]; shortlist: FindSignal[]; regionsUsed: number; }

/**
 * Early clues: does a Meta metric rise a few days before Pixel searches do, in most regions? Read over the test weeks.
 * A signal is kept only if all four checks pass. Shortlist = "Candidates, not proven".
 */
export function find(ds: Dataset, s: Settings): FindResult {
  const w = windowOf(s);
  const readable = regionSeries(ds, s).filter((r) => !r.thin);
  const tactics = tacticsOf(ds);
  const raw: Omit<FindCheck, 'fdrPass' | 'pass'>[] = [];
  for (const tactic of tactics) {
    for (const metric of META_METRICS) {
      const metaByRegion = new Map(readable.map((rs) => [rs.region, metaSeries(ds, rs.region, tactic, metric)]));
      for (const lag of s.lags) {
        const rs_: number[] = [], first: number[] = [], second: number[] = [];
        let zSum = 0, nSum = 0;
        for (const rs of readable) {
          const m = metaByRegion.get(rs.region)!;
          const xs: number[] = [], ys: number[] = [];
          rs.dates.forEach((d, i) => {
            if (d < w.testStart || d >= addDays(w.cooldownStart, lag)) return; // test weeks (plus the lag tail)
            const x = m.get(addDays(d, -lag));
            if (x === undefined) return;
            xs.push(x); ys.push(rs.values[i]);
          });
          if (xs.length < 10) continue;
          const r = pearson(xs, ys);
          if (!isFinite(r)) continue;
          rs_.push(r);
          const h = Math.floor(xs.length / 2);
          first.push(pearson(xs.slice(0, h), ys.slice(0, h)));
          second.push(pearson(xs.slice(h), ys.slice(h)));
          const rc = Math.max(-0.999999, Math.min(0.999999, r));
          zSum += 0.5 * Math.log((1 + rc) / (1 - rc)) * (xs.length - 3);
          nSum += xs.length - 3;
        }
        if (!rs_.length) continue;
        const share = (arr: number[]) => arr.filter((v) => v >= s.findMinCorr).length / readable.length;
        const zBar = zSum / nSum;
        const rBar = Math.tanh(zBar);
        raw.push({
          tactic, metric, lag, meanR: mean(rs_), shareStrong: share(rs_), shareFirstHalf: share(first), shareSecondHalf: share(second),
          p: corrPValue(rBar, nSum + 3),
        });
      }
    }
  }
  const fdr = benjaminiHochberg(raw.map((c) => c.p), s.findFdr);
  const checks: FindCheck[] = raw.map((c, i) => ({
    ...c, fdrPass: fdr[i],
    pass: c.meanR >= s.findMinCorr && c.shareStrong >= s.findMinShare && c.shareFirstHalf >= s.findMinShare && c.shareSecondHalf >= s.findMinShare && fdr[i],
  }));
  // One row per tactic x metric: the lag with the strongest average correlation among passing lags.
  const best = new Map<string, FindSignal>();
  for (const c of checks.filter((x) => x.pass)) {
    const k = `${c.tactic}|${c.metric}`;
    const cur = best.get(k);
    if (!cur || c.meanR > cur.meanR) best.set(k, { tactic: c.tactic, metric: c.metric, lag: c.lag, meanR: c.meanR, shareStrong: c.shareStrong });
  }
  return { checks, shortlist: [...best.values()].sort((a, b) => b.meanR - a.meanR), regionsUsed: readable.length };
}
