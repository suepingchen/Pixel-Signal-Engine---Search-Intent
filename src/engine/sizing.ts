import { Dataset, Half, Settings } from './types';
import { regionSeries } from './series';
import { windowOf } from './schedule';
import { addDays, daysBetween, mean, rng, sd } from './util';
import { eventDates, regionLift } from './prove';

export interface SizingResult {
  mdePct: number; // smallest lift the pilot can reliably detect (about 80% power, 5% one-sided)
  placeboRuns: number;
  placeboSdPct: number;
  daysUsed: number;
  message: string;
}

/**
 * Practice run on pre-launch data only: pretend the on/off schedule started on many past dates, when nothing happened,
 * and measure the fake lift each time. The spread of those fake lifts sets the smallest real lift we can trust.
 */
export function sizing(ds: Dataset, s: Settings, runs = 200, seed = 5): SizingResult {
  const w = windowOf(s);
  const readable = regionSeries(ds, s).filter((r) => !r.thin);
  const pre = readable.map((r) => {
    const idx = r.dates.map((d, i) => [d, i] as [string, number]).filter(([d]) => d < w.testStart);
    return { ...r, dates: idx.map(([d]) => d), values: idx.map(([, i]) => r.values[i]) };
  });
  const daysUsed = pre.length ? Math.max(...pre.map((p) => p.dates.length)) : 0;
  const cycleDays = 7 * (s.onWeeks + s.offWeeks);
  if (daysUsed < cycleDays * 2) {
    return { mdePct: NaN, placeboRuns: 0, placeboSdPct: NaN, daysUsed, message: 'Not enough pre-launch search data loaded for a practice run.' };
  }
  const r = rng(seed);
  const lifts: number[] = [];
  for (let k = 0; k < runs; k++) {
    const offset = Math.floor(r() * cycleDays);
    const start = addDays(w.baselineStart, offset);
    const halves: Record<number, Half> = {};
    for (const g of ds.groups) halves[g.id] = r() < 0.5 ? 'A' : 'B';
    const per = pre.map((p) => regionLift(p, halves[p.group], s, start, w.testStart, eventDates(ds, p.region)).liftPct).filter(isFinite);
    if (per.length) lifts.push(mean(per));
  }
  const spread = sd(lifts);
  const mdePct = 2.49 * spread; // (1.645 + 0.84) x spread: 5% one-sided test, about 80% power
  const testDays = daysBetween(w.testStart, w.cooldownStart);
  return {
    mdePct, placeboRuns: lifts.length, placeboSdPct: spread, daysUsed,
    message: `The pilot can reliably detect search lifts of about ${mdePct.toFixed(1)}% or more (based on ${lifts.length} practice runs over ${daysUsed} pre-launch days; the real test has ${testDays} days). If that is too high, consider a longer test, bigger extra Meta weight or broader search terms.`,
  };
}
