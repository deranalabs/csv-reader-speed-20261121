// SPDX-License-Identifier: MIT
// CPU benchmark on the practice set: every round is a fresh node process doing what main.ts does (V8 flags, import,
// JSON.parse of cases.json, run on each case, JSON.stringify), so the JIT starts cold as in the grader's runs.
//
//   node test/bench.mjs [rounds=9] [impls=solve,ref] [extra V8 flags...]
//
// 1 warm-up round, then `rounds` timed rounds per implementation, interleaved; prints the trimmed mean (2 fastest and
// 2 slowest dropped) of process.cpuUsage() over the work (parse+run+stringify) and of run alone, in ms.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setFlagsFromString } from 'node:v8';

const here = fileURLToPath(import.meta.url);
const repo = join(dirname(here), '..');
const kit = process.env.MAKEFUN_KIT ?? join(repo, '..', 'kits-20261121', 'csv-reader-speed-01-run-20261121',
  'csv-reader-speed-01-run-20261121-kit');
const modules = {
  solve: join(repo, 'solve.js'),
  ref: join(kit, 'baselines/csv-reader/solve.js'),
};

const ms = (u) => (u.user + u.system) / 1000;

if (process.argv[2] === '--child') {
  const [, , , impl, ...flags] = process.argv;
  setFlagsFromString('--no-incremental-marking');
  for (const f of flags) setFlagsFromString(f);
  const t0 = process.cpuUsage();
  const { run } = await import(pathToFileURL(modules[impl]).href);
  const cases = JSON.parse(readFileSync(join(kit, 'practice/input/cases.json'), 'utf8'));
  const t1 = process.cpuUsage();
  const answers = [];
  for (const c of cases) answers.push(run(c.input));
  const t2 = process.cpuUsage();
  const out = JSON.stringify(answers);
  const t3 = process.cpuUsage();
  console.log(JSON.stringify({ work: ms(t3) - ms(t0), run: ms(t2) - ms(t1), process: ms(t3), bytes: out.length }));
  process.exit(0);
}

const rounds = Number(process.argv[2] ?? 9);
const impls = (process.argv[3] ?? 'solve,ref').split(',');
const flags = process.argv.slice(4);

function once(impl) {
  const r = spawnSync(process.execPath, [here, '--child', impl, ...flags], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error(`${impl}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

function trimmed(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const kept = s.length > 4 ? s.slice(2, -2) : s;
  return kept.reduce((a, b) => a + b, 0) / kept.length;
}

const results = Object.fromEntries(impls.map((i) => [i, []]));
for (const i of impls) once(i); // warm-up (disk cache)
for (let r = 0; r < rounds; r++) for (const i of impls) results[i].push(once(i));

const summary = {};
for (const i of impls) {
  const w = trimmed(results[i].map((x) => x.work));
  const rn = trimmed(results[i].map((x) => x.run));
  const p = trimmed(results[i].map((x) => x.process));
  summary[i] = { work: w, run: rn, process: p };
  console.log(`${i.padEnd(6)} work ${w.toFixed(1)} ms  run ${rn.toFixed(1)} ms  process ${p.toFixed(1)} ms` +
    `  (flags: ${flags.join(' ') || 'driver default'})`);
}
if (summary.solve && summary.ref) {
  console.log(`ratio solve/ref: work ${(summary.solve.work / summary.ref.work).toFixed(3)}` +
    `  run ${(summary.solve.run / summary.ref.run).toFixed(3)}`);
}
