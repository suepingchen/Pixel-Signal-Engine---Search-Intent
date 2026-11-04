// Core data types for the Pixel Signal Engine (search intent version).
// Everything is aggregated: per region, per city or per ad set, per day. No user-level data.

export type Half = 'A' | 'B';
export type Phase = 'BASELINE' | 'ON' | 'OFF' | 'WASHOUT' | 'COOLDOWN';

export interface Region {
  trendsRegion: string; // e.g. "Maharashtra"
  group: number; // 1..14
  pixelCities: string[];
}

export interface GroupDef {
  id: number;
  regions: string[];
  cities: string[];
  half: Half;
}

/** One Google Trends point: relative 0-100 index for one region, one term, one day. */
export interface TrendsPoint {
  region: string;
  date: string; // YYYY-MM-DD
  term: string;
  value: number;
  belowOne?: boolean; // Trends "<1", stored as 0.5
}

export interface MetaRow {
  date: string;
  city: string;
  region: string;
  campaign: string;
  adSet: string;
  tactic: string;
  spend: number;
  impressions: number;
  reach: number;
  video_views: number;
  thruplays: number;
  link_clicks: number;
  saves: number;
  shares: number;
  comments: number;
  reactions: number;
  follows: number;
}

export const META_METRICS = [
  'video_views', 'thruplays', 'link_clicks', 'saves', 'shares', 'comments', 'reactions', 'follows',
] as const;
export type MetaMetric = (typeof META_METRICS)[number];

export interface BrandLiftRow {
  studyId: string;
  cell: string;
  metric: 'awareness' | 'consideration' | 'intent';
  liftPct: number;
  ciLow: number;
  ciHigh: number;
  startDate: string;
  endDate: string;
}

export interface DeviceLiftRow {
  studyId: string;
  cell: string;
  metric: string;
  liftValue: number;
  ciLow: number;
  ciHigh: number;
  startDate: string;
  endDate: string;
}

export interface BudgetRow {
  weekStart: string;
  channel: string;
  tactic: string;
  weeklyBudgetInr: number;
}

export interface CalendarRow {
  date: string;
  region: string; // region name or "ALL"
  event: 'festival' | 'cricket' | 'launch' | 'promo';
  note: string;
}

export interface Settings {
  onWeeks: number;
  offWeeks: number;
  washoutDays: number;
  baselineWeeks: number;
  testWeeks: number;
  cooldownWeeks: number;
  startDate: string; // first ON day of the test
  zeroShareMax: number; // 0.2 = flag series with >20% zeros
  findMinCorr: number; // 0.40
  findMinShare: number; // 0.60
  findFdr: number; // 0.10
  lags: number[]; // days
  pMax: number; // 0.05
  weeklyShiftCap: number; // 0.10
  minBoostPct: number; // flag a region whose on-week Meta spend is less than this % above its off weeks
  permutations: number;
  searchTerms: string[];
}

export interface Dataset {
  label: 'SAMPLE DATA - illustrative only' | 'Uploaded data';
  regions: Region[];
  groups: GroupDef[];
  trends: TrendsPoint[];
  meta: MetaRow[];
  brandLift: BrandLiftRow[];
  deviceLift: DeviceLiftRow[];
  budget: BudgetRow[];
  calendar: CalendarRow[];
  trendsResolution: 'daily' | 'weekly';
}
