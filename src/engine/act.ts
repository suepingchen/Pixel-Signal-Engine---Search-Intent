import { BrandLiftRow, BudgetRow, Settings } from './types';
import { FindResult } from './find';
import { ProveResult } from './prove';

export interface BudgetMove { tactic: string; current: number; proposed: number; changePct: number; reason: string; }
export interface ActResult { moves: BudgetMove[]; totalBefore: number; totalAfter: number; note: string; }

/**
 * Budget moves only toward Meta tactics with a validated search lift (Prove validated AND an early signal in Find),
 * and, where a Brand Lift result exists for that tactic, only if its range is above 0 (ci_low > 0).
 * Money comes from tactics with no signal. Total unchanged; no tactic moves by more than the weekly cap.
 * Moves are proposed only after the test and cooldown end (the test weight must not change mid-test), and apply to the
 * next campaign period. Nothing is pushed to Meta: every move needs a named Media Lead approval in the app.
 */
export function act(budget: BudgetRow[], fnd: FindResult, prv: ProveResult, s: Settings, brandLift: BrandLiftRow[] = []): ActResult {
  const rows = budget.filter((b) => b.channel === 'Meta');
  const totalBefore = rows.reduce((a, b) => a + b.weeklyBudgetInr, 0);
  const keep = (note: string): ActResult => ({
    moves: rows.map((b) => ({ tactic: b.tactic, current: b.weeklyBudgetInr, proposed: b.weeklyBudgetInr, changePct: 0, reason: 'No change' })),
    totalBefore, totalAfter: totalBefore, note,
  });
  // The test weight must stay fixed for the whole test, so no budget moves until the test and cooldown have ended.
  if (!prv.final) return keep('The test is still running, so no budget moves yet: the extra on-week weight stays fixed until the test and cooldown end.');
  if (prv.status !== 'Validated') return keep('Prove has not validated a search lift, so the budget stays as planned.');
  // Brand Lift for a tactic, where available, must also support it (range above 0).
  const blBlocks = (tactic: string) => {
    const rows = brandLift.filter((b) => b.cell === tactic && b.metric === 'consideration');
    return rows.length > 0 && rows.every((b) => b.ciLow <= 0);
  };
  const proven = new Set(fnd.shortlist.map((x) => x.tactic).filter((t) => !blBlocks(t)));
  const winners = rows.filter((b) => proven.has(b.tactic));
  const donors = rows.filter((b) => !proven.has(b.tactic));
  if (!winners.length || !donors.length) return keep('No tactic split between proven and unproven, so the budget stays as planned.');
  const canTake = donors.reduce((a, b) => a + b.weeklyBudgetInr * s.weeklyShiftCap, 0);
  const canGive = winners.reduce((a, b) => a + b.weeklyBudgetInr * s.weeklyShiftCap, 0);
  const move = Math.min(canTake, canGive);
  const winBase = winners.reduce((a, b) => a + b.weeklyBudgetInr, 0);
  const donBase = donors.reduce((a, b) => a + b.weeklyBudgetInr, 0);
  const moves: BudgetMove[] = rows.map((b) => {
    const isWin = proven.has(b.tactic);
    const delta = isWin ? (move * b.weeklyBudgetInr) / winBase : -(move * b.weeklyBudgetInr) / donBase;
    const proposed = Math.round(b.weeklyBudgetInr + delta);
    return {
      tactic: b.tactic, current: b.weeklyBudgetInr, proposed, changePct: ((proposed - b.weeklyBudgetInr) / b.weeklyBudgetInr) * 100,
      reason: isWin ? 'Validated search lift and an early signal in Find'
        : blBlocks(b.tactic) && fnd.shortlist.some((x) => x.tactic === b.tactic) ? 'Brand Lift for this tactic does not support it (range includes 0)' : 'No proven signal yet',
    };
  });
  // Fix rounding so the total is exactly unchanged
  const diff = totalBefore - moves.reduce((a, m) => a + m.proposed, 0);
  moves[0].proposed += diff;
  return { moves, totalBefore, totalAfter: moves.reduce((a, m) => a + m.proposed, 0), note: `Moves about ${Math.round(move).toLocaleString('en-IN')} INR a week, capped at ${s.weeklyShiftCap * 100}% per tactic.` };
}
