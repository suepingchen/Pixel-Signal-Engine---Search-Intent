import { Dataset, Settings } from './types';
import { phaseOf, windowOf } from './schedule';
import { mean } from './util';

export interface DeliveryRow { region: string; group: number; onSpend: number; offSpend: number; boostPct: number; flagged: boolean; }

/**
 * Did the extra Meta weight actually deliver? Average daily spend per region in on weeks vs off weeks of the test.
 * Meta can under-deliver in smaller cities, so a region whose boost is below minBoostPct is flagged.
 */
export function deliveryCheck(ds: Dataset, s: Settings): DeliveryRow[] {
  const w = windowOf(s);
  const out: DeliveryRow[] = [];
  for (const reg of ds.regions) {
    const half = ds.groups.find((g) => g.id === reg.group)?.half ?? 'A';
    const byDate = new Map<string, number>();
    for (const r of ds.meta) if (r.region === reg.trendsRegion && r.date >= w.testStart && r.date < w.cooldownStart) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.spend);
    const on: number[] = [], off: number[] = [];
    for (const [d, v] of byDate) (phaseOf(d, half, s) === 'ON' ? on : off).push(v);
    const onSpend = mean(on), offSpend = mean(off);
    const boostPct = offSpend > 0 ? ((onSpend - offSpend) / offSpend) * 100 : NaN;
    out.push({ region: reg.trendsRegion, group: reg.group, onSpend, offSpend, boostPct, flagged: !(boostPct >= s.minBoostPct) });
  }
  return out;
}
