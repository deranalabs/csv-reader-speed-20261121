// SPDX-License-Identifier: MIT
// Differential harness: compares solve.js's run with csv-reader 1.0.0 (the kit's reference) on the practice cases,
// the practice expected answers and seeded random small inputs; stops at the first difference.
//
//   node test/diff.mjs [count=5000] [seed=1]
//
// The kit path defaults to ../kits-20261121/...-kit next to this repository; MAKEFUN_KIT overrides it.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const kit = process.env.MAKEFUN_KIT ?? join(repo, '..', 'kits-20261121', 'csv-reader-speed-01-run-20261121',
  'csv-reader-speed-01-run-20261121-kit');
const { readCsv } = await import(pathToFileURL(join(kit, 'baselines/csv-reader/vendor/csv-reader/index.js')).href);
const { run } = await import(pathToFileURL(join(repo, 'solve.js')).href);

const count = Number(process.argv[2] ?? 5000);
let seed = Number(process.argv[3] ?? 1) >>> 0;

/** The first difference between a and b as a path and a note, or null: types, key order, array order, every value. */
function firstDiff(a, b, path) {
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    return `${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array vs object`;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return `${path}.length: ${a.length} != ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.join(',') !== kb.join(',')) return `${path} keys: ${ka} != ${kb}`;
  for (const k of ka) {
    const d = firstDiff(a[k], b[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

function fail(what, input, d) {
  console.error(`FAIL ${what}: ${d}`);
  if (input.text.length < 200) console.error('input:', JSON.stringify(input));
  process.exit(1);
}

// 1. Practice cases against the reference run here and against the kit's expected answers.
const cases = JSON.parse(readFileSync(join(kit, 'practice/input/cases.json'), 'utf8'));
const expected = JSON.parse(readFileSync(join(kit, 'practice/reference/expected.json'), 'utf8'));
const expectedById = new Map(expected.cases.map((c) => [c.id, c.output]));
for (const c of cases) {
  const mine = run(c.input);
  const d1 = firstDiff(mine, readCsv(c.input), 'answer');
  if (d1) fail(`${c.id} vs reference`, c.input, d1);
  const d2 = firstDiff(JSON.parse(JSON.stringify(mine)), expectedById.get(c.id), 'answer');
  if (d2) fail(`${c.id} vs expected.json`, c.input, d2);
}
console.log(`practice: ${cases.length} cases identical`);

// 2. Hand-picked edge cases.
const edges = ['', '﻿', '﻿a', 'a﻿', '\r', '\r\r', '\r\n', '\n\n', 'a\r', '\ra', '"', '""', '"""', '""""',
  '"a', 'a"', '"a"b', '"a"\r', '"a"\rb', '"a\r\nb"', '"a\rb"\nc', '"a"\r\n"b"', 'a,b\nc', 'a\nb,c,d', ',', ',,\n,',
  '"a,""b', '"a""', 'x\n"y\nz', '\r\n\r\na', '\r\r\na', 'a,"b\r', '"\r"', 'a\n\r\nb', '"a" ,b', '﻿"a"'];
let compared = 0;
for (const text of edges) {
  for (const header of [false, true]) {
    const input = { text, header };
    const d = firstDiff(run(input), readCsv(input), 'answer');
    if (d) fail('edge', input, d);
    compared++;
  }
}
console.log(`edges: ${compared} inputs identical`);

// 3. Seeded random inputs from a b , " CR LF BOM space.
function rand() {
  // mulberry32
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const alphabet = ['a', 'b', ',', '"', '\r', '\n', '﻿', ' '];
for (let i = 0; i < count; i++) {
  const len = Math.floor(rand() * 40);
  let text = '';
  for (let j = 0; j < len; j++) text += alphabet[Math.floor(rand() * alphabet.length)];
  for (const header of [false, true]) {
    const input = { text, header };
    const d = firstDiff(run(input), readCsv(input), 'answer');
    if (d) fail(`random #${i}`, input, d);
  }
}
console.log(`random: ${count} texts x 2 header values identical`);
console.log('PASS');
