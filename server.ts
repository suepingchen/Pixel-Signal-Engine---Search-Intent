import 'dotenv/config';
import express from 'express';
import path from 'path';

// Express server: serves the app and makes all external API calls, so no key ever reaches the browser.
// No AI model is called. Search data comes from Google Trends (SerpApi, the official alpha API, or CSV upload in the app).

const app = express();
app.use(express.json({ limit: '1mb' }));
const PORT = Number(process.env.PORT ?? 3000);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, serpapi: Boolean(process.env.SERPAPI_API_KEY), officialTrendsApi: Boolean(process.env.GOOGLE_TRENDS_API_ENDPOINT) });
});

interface SerpPoint { date: string; timestamp?: string; values: { query: string; value: string; extracted_value?: number }[] }

/** Fetch one Trends time series request via SerpApi: up to 5 terms, one geo, one date range. */
async function serpTrends(terms: string[], geo: string, from: string, to: string) {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new Error('SERPAPI_API_KEY is not set on the server.');
  const u = new URL('https://serpapi.com/search.json');
  u.searchParams.set('engine', 'google_trends');
  u.searchParams.set('data_type', 'TIMESERIES');
  u.searchParams.set('q', terms.slice(0, 5).join(','));
  u.searchParams.set('geo', geo);
  u.searchParams.set('date', `${from} ${to}`);
  u.searchParams.set('tz', '-330');
  u.searchParams.set('api_key', key);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`SerpApi returned HTTP ${r.status}`);
  const j = (await r.json()) as { interest_over_time?: { timeline_data?: SerpPoint[] }; error?: string };
  if (j.error) throw new Error(j.error);
  const rows = j.interest_over_time?.timeline_data ?? [];
  // Check SerpApi's current docs if fields change; the parser below expects timeline_data[].values[].
  const points = rows.flatMap((row) => {
    const date = row.timestamp ? new Date(Number(row.timestamp) * 1000).toISOString().slice(0, 10) : row.date;
    return row.values.map((v) => ({
      date, term: v.query.toLowerCase(),
      value: v.value === '<1' ? 0.5 : Number(v.extracted_value ?? v.value), belowOne: v.value === '<1',
    }));
  });
  const resolution = rows.length > 1 && row0gap(rows) > 1 ? 'weekly' : 'daily';
  return { points, resolution, fetchedAt: new Date().toISOString(), request: { terms, geo, from, to } };
}

function row0gap(rows: SerpPoint[]): number {
  const t0 = Number(rows[0].timestamp), t1 = Number(rows[1].timestamp);
  return isFinite(t0) && isFinite(t1) ? Math.round((t1 - t0) / 86400) : 1;
}

app.post('/api/trends', async (req, res) => {
  try {
    const { terms, geo, from, to } = req.body as { terms: string[]; geo: string; from: string; to: string };
    if (!Array.isArray(terms) || !terms.length || !geo || !from || !to) return res.status(400).json({ error: 'terms, geo, from and to are required' });
    res.json(await serpTrends(terms, geo, from, to));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

/** Connection test: one small request per available connector. */
app.post('/api/trends/test', async (_req, res) => {
  const results: { connector: string; ok: boolean; detail: string }[] = [];
  if (process.env.SERPAPI_API_KEY) {
    try {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
      const r = await serpTrends(['google pixel'], 'IN-MH', from, to);
      results.push({ connector: 'SerpApi Google Trends', ok: r.points.length > 0, detail: `${r.points.length} points, ${r.resolution}, geo IN-MH accepted` });
    } catch (e) {
      results.push({ connector: 'SerpApi Google Trends', ok: false, detail: (e as Error).message });
    }
  } else results.push({ connector: 'SerpApi Google Trends', ok: false, detail: 'SERPAPI_API_KEY not set' });
  results.push({
    connector: 'Official Google Trends API (alpha)', ok: false,
    detail: process.env.GOOGLE_TRENDS_API_ENDPOINT ? 'Endpoint set; add the request format from Google’s access docs in server.ts before use' : 'Not configured (needs alpha access)',
  });
  results.push({ connector: 'CSV export from trends.google.com', ok: true, detail: 'Always available: upload in Setup' });
  res.json({ results });
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Pixel Signal Engine on http://localhost:${PORT}`));
}
start();
