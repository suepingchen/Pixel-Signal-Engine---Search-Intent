import { Region, Settings } from './types';

/** Starting values. Every one is editable in Settings; lengths and method to agree with MSMO. */
export const DEFAULT_SETTINGS: Settings = {
  onWeeks: 2,
  offWeeks: 2,
  washoutDays: 3,
  baselineWeeks: 12,
  testWeeks: 8,
  cooldownWeeks: 4,
  startDate: '2026-12-07',
  zeroShareMax: 0.2,
  findMinCorr: 0.4,
  findMinShare: 0.6,
  findFdr: 0.1,
  lags: [0, 1, 2, 3, 5, 7, 10, 14],
  pMax: 0.05,
  weeklyShiftCap: 0.1,
  minBoostPct: 10,
  permutations: 2000,
  // Starting terms. Avoid "pixel" on its own (cameras, pixel art). MSMO and the PMM confirm the final list, incl. local-language variants.
  searchTerms: ['google pixel', 'pixel phone', 'iphone to pixel', 'switch from iphone to android'],
};

/** Pixel's 35 campaign cities (list from the Pixel team, 22 Oct 2026) mapped to Google Trends regions. */
export const STARTING_REGIONS: Region[] = [
  { trendsRegion: 'Karnataka', group: 1, pixelCities: ['Bengaluru', 'Mysore', 'Mangalore'] },
  { trendsRegion: 'Maharashtra', group: 2, pixelCities: ['Mumbai', 'Thane', 'Pune', 'Nashik'] },
  { trendsRegion: 'Delhi', group: 3, pixelCities: ['Delhi'] },
  { trendsRegion: 'Haryana', group: 3, pixelCities: ['Gurugram', 'Faridabad'] },
  { trendsRegion: 'Uttar Pradesh', group: 3, pixelCities: ['Noida', 'Ghaziabad', 'Lucknow', 'Agra'] },
  { trendsRegion: 'Gujarat', group: 4, pixelCities: ['Surat', 'Ahmedabad', 'Vadodara'] },
  { trendsRegion: 'Andhra Pradesh', group: 5, pixelCities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Amaravati (to confirm)'] },
  { trendsRegion: 'Telangana', group: 6, pixelCities: ['Hyderabad', 'Secunderabad'] },
  { trendsRegion: 'Tamil Nadu', group: 7, pixelCities: ['Chennai', 'Coimbatore'] },
  { trendsRegion: 'Kerala', group: 8, pixelCities: ['Kochi', 'Ernakulam', 'Trivandrum', 'Kozhikode', 'Thrissur', 'Kannur'] },
  { trendsRegion: 'West Bengal', group: 9, pixelCities: ['Kolkata'] },
  { trendsRegion: 'Rajasthan', group: 10, pixelCities: ['Jaipur', 'Jodhpur', 'Bikaner'] },
  { trendsRegion: 'Chandigarh', group: 11, pixelCities: ['Chandigarh'] },
  { trendsRegion: 'Madhya Pradesh', group: 12, pixelCities: ['Indore'] },
  { trendsRegion: 'Assam', group: 13, pixelCities: ['Guwahati'] },
  { trendsRegion: 'Odisha', group: 14, pixelCities: ['Bhubaneswar'] },
];

export const DILUTION_WARNING =
  "Google Trends gives one number per state. A state's number includes towns we don't advertise in, so a real lift looks smaller.";

/** Google Trends sub-region codes. Confirm them in the connection test before relying on them. */
export const TRENDS_GEO_CODE: Record<string, string> = {
  Karnataka: 'IN-KA', Maharashtra: 'IN-MH', Delhi: 'IN-DL', Haryana: 'IN-HR', 'Uttar Pradesh': 'IN-UP', Gujarat: 'IN-GJ',
  'Andhra Pradesh': 'IN-AP', Telangana: 'IN-TG', 'Tamil Nadu': 'IN-TN', Kerala: 'IN-KL', 'West Bengal': 'IN-WB',
  Rajasthan: 'IN-RJ', Chandigarh: 'IN-CH', 'Madhya Pradesh': 'IN-MP', Assam: 'IN-AS', Odisha: 'IN-OR',
};

export const fmtP = (p: number): string => (!isFinite(p) ? 'n/a' : p < 0.001 ? '< 0.001' : p.toFixed(3));
