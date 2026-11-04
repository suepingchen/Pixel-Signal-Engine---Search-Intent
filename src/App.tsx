import { useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, DILUTION_WARNING, TRENDS_GEO_CODE, fmtP } from './engine/config';
import { sampleDataset } from './engine/sample';
import { buildGroups, phaseOf, scheduleRows, windowOf } from './engine/schedule';
import { regionSeries } from './engine/series';
import { prove } from './engine/prove';
import { find } from './engine/find';
import { sizing } from './engine/sizing';
import { act } from './engine/act';
import { Approval, readoutMarkdown, toCsv } from './engine/readout';
import { parseBrandLift, parseBudget, parseCalendar, parseDeviceLift, parseMeta, parseTrends } from './engine/csv';
import { Dataset, Settings } from './engine/types';
import { Btn, Card, Note, Table, download } from './components/ui';
import { Legend, SeriesChart } from './components/Chart';

const TABS = ['1. Setup', '2. Search data', '3. Sizing check', '4. Find', '5. Prove', '6. Act', '7. Weekly readout'] as const;
const pct = (v: number) => (isFinite(v) ? `${v.toFixed(1)}%` : 'n/a');
const now = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ds, setDs] = useState<Dataset>(() => sampleDataset(DEFAULT_SETTINGS));
  const [lock, setLock] = useState<{ name: string; at: string } | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [msg, setMsg] = useState('');

  const series = useMemo(() => regionSeries(ds, settings), [ds, settings]);
  const prv = useMemo(() => prove(ds, settings), [ds, settings]);
  const fnd = useMemo(() => find(ds, settings), [ds, settings]);
  const siz = useMemo(() => sizing(ds, settings), [ds, settings]);
  const a = useMemo(() => act(ds.budget, fnd, prv, settings, ds.brandLift), [ds, fnd, prv, settings]);
  const md = useMemo(() => readoutMarkdown(ds, prv, fnd, siz, a, approvals), [ds, prv, fnd, siz, a, approvals]);
  const w = windowOf(settings);
  const typicalDelay = fnd.shortlist.length ? Math.max(...fnd.shortlist.map((x) => x.lag)) : 0;

  async function upload(kind: string, file: File) {
    const text = await file.text();
    const cityToRegion = Object.fromEntries(ds.regions.flatMap((r) => r.pixelCities.map((c) => [c, r.trendsRegion])));
    try {
      const base: Dataset = ds.label === 'Uploaded data' ? ds : { ...ds, label: 'Uploaded data', trends: [], meta: [], brandLift: [], deviceLift: [], budget: [], calendar: [] };
      const next: Dataset = { ...base };
      if (kind === 'trends') next.trends = [...base.trends, ...parseTrends(text)];
      if (kind === 'meta') next.meta = parseMeta(text, cityToRegion);
      if (kind === 'brand') next.brandLift = parseBrandLift(text);
      if (kind === 'device') next.deviceLift = parseDeviceLift(text);
      if (kind === 'budget') next.budget = parseBudget(text);
      if (kind === 'calendar') next.calendar = parseCalendar(text);
      setDs(next);
      setMsg(`Loaded ${file.name}`);
    } catch (e) {
      setMsg(`Could not read ${file.name}: ${(e as Error).message}`);
    }
  }

  async function connectionTest() {
    setMsg('Testing connectors...');
    try {
      const r = await fetch('/api/trends/test', { method: 'POST' });
      const j = (await r.json()) as { results: { connector: string; ok: boolean; detail: string }[] };
      setMsg(j.results.map((x) => `${x.ok ? 'OK' : 'Not ready'}: ${x.connector} (${x.detail})`).join(' | '));
    } catch {
      setMsg('Connection test failed: is the server running?');
    }
  }

  const setNum = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (lock) return;
    const v = k === 'startDate' ? e.target.value : Number(e.target.value);
    setSettings({ ...settings, [k]: v });
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Pixel Signal Engine</h1>
            <p className="text-xs text-slate-500">Find which Meta activity turns consideration into Pixel searches, prove it with a fair test, and move money there.</p>
          </div>
          <span className={`text-[11px] font-bold px-2 py-1 rounded ${ds.label.startsWith('SAMPLE') ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>{ds.label}</span>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto" aria-label="Steps">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t}</button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {msg && <Note>{msg}</Note>}

        {tab === '1. Setup' && (
          <>
            <Card title="Test design (starting values, to agree with Kuang's team, MSMO)" right={lock ? <span className="text-[11px] text-emerald-700 font-semibold">Locked by {lock.name}, {lock.at}</span> : null}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {([['startDate', 'First ON day'], ['onWeeks', 'On weeks'], ['offWeeks', 'Off weeks'], ['washoutDays', 'Washout days'], ['baselineWeeks', 'Baseline weeks'], ['testWeeks', 'Test weeks'], ['cooldownWeeks', 'Cooldown weeks'], ['permutations', 'Reshuffles']] as [keyof Settings, string][]).map(([k, label]) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-slate-600">{label}</span>
                    <input disabled={!!lock} className="border border-slate-300 rounded px-2 py-1" type={k === 'startDate' ? 'date' : 'number'} value={String(settings[k])} onChange={setNum(k)} />
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-3">Baseline {w.baselineStart} · Test {w.testStart} to {w.cooldownStart} · Cooldown to {w.end}. Search terms: {settings.searchTerms.join(', ')}.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {!lock ? <Btn onClick={() => { const n = prompt('Your name to lock the schedule'); if (n) setLock({ name: n, at: now() }); }}>Approve and lock schedule</Btn>
                  : <Btn kind="ghost" onClick={() => { const r = prompt('Reason for unlocking (logged)'); if (r) { setLock(null); setMsg(`Unlocked: ${r} (${now()})`); } }}>Unlock (reason needed)</Btn>}
                <Btn kind="ghost" onClick={() => download('schedule.csv', toCsv(scheduleRows(ds, settings).map((r) => ({ group_id: r.groupId, region: r.region, city: r.city, date: r.date, phase: r.phase, half: r.half }))))}>Download schedule.csv</Btn>
                <Btn kind="ghost" onClick={() => download('city_groups.csv', toCsv(ds.regions.flatMap((r) => r.pixelCities.map((c) => ({ city: c, group_id: r.group, state: r.trendsRegion, reason: r.group === 3 ? 'Delhi NCR spans Delhi, Haryana and Uttar Pradesh' : 'Google Trends gives data by state' })))))}>Download city_groups.csv</Btn>
              </div>
            </Card>

            <Card title="City groups: Pixel's 35 campaign cities, grouped by state (Google Trends gives one number per state)">
              <Table head={['Group', 'Half', 'Trends region(s)', 'Pixel cities', 'Readable?']} rows={ds.groups.map((g) => [
                g.id, g.half, g.regions.map((r) => `${r} (${TRENDS_GEO_CODE[r] ?? '?'})`).join(', '), g.cities.join(', '),
                g.regions.map((r) => (series.find((s) => s.region === r)?.thin ? `${r}: too thin (${Math.round((series.find((s) => s.region === r)?.zeroShare ?? 1) * 100)}% zero days)` : `${r}: yes`)).join('; '),
              ])} />
              <div className="mt-3"><Note tone="warn">{DILUTION_WARNING} Each region keeps its own Trends line; values are never added across regions.</Note></div>
            </Card>

            <Card title="Schedule (each row is one city group)">
              <div className="overflow-x-auto">
                <div className="min-w-[640px] space-y-1">
                  {ds.groups.map((g) => (
                    <div key={g.id} className="flex items-center gap-2">
                      <span className="w-20 text-[11px] text-slate-600 shrink-0">Group {g.id} ({g.half})</span>
                      <div className="flex flex-1 h-4">
                        {Array.from({ length: 7 * (settings.testWeeks + settings.cooldownWeeks) }, (_, i) => {
                          const d = new Date(Date.parse(w.testStart) + i * 86400000).toISOString().slice(0, 10);
                          const p = phaseOf(d, g.half, settings);
                          const c = p === 'ON' ? 'bg-blue-500' : p === 'WASHOUT' ? 'bg-slate-300' : p === 'COOLDOWN' ? 'bg-amber-200' : 'bg-slate-100';
                          return <div key={i} className={`flex-1 ${c}`} title={`${d}: ${p}`} />;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Blue = on weeks (extra Meta). Grey = washout (first {settings.washoutDays} days of an off period, not read). Light = off. Amber = cooldown.</p>
            </Card>

            <Card title="Data" right={<Btn kind="ghost" onClick={connectionTest}>Run connection test</Btn>}>
              <div className="grid md:grid-cols-3 gap-3 text-xs">
                {([['trends', 'Google Trends CSV (export per state, or tidy geo,date,term,index_value)'], ['meta', 'meta_delivery.csv'], ['brand', 'brand_lift.csv'], ['device', 'device_lift.csv'], ['budget', 'budget_plan.csv'], ['calendar', 'calendar.csv']] as [string, string][]).map(([k, label]) => (
                  <label key={k} className="flex flex-col gap-1 border border-dashed border-slate-300 rounded-lg p-3">
                    <span className="font-semibold text-slate-700">{label}</span>
                    <input type="file" accept=".csv,text/csv" onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) upload(k, f); }} />
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Btn kind="ghost" disabled={!!lock} onClick={() => { setDs(sampleDataset(settings)); setMsg('Sample data restored'); }}>Use sample data</Btn>
                <Btn kind="ghost" disabled={!!lock} onClick={() => setDs({ ...ds, groups: buildGroups(ds.regions) })}>Re-balance halves</Btn>
                {lock && <span className="text-[11px] text-slate-500 self-center">City groups and halves are locked. Unlock (with a logged reason) to change them.</span>}
              </div>
            </Card>
          </>
        )}

        {tab === '2. Search data' && (
          <Card title="Pixel search index by Trends region (each region on its own scale)" right={<Legend />}>
            <div className="mb-3"><Note tone="warn">{DILUTION_WARNING}</Note></div>
            <div className="grid md:grid-cols-2 gap-4">
              {series.map((s) => {
                const half = ds.groups.find((g) => g.id === s.group)?.half ?? 'A';
                return (
                  <div key={s.region} className="border border-slate-100 rounded-lg p-2">
                    <div className="flex justify-between text-xs mb-1">
                      <b>{s.region} · group {s.group} ({half})</b>
                      <span className={s.thin ? 'text-amber-700' : 'text-slate-500'}>{s.thin ? `Too thin to read (${Math.round(s.zeroShare * 100)}% zero days)` : `${ds.trendsResolution} · ${s.dates.length} days`}</span>
                    </div>
                    <SeriesChart dates={s.dates} values={s.values} phases={s.dates.map((d) => phaseOf(d, half, settings))} />
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {tab === '3. Sizing check' && (
          <Card title="Sizing check (before launch)">
            <p className="text-sm text-slate-800 mb-3">{siz.message}</p>
            <Note>How it works: we pretend the on/off schedule started on many past dates, when nothing happened, and measure the fake lift each time. A real lift has to be clearly bigger than those chance lifts. Spread of chance lifts: {pct(siz.placeboSdPct)}.</Note>
          </Card>
        )}

        {tab === '4. Find' && (
          <Card title="Find: early clues (candidates, not proven)">
            <p className="text-xs text-slate-600 mb-3">A signal is kept only if all four checks pass: correlation of {settings.findMinCorr} or more; holds in at least {settings.findMinShare * 100}% of regions; holds in both halves of the test; survives a false-alarm correction (Benjamini-Hochberg at {settings.findFdr * 100}%). Delays tested: {settings.lags.join(', ')} days.</p>
            {typicalDelay > settings.washoutDays && <div className="mb-3"><Note tone="warn">Searches rise about {typicalDelay} days after Meta activity, longer than the {settings.washoutDays}-day washout. Consider a longer washout (agree with MSMO).</Note></div>}
            <Table head={['Tactic', 'Metric', 'Typical delay', 'Average correlation', 'Strong in regions']} rows={fnd.shortlist.map((x) => [x.tactic, x.metric, `${x.lag} days`, x.meanR.toFixed(2), `${Math.round(x.shareStrong * 100)}%`])} />
            {!fnd.shortlist.length && <p className="text-xs text-slate-500 mt-2">No signal passed all four checks yet.</p>}
          </Card>
        )}

        {tab === '5. Prove' && (
          <>
            <Card title="Prove: is the search lift real, or luck?">
              <div className="flex flex-wrap items-end gap-6">
                <div><div className="text-[11px] text-slate-500">Result</div><div className={`text-xl font-bold ${prv.status === 'Validated' ? 'text-emerald-700' : 'text-slate-700'}`}>{prv.status}</div></div>
                <div><div className="text-[11px] text-slate-500">Search intent lift (on vs off weeks)</div><div className="text-xl font-bold">{pct(prv.pooledLiftPct)}</div></div>
                <div><div className="text-[11px] text-slate-500">p-value ({prv.permutations} reshuffles)</div><div className="text-xl font-bold">{fmtP(prv.pValue)}</div></div>
                <div><div className="text-[11px] text-slate-500">Smallest reliable lift</div><div className="text-xl font-bold">{pct(siz.mdePct)}</div></div>
              </div>
              <p className="text-xs text-slate-600 mt-3">Validated only if the lift is above 0 and p is below {settings.pMax}. Each region is compared only with itself, allowing for its own trend, day of week and events; washout and cooldown days are left out. Starting method, to confirm with MSMO.</p>
              <div className="mt-3"><Note tone="warn">{DILUTION_WARNING}</Note></div>
              {prv.excluded.length > 0 && <p className="text-xs text-amber-800 mt-2">Left out of the read (too many zero days): {prv.excluded.join(', ')}.</p>}
            </Card>
            <Card title="By region">
              <Table head={['Region', 'Group', 'Half', 'Lift', 'Off-week average', 'Days read']} rows={prv.regions.map((r) => [r.region, r.group, r.half, pct(r.liftPct), isFinite(r.offMean) ? r.offMean.toFixed(1) : 'n/a', r.n])} />
            </Card>
            <Card title="Read alongside (as provided by Meta and the clean room, not rebuilt)">
              <Table head={['Source', 'Cell', 'Metric', 'Lift', 'Range', 'Counts as support?']} rows={[
                ...ds.brandLift.map((b) => ['Meta Brand Lift', b.cell, b.metric, `${b.liftPct}%`, `${b.ciLow} to ${b.ciHigh}`, b.ciLow > 0 ? 'Yes' : 'No (range includes 0)']),
                ...ds.deviceLift.map((d) => ['Device lift (directional)', d.cell, d.metric, String(d.liftValue), `${d.ciLow} to ${d.ciHigh}`, 'Directional only']),
              ]} />
            </Card>
          </>
        )}

        {tab === '6. Act' && (
          <Card title="Act: budget moves (Media Lead approval needed; nothing is pushed to Meta)">
            <p className="text-xs text-slate-600 mb-3">{a.note} Total before {a.totalBefore.toLocaleString('en-IN')} INR, after {a.totalAfter.toLocaleString('en-IN')} INR.</p>
            <Table head={['Tactic', 'Current (INR/week)', 'Proposed', 'Change', 'Why', 'Decision']} rows={a.moves.map((m) => {
              const ap = approvals.find((x) => x.tactic === m.tactic);
              return [m.tactic, m.current.toLocaleString('en-IN'), m.proposed.toLocaleString('en-IN'), `${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(1)}%`, m.reason,
                ap ? `${ap.decision} by ${ap.name}` : m.changePct === 0 ? '-' : (
                  <span className="flex gap-1">
                    {(['Approved', 'Rejected'] as const).map((d) => (
                      <Btn key={d} kind={d === 'Approved' ? 'primary' : 'ghost'} onClick={() => {
                        const name = prompt('Media Lead name'); if (!name) return;
                        const comment = prompt('Comment (optional)') ?? '';
                        setApprovals([...approvals, { tactic: m.tactic, decision: d, name, comment, at: now() }]);
                      }}>{d === 'Approved' ? 'Approve' : 'Reject'}</Btn>
                    ))}
                  </span>
                )];
            })} />
          </Card>
        )}

        {tab === '7. Weekly readout' && (
          <Card title="Weekly readout (built in code from computed numbers only)" right={
            <div className="flex flex-wrap gap-2">
              <Btn kind="ghost" onClick={() => download('readout.md', md, 'text/markdown')}>readout.md</Btn>
              <Btn kind="ghost" onClick={() => download('validated_signals.csv', toCsv(fnd.shortlist.map((x) => ({ tactic: x.tactic, metric: x.metric, delay_days: x.lag, mean_r: x.meanR.toFixed(3), share_regions: x.shareStrong.toFixed(2), prove_status: prv.status }))))}>validated_signals.csv</Btn>
              <Btn kind="ghost" onClick={() => download('budget_plan.csv', toCsv(a.moves.map((m) => ({ tactic: m.tactic, current_inr: m.current, proposed_inr: m.proposed, change_pct: m.changePct.toFixed(1) }))))}>budget_plan.csv</Btn>
              <Btn kind="ghost" onClick={() => download('approval_log.csv', toCsv(approvals.map((x) => ({ ...x }))))}>approval_log.csv</Btn>
            </div>
          }>
            <pre className="whitespace-pre-wrap text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">{md}</pre>
          </Card>
        )}
      </main>
    </div>
  );
}
