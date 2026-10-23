import { BrandLiftRow, BudgetRow, CalendarRow, DeviceLiftRow, MetaRow, TrendsPoint } from './types';

/** Minimal CSV parser (quoted fields, commas, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

function records(text: string): Record<string, string>[] {
  const [head, ...body] = parseCsv(text);
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const num = (v: string) => { const n = Number(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };

/**
 * Google Trends "Interest over time" export. Skips the lines Trends adds above the header,
 * reads the date column and one column per term ("google pixel: (Maharashtra)"), converts "<1" to 0.5.
 * Also accepts a tidy file with columns geo/region, date, term, index_value/value.
 */
export function parseTrends(text: string, regionHint?: string): TrendsPoint[] {
  const rows = parseCsv(text);
  const h = rows.findIndex((r) => /^(day|week|date)$/i.test((r[0] ?? '').trim()) || /^(geo|region)$/i.test((r[0] ?? '').trim()));
  if (h < 0) throw new Error('Could not find the header row (Day/Week/Date) in the Trends file.');
  const head = rows[h].map((x) => x.trim());
  if (/^(geo|region)$/i.test(head[0])) {
    const keys = head.map((x) => x.toLowerCase());
    const gi = keys.findIndex((k) => k === 'geo' || k === 'region');
    const di = keys.indexOf('date'), ti = keys.indexOf('term');
    const vi = keys.findIndex((k) => k === 'index_value' || k === 'value');
    return rows.slice(h + 1).map((r) => ({ region: r[gi], date: r[di], term: r[ti].toLowerCase(), value: r[vi] === '<1' ? 0.5 : num(r[vi]), belowOne: r[vi] === '<1' }));
  }
  const out: TrendsPoint[] = [];
  const cols = head.slice(1).map((c) => {
    const m = c.match(/^(.*?):\s*\((.*)\)\s*$/);
    return { term: (m ? m[1] : c).trim().toLowerCase(), region: (m ? m[2] : regionHint ?? 'Unknown').trim() };
  });
  for (const r of rows.slice(h + 1)) {
    const date = r[0].trim();
    cols.forEach((c, j) => {
      const raw = (r[j + 1] ?? '').trim();
      out.push({ region: regionHint ?? c.region, date, term: c.term, value: raw === '<1' ? 0.5 : num(raw), belowOne: raw === '<1' });
    });
  }
  return out;
}

export function parseMeta(text: string, cityToRegion: Record<string, string>): MetaRow[] {
  return records(text).map((r) => ({
    date: r.date, city: r.city, region: r.region || cityToRegion[r.city] || 'Unknown', campaign: r.campaign, adSet: r.ad_set, tactic: r.tactic,
    spend: num(r.spend), impressions: num(r.impressions), reach: num(r.reach), video_views: num(r.video_views), thruplays: num(r.thruplays),
    link_clicks: num(r.link_clicks), saves: num(r.saves), shares: num(r.shares), comments: num(r.comments), reactions: num(r.reactions), follows: num(r.follows),
  }));
}

export const parseBrandLift = (t: string): BrandLiftRow[] => records(t).map((r) => ({
  studyId: r.study_id, cell: r.cell_or_tactic, metric: r.metric as BrandLiftRow['metric'], liftPct: num(r.lift_pct), ciLow: num(r.ci_low), ciHigh: num(r.ci_high), startDate: r.start_date, endDate: r.end_date,
}));
export const parseDeviceLift = (t: string): DeviceLiftRow[] => records(t).map((r) => ({
  studyId: r.study_id, cell: r.cell_or_tactic, metric: r.metric, liftValue: num(r.lift_value), ciLow: num(r.ci_low), ciHigh: num(r.ci_high), startDate: r.start_date, endDate: r.end_date,
}));
export const parseBudget = (t: string): BudgetRow[] => records(t).map((r) => ({ weekStart: r.week_start, channel: r.channel, tactic: r.tactic, weeklyBudgetInr: num(r.weekly_budget_inr) }));
export const parseCalendar = (t: string): CalendarRow[] => records(t).map((r) => ({ date: r.date, region: r.region || r.city || 'ALL', event: r.event as CalendarRow['event'], note: r.note }));
