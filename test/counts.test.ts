import { describe, expect, it } from 'vitest';
import { countNight, readNight } from '../src/digest/index.js';

describe('countNight', () => {
  it.each([
    ['2026-10-28', { ok: 10, retry: 4, fail: 1 }],
    ['2026-10-27', { ok: 7, retry: 0, fail: 0 }],
  ])('%s', (night, expected) => {
    const data = readNight('runs', night);
    expect(data).not.toBeNull();
    expect(countNight(data!)).toEqual(expected);
  });
});
