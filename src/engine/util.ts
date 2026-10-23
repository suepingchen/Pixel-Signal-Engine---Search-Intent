// Small, dependency-free helpers: dates, seeded random numbers and basic statistics.

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

export function dayOfWeek(date: string): number {
  return new Date(date + 'T00:00:00Z').getUTCDay();
}

/** Deterministic PRNG (mulberry32) so sample data and permutation tests are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const mean = (x: number[]): number => (x.length ? x.reduce((s, v) => s + v, 0) / x.length : NaN);

export function sd(x: number[]): number {
  if (x.length < 2) return NaN;
  const m = mean(x);
  return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1));
}

export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return NaN;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Standard normal CDF (Abramowitz-Stegun 26.2.17). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

/** One-sided p-value that a correlation r (n points) is greater than 0, via Fisher z. */
export function corrPValue(r: number, n: number): number {
  if (!isFinite(r) || n < 4) return 1;
  const z = 0.5 * Math.log((1 + Math.min(r, 0.999999)) / (1 - Math.min(r, 0.999999)));
  return 1 - normCdf(z * Math.sqrt(n - 3));
}

/** Benjamini-Hochberg: returns a boolean "discovery" flag per p-value at level q. */
export function benjaminiHochberg(p: number[], q: number): boolean[] {
  const idx = p.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const m = p.length;
  let k = -1;
  idx.forEach(([v], rank) => { if (v <= ((rank + 1) / m) * q) k = rank; });
  const out = new Array(m).fill(false);
  for (let r = 0; r <= k; r++) out[idx[r][1]] = true;
  return out;
}

/** Ordinary least squares by normal equations with Gaussian elimination. Returns coefficients. */
export function ols(X: number[][], y: number[]): number[] {
  const k = X[0].length;
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < k; a++) {
      A[a][k] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) A[a][b] += X[i][a] * X[i][b];
    }
  }
  for (let a = 0; a < k; a++) A[a][a] += 1e-9; // tiny ridge so constant columns don't break the solve
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c];
    if (Math.abs(d) < 1e-12) continue;
    for (let j = c; j <= k; j++) A[c][j] /= d;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row) => row[k]);
}

export const round = (v: number, dp = 1): number => (isFinite(v) ? Math.round(v * 10 ** dp) / 10 ** dp : NaN);
