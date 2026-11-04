import { DEFAULT_SETTINGS, STARTING_REGIONS } from './config';
import { buildGroups, phaseOf, windowOf } from './schedule';
import { BrandLiftRow, BudgetRow, CalendarRow, Dataset, DeviceLiftRow, MetaRow, Settings, TrendsPoint } from './types';
import { addDays, dayOfWeek, gauss, rng } from './util';

// SAMPLE DATA - illustrative only. Built so every screen works before real data is connected.
// Search: daily Trends-style index (0-100) per region and term, with weekly seasonality, a festival bump,
// and a built-in lift of about 6% that appears about 5 days after extra Meta activity (Reels, Carousel) starts.

const REGION_LEVEL: Record<string, number> = {
  Karnataka: 72, Maharashtra: 80, Delhi: 66, Haryana: 48, 'Uttar Pradesh': 52, Gujarat: 50, 'Andhra Pradesh': 42,
  Telangana: 64, 'Tamil Nadu': 58, Kerala: 55, 'West Bengal': 46, Rajasthan: 38, Chandigarh: 20, 'Madhya Pradesh': 26,
  Assam: 9, Odisha: 12,
};
const TERM_SHARE: Record<string, number> = {
  'google pixel': 1, 'pixel phone': 0.55, 'iphone to pixel': 0.16, 'switch from iphone to android': 0.12,
};
const TACTICS = ['Reels', 'Carousel', 'Stories'] as const;
const BAU_SPEND: Record<string, number> = { Reels: 9000, Carousel: 6000, Stories: 5000 }; // INR per city per day
const EXTRA_SPEND: Record<string, number> = { Reels: 7000, Carousel: 6000, Stories: 0 }; // only in ON weeks
const LAG = 5;
const LIFT = 0.06;

export function sampleDataset(s: Settings = DEFAULT_SETTINGS, seed = 7): Dataset {
  const r = rng(seed);
  const w = windowOf(s);
  const groups = buildGroups(STARTING_REGIONS, REGION_LEVEL);
  const halfOf = (region: string) => groups.find((g) => g.regions.includes(region))!.half;
  const festivals = ['2026-11-08', '2026-11-09', '2026-12-25', '2027-01-14'];
  const calendar: CalendarRow[] = festivals.map((d) => ({ date: d, region: 'ALL', event: 'festival', note: 'Sample festival' }));
  const trends: TrendsPoint[] = [];
  const meta: MetaRow[] = [];

  for (const reg of STARTING_REGIONS) {
    const level = REGION_LEVEL[reg.trendsRegion];
    const half = halfOf(reg.trendsRegion);
    const raw: Record<string, { date: string; v: number }[]> = {};
    for (let d = w.baselineStart; d <= w.end; d = addDays(d, 1)) {
      const lagged = addDays(d, -LAG);
      const onLag = lagged >= w.testStart && phaseOf(lagged, half, s) === 'ON' ? 1 : 0;
      const dow = dayOfWeek(d);
      const season = dow === 0 || dow === 6 ? 1.05 : 1;
      const fest = festivals.includes(d) ? 1.25 : 1;
      const trend = 1 + 0.0004 * ((Date.parse(d) - Date.parse(w.baselineStart)) / 86400000);
      for (const [term, share] of Object.entries(TERM_SHARE)) {
        const mu = level * share * season * fest * trend * (1 + LIFT * onLag);
        const v = Math.max(0, mu * (1 + 0.035 * gauss(r)));
        (raw[term] ??= []).push({ date: d, v });
      }
    }
    // Trends scales each request so its peak is 100. All four terms share one request, so one scale.
    const peak = Math.max(...Object.values(raw).flat().map((x) => x.v));
    for (const [term, pts] of Object.entries(raw)) {
      for (const p of pts) {
        let v = Math.round((p.v / peak) * 100);
        // Thin regions: small values often come back as 0
        if (level < 15 && r() < 0.35) v = 0;
        trends.push({ region: reg.trendsRegion, date: p.date, term, value: v });
      }
    }
    // Meta delivery per city, per tactic (one ad set each)
    for (const city of reg.pixelCities) {
      const citySize = 0.6 + r() * 0.8;
      for (let d = w.baselineStart; d <= w.end; d = addDays(d, 1)) {
        const on = d >= w.testStart && phaseOf(d, half, s) === 'ON';
        for (const t of TACTICS) {
          const spend = (BAU_SPEND[t] + (on ? EXTRA_SPEND[t] : 0)) * citySize * (1 + 0.05 * gauss(r));
          const imp = spend * 6.5;
          const n = (k: number) => Math.max(0, Math.round(imp * k * (1 + 0.06 * gauss(r))));
          meta.push({
            date: d, city, region: reg.trendsRegion, campaign: 'Pixel India Q4 Meta', adSet: `${city} | ${t}`, tactic: t,
            spend: Math.round(spend), impressions: Math.round(imp), reach: Math.round(imp * 0.55),
            video_views: n(t === 'Carousel' ? 0.02 : 0.25), thruplays: n(t === 'Carousel' ? 0.005 : 0.08),
            link_clicks: n(0.006), saves: n(t === 'Carousel' ? 0.012 : 0.003), shares: n(0.002),
            comments: n(0.001), reactions: n(0.01), follows: n(0.0004),
          });
        }
      }
    }
  }

  const brandLift: BrandLiftRow[] = [
    { studyId: 'BL-1', cell: 'Extra Meta activity', metric: 'consideration', liftPct: 3.1, ciLow: 0.8, ciHigh: 5.4, startDate: w.testStart, endDate: addDays(w.cooldownStart, -1) },
    { studyId: 'BL-1', cell: 'Extra Meta activity', metric: 'awareness', liftPct: 2.0, ciLow: -0.5, ciHigh: 4.5, startDate: w.testStart, endDate: addDays(w.cooldownStart, -1) },
  ];
  const deviceLift: DeviceLiftRow[] = [
    { studyId: 'DL-1', cell: 'Reels', metric: 'iPhone to Pixel switchers (index)', liftValue: 1.8, ciLow: 0.4, ciHigh: 3.2, startDate: w.testStart, endDate: addDays(w.cooldownStart, -1) },
    { studyId: 'DL-1', cell: 'Carousel', metric: 'iPhone to Pixel switchers (index)', liftValue: 2.4, ciLow: 0.9, ciHigh: 3.9, startDate: w.testStart, endDate: addDays(w.cooldownStart, -1) },
  ];
  const budget: BudgetRow[] = TACTICS.map((t) => ({
    weekStart: w.testStart, channel: 'Meta', tactic: t, weeklyBudgetInr: { Reels: 1500000, Carousel: 1000000, Stories: 800000 }[t],
  }));

  return {
    label: 'SAMPLE DATA: made-up numbers until real Google Trends and Meta data are loaded', regions: STARTING_REGIONS, groups, trends, meta, brandLift, deviceLift, budget,
    calendar, trendsResolution: 'daily',
  };
}
