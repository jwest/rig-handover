import type { Night } from './types.js';

// Counts are log lines per status, derived from the rows (bad lines are not counted):
// retry = sum of `retries`; fail = rows whose `lastStatus` is `fail`;
// ok = sum of `runs` - retry - fail.
export function countNight(night: Night): { ok: number; retry: number; fail: number } {
  const retry = night.rows.reduce((n, r) => n + r.retries, 0);
  const fail = night.rows.filter((r) => r.lastStatus === 'fail').length;
  const runs = night.rows.reduce((n, r) => n + r.runs, 0);
  return { ok: runs - retry - fail, retry, fail };
}
