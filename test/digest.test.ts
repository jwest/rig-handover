import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/index.js';

const dirs: string[] = [];
function runsDirWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs, sorted by job, and counts the 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('folds each job into one row', () => {
    const row = (job: string) => night?.rows.find((r) => r.job === job);
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(row('lane/sync')).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held' });
    expect(row('notes/backup')).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(row('rig/rotate-logs')).toMatchObject({ owner: 'lane-07', lastError: null });
  });

  it('keeps times exactly as in the log, offset included', () => {
    const sync = night?.rows.find((r) => r.job === 'lane/sync');
    expect(sync?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync?.lastAt).toBe('2026-10-29T05:00:04+01:00');
  });

  it('keeps a row whose owner is null', () => {
    expect(night?.rows.find((r) => r.job === 'digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok' });
  });
});

describe('readNight edge cases', () => {
  it('returns null for a night with no file (page: 404)', () => {
    expect(readNight(runsDirWith({}), '2026-10-30')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    const dir = runsDirWith({ 'x.jsonl': '' });
    expect(readNight(dir, 'x')).toBeNull();
    expect(readNight(dir, '../runs/2026-10-28')).toBeNull();
  });

  it('returns no rows and no bad lines for an empty file (page: "nothing ran")', () => {
    const dir = runsDirWith({ '2026-10-30.jsonl': '' });
    expect(readNight(dir, '2026-10-30')).toEqual({ night: '2026-10-30', rows: [], badLines: 0 });
  });

  it('ignores blank lines', () => {
    const dir = runsDirWith({ '2026-10-30.jsonl': '\n\n  \n' });
    expect(readNight(dir, '2026-10-30')).toEqual({ night: '2026-10-30', rows: [], badLines: 0 });
  });

  it('keeps a null owner and counts lines of the wrong shape as bad', () => {
    const dir = runsDirWith({
      '2026-10-30.jsonl': [
        '{"at":"2026-10-30T01:00:00+02:00","job":"a/job","status":"ok","owner":null}',
        '{"at":"2026-10-30T01:00:00+02:00","job":"b/job","status":"maybe","owner":"rook"}',
        '[1,2]',
        'not json',
        '',
      ].join('\n'),
    });
    expect(readNight(dir, '2026-10-30')).toEqual({
      night: '2026-10-30',
      badLines: 3,
      rows: [
        {
          job: 'a/job',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-30T01:00:00+02:00',
          lastAt: '2026-10-30T01:00:00+02:00',
        },
      ],
    });
  });
});
