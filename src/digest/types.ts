// Plan morning-digest § 1. The run log reader's contract: section 2 builds against this file.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One job's night, folded from every log line that names it.
export type DigestRow = {
  job: string;
  // Owner on the job's latest line. `null` stays `null`: views render it as `—`.
  owner: string | null;
  // Lines for this job (every attempt, retries included).
  runs: number;
  // Lines with status `retry`.
  retries: number;
  // Status on the job's latest line.
  lastStatus: RunStatus;
  // Most recent `error` seen for the job (may come from an earlier retry), `null` if none.
  lastError: string | null;
  // `at` exactly as in the log, offset kept (never converted to UTC).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  // The night, `YYYY-MM-DD`.
  night: string;
  // One row per job, sorted by job.
  rows: DigestRow[];
  // Non-blank lines that didn't parse or didn't match the line shape. Counted, never thrown.
  badLines: number;
};

// `null`: no `runs/<night>.jsonl` (or `night` isn't `YYYY-MM-DD`) → the page answers 404.
// `{ rows: [], badLines: 0 }`: the file exists but is empty → the page renders "nothing ran".
export type ReadNight = (runsDir: string, night: string) => Night | null;
