import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/index.js';

const dirs: string[] = [];
function appWith(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const line = (job: string, status: string, at: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ job, status, at, ...extra });

const log = [
  line('zeta/job', 'ok', '2026-10-28T02:00:00+01:00', { owner: 'rook' }),
  line('alpha/job', 'retry', '2026-10-28T01:00:00+01:00', { owner: 'ann', error: 'boom' }),
  line('alpha/job', 'fail', '2026-10-28T01:10:00+01:00', { owner: 'ann', error: 'boom' }),
].join('\n') + '\n';

describe('GET /digest/:night', () => {
  it('renders a row per job with warn on failures', async () => {
    const res = await appWith({ '2026-10-28.jsonl': log }).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest 2026-10-28');
    expect(html).toContain('data-job="alpha/job"');
    expect(html).toContain('data-job="zeta/job"');
    expect(html).toMatch(/<tr[^>]*data-job="alpha\/job"[^>]*class="warn"|<tr[^>]*class="warn"[^>]*data-job="alpha\/job"/);
    expect(html).not.toMatch(/<tr[^>]*data-job="zeta\/job"[^>]*warn/);
    expect(html).not.toContain('nothing ran');
  });

  it('404s with a page when there is no file', async () => {
    const res = await appWith({}).request('/digest/2026-10-27');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for 2026-10-27');
  });

  it('says nothing ran for an empty file, without a table', async () => {
    const res = await appWith({ '2026-10-28.jsonl': '' }).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
  });

  it('counts bad lines and still renders', async () => {
    const res = await appWith({ '2026-10-28.jsonl': `${log}not json\n` }).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 bad line(s) skipped');
    expect(html).toContain('data-job="alpha/job"');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the Night object', async () => {
    const res = await appWith({ '2026-10-28.jsonl': `${log}oops\n` }).request('/api/digest/2026-10-28');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job', 'zeta/job']);
    expect(body.rows[0]?.retries).toBe(1);
    expect(body.rows[0]?.lastStatus).toBe('fail');
  });

  it('404s with an error body when there is no file', async () => {
    const res = await appWith({}).request('/api/digest/2026-10-27');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 2026-10-27' });
  });

  it('returns empty rows for an empty file', async () => {
    const res = await appWith({ '2026-10-28.jsonl': '' }).request('/api/digest/2026-10-28');
    expect(await res.json()).toEqual({ night: '2026-10-28', rows: [], badLines: 0 });
  });
});

describe('page and JSON agree', () => {
  it('lists jobs in the same order', async () => {
    const app = appWith({ '2026-10-28.jsonl': log });
    const html = await (await app.request('/digest/2026-10-28')).text();
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as Night;
    const pageJobs = [...html.matchAll(/data-job="([^"]+)"/g)].map((m) => m[1]);
    expect(pageJobs).toEqual(body.rows.map((r) => r.job));
  });
});
