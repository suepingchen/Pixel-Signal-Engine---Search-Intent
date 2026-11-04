# Pixel Signal Engine (search intent)

Speedboat Q4 2026 pilot for Google Pixel India. The engine finds which Meta activity turns consideration into Pixel searches, proves it with a fair on/off test, and recommends budget moves.

## The test in one paragraph

Pixel's 35 campaign cities are grouped by state into 14 city groups, because Google Trends gives India search data by state, not city. Each group alternates 2 weeks with extra Meta activity (on) and 2 weeks without (off), staggered so half the groups are on while the other half are off. The first 3 days of each off period are left out of the read. Each group is compared only with itself. Main KPI: **search intent lift** (Pixel and "switch from iPhone" searches), read alongside Meta Brand Lift (consideration, awareness) and device lift (directional). About 8 test weeks plus a 4-week cooldown, after a 12-week baseline. All values are starting values, to agree with MSMO.

## Tabs

1. **Setup**: test settings, the 14 city groups (with thin-region check), the on/off schedule, approval lock, CSV uploads, connection test. Download `schedule.csv` and `city_groups.csv`.
2. **Google Trends**: one chart per state with on weeks, washout and cooldown shaded. Each region on its own scale.
3. **Sizing check**: practice runs on pre-launch data give the smallest lift the pilot can reliably detect.
4. **Find**: Meta metrics (per tactic) that rise a few days before searches. Four checks: correlation of 0.40 or more, at least 60% of regions, both halves of the test, Benjamini-Hochberg at 10%. Delays 0 to 14 days. Candidates, not proven.
5. **Prove**: on vs off weeks per region (own trend, day of week, events; washout and cooldown left out), pooled by city group, with a delivery check, permutation test that reshuffles which half each group is in. Validated only if lift > 0 and p < 0.05. Brand Lift and device lift shown alongside, as provided.
6. **Act**: after the test ends, budget moves only toward tactics with a validated search lift and an early signal; same total; max 10% change per tactic per week; Media Lead approves or rejects each move (logged). Nothing is pushed to Meta.
7. **Weekly readout**: built in code from computed numbers only. Exports `readout.md`, `validated_signals.csv`, `budget_plan.csv`, `approval_log.csv`.

## Rules the code enforces

- Meta only (Instagram, Facebook). No Gemini or other AI model calls. No database: CSV uploads in, CSV and Markdown out.
- Google Trends values are relative (0-100). Each region keeps its own series; values are never added across regions or compared between regions.
- Group 3 = Delhi, Haryana and Uttar Pradesh on one schedule, because Delhi NCR spans all three.
- Regions with more than 20% zero days are flagged and left out of the read (they still follow the schedule).
- Every result shows the state-level dilution warning.
- No budget moves during the test: the extra on-week weight stays fixed until the test and cooldown end; Act proposes moves for the next period.
- The Validated / Not confirmed call is made once, at the end. Weekly reads are labelled "Early read, not final".
- Each city group counts once in the pooled lift (Delhi, Haryana and Uttar Pradesh are averaged first).
- A delivery check flags regions where Meta under-delivered the extra weight (on-week spend less than 10% above off weeks).
- The final read uses one saved Google Trends pull, because each new pull is rescaled and re-sampled.
- Other Pixel activity (search ads, YouTube, outdoor, "Why I Switched") must run evenly across states during the test.

## Data

The app ships with clearly labelled **sample data** so every screen works. Replace it in Setup with:

| File | Columns |
|---|---|
| Google Trends | the "Interest over time" CSV export per state (header lines are skipped, `<1` becomes 0.5), or tidy `geo,date,term,index_value` |
| `meta_delivery.csv` | `date,city,region,campaign,ad_set,tactic,spend,impressions,reach,video_views,thruplays,link_clicks,saves,shares,comments,reactions,follows` |
| `brand_lift.csv` | `study_id,cell_or_tactic,metric,lift_pct,ci_low,ci_high,start_date,end_date` |
| `device_lift.csv` | `study_id,cell_or_tactic,metric,lift_value,ci_low,ci_high,start_date,end_date` |
| `budget_plan.csv` | `week_start,channel,tactic,weekly_budget_inr` |
| `calendar.csv` | `date,region,event,note` (region can be `ALL`) |

Pull Trends for baseline + test + cooldown (about 24 weeks) in one request per state so it returns daily numbers.

## Run

```bash
npm install
cp .env.example .env   # optional: SERPAPI_API_KEY for live Trends pulls
npm run dev            # http://localhost:3000
npm run check          # runs the engine on sample data and checks the acceptance rules
```

In Google AI Studio, import this repo and run it as is; no API key is needed for the sample data or CSV uploads.

## Files

- `src/engine/`: all the maths (schedule, series, sizing, find, prove, act, readout, CSV parsing, sample data)
- `src/App.tsx`, `src/components/`: the UI
- `server.ts`: Express server; Trends calls via SerpApi happen here so no key reaches the browser
- `scripts/check-engine.ts`: acceptance checks
- `docs/build_spec.json`: the full build spec
