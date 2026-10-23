import { Dataset, GroupDef, Half, Phase, Region, Settings } from './types';
import { addDays, daysBetween } from './util';

/** Build city groups from the region mapping and split them into two halves of similar search volume. */
export function buildGroups(regions: Region[], volumeByRegion: Record<string, number> = {}): GroupDef[] {
  const byId = new Map<number, GroupDef>();
  for (const r of regions) {
    const g = byId.get(r.group) ?? { id: r.group, regions: [], cities: [], half: 'A' as Half };
    g.regions.push(r.trendsRegion);
    g.cities.push(...r.pixelCities);
    byId.set(r.group, g);
  }
  const groups = [...byId.values()].sort((a, b) => a.id - b.id);
  // Greedy balance: biggest groups first, each to the half with the smaller running total.
  const vol = (g: GroupDef) => g.regions.reduce((s, r) => s + (volumeByRegion[r] ?? 1), 0);
  const totals: Record<Half, number> = { A: 0, B: 0 };
  [...groups].sort((a, b) => vol(b) - vol(a) || a.id - b.id).forEach((g) => {
    g.half = totals.A <= totals.B ? 'A' : 'B';
    totals[g.half] += vol(g);
  });
  return groups;
}

export interface Window { baselineStart: string; testStart: string; cooldownStart: string; end: string; }

export function windowOf(s: Settings): Window {
  const baselineStart = addDays(s.startDate, -7 * s.baselineWeeks);
  const cooldownStart = addDays(s.startDate, 7 * s.testWeeks);
  const end = addDays(cooldownStart, 7 * s.cooldownWeeks - 1);
  return { baselineStart, testStart: s.startDate, cooldownStart, end };
}

/**
 * Phase of a group on a date. Half A starts ON, half B starts OFF; blocks alternate every onWeeks/offWeeks.
 * The first washoutDays of an OFF block that follows an ON block are WASHOUT (not read).
 */
export function phaseOf(date: string, half: Half, s: Settings): Phase {
  const w = windowOf(s);
  return phaseBetween(date, half, s, w.testStart, w.cooldownStart);
}

/** Same rule for any test window [start, endExclusive). Used for the real test and for placebo runs. */
export function phaseBetween(date: string, half: Half, s: Settings, start: string, endExclusive: string): Phase {
  if (date < start) return 'BASELINE';
  if (date >= endExclusive) return 'COOLDOWN';
  const d = daysBetween(start, date);
  const cycle = 7 * (s.onWeeks + s.offWeeks);
  const pos = d % cycle;
  const firstLen = 7 * (half === 'A' ? s.onWeeks : s.offWeeks);
  const inFirst = pos < firstLen;
  const isOn = half === 'A' ? inFirst : !inFirst;
  if (isOn) return 'ON';
  // OFF: is it right after an ON block?
  const offPos = half === 'A' ? pos - firstLen : pos;
  const followsOn = half === 'A' ? true : d >= cycle; // half B's very first OFF block has no ON before it
  return followsOn && offPos < s.washoutDays ? 'WASHOUT' : 'OFF';
}

export interface ScheduleRow { groupId: number; region: string; city: string; date: string; phase: Phase; half: Half; }

export function scheduleRows(ds: Dataset, s: Settings): ScheduleRow[] {
  const w = windowOf(s);
  const rows: ScheduleRow[] = [];
  for (let d = w.testStart; d <= w.end; d = addDays(d, 1)) {
    for (const g of ds.groups) {
      const phase = phaseOf(d, g.half, s);
      for (const r of ds.regions.filter((x) => x.group === g.id)) {
        for (const c of r.pixelCities) rows.push({ groupId: g.id, region: r.trendsRegion, city: c, date: d, phase, half: g.half });
      }
    }
  }
  return rows;
}
