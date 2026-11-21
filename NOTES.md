# Notes

## csv-reader 1.0.0 semantics (read from the kit's vendor/csv-reader/index.js)

- `text = String(input.text)`, `header = input.header === true`.
- A U+FEFF at index 0 only is skipped. Anywhere else it is a normal character.
- `line` starts at 1 and counts: LF, CRLF (outside quotes, as a record end or an empty line) and LF, CRLF, lone CR
  inside a quoted field. A stray CR outside quotes is not counted.
- Record start: skip every LF and CRLF (empty lines, each `line += 1`). A lone CR is NOT skipped there: it is read
  by the field reader as a stray CR. End of text after the skip ends the reading.
- `recordLine = line`, `recordRow = (header && columns === null) ? null : rows.length`. Every error of the record
  (stray_cr, unterminated_quote, quote_junk, short_row, long_row) carries these two.
- A field is quoted only if its very first character is `"`.
- Unquoted field: characters up to `,` (consumed, record goes on), LF (consumed, line+1, record ends), CRLF
  (consumed, line+1, record ends) or end of text. A CR not followed by LF is dropped and pushes `stray_cr` at once.
  Quotes are literal.
- Quoted field: from after the opening quote, `""` is one `"`, a lone `"` closes it, CRLF and lone CR become one LF
  (line+1), LF stays (line+1). After the closing quote:
  - end of text: field ends (END); `,`: COMMA; LF or CRLF: line break;
  - anything else (a lone CR too) is read as an unquoted field whose value starts as the quoted value; stray CRs in it
    push `stray_cr` as met; when it ends, `quote_junk` is pushed if at least one character was appended.
- No closing quote before the end of text: pos goes back to just after the opening quote, line back to the line of
  the opening quote, `unterminated_quote` is pushed, and the rest is read as an unquoted field whose value starts as
  `"`.
  Consequence: after an unterminated quote at o, every quote run after o+1 has even length, so every later quoted
  field closes; at most one such failed scan per text.
- A record whose only field is unquoted, empty and not ended by a comma is no record (a line of stray CRs only); its
  stray_cr errors stay.
- `width` = field count of the first record (header or not). Header record: `columns = fields`, nothing else.
- Data record with fewer fields: push `{code:'short_row', line, row, fields: count}` and pad with `''`; with more:
  push `{code:'long_row', line, row, extra: cutFields}` and cut to width. Error key order: code, line, row, then
  fields / extra.
- Result: `{columns: header ? (columns ?? []) : null, rows, errors}`.

## Practice set (kit practice/input/cases.json)

6 cases, 1.4 to 1.85 MB each, 10.2 MB of text, two-byte strings (CJK, Cyrillic), BOM on the header=false cases,
both LF and CRLF files, around 3% quotes, 6k to 14k rows of 9 to 15 columns, a few hundred errors per case, one
unterminated_quote in two cases.

## Speed log

`node test/bench.mjs [rounds] [impls] [flags...]`: every round is a fresh node process doing what main.ts does (house
flag `--no-incremental-marking`, import, JSON.parse of cases.json, run on each case, JSON.stringify), because the
grader starts every run cold. CPU = `process.cpuUsage()` user+system (all threads), 1 warm-up then 9 timed rounds,
trimmed mean (2 fastest and 2 slowest dropped). "work" = parse+run+stringify, "run" = the run calls only. The
reference is always timed with the house flag only, as the grader times it. Local machine: M1 Air under other load,
Node 26.7 (the grader runs Node 22: flag effects there are not measured here).

| # | change | solve work / run ms | reference work / run ms | ratio work / run |
|---|---|---|---|---|
| 1 | char-code loop, slices, one function | 404 / 281 | 999 / 820 | 0.405 / 0.343 |
| 2 | prime run at import on tiny texts reaching every branch (no more deopt loops, 4 TurboFan compiles were 64 ms CPU) | 305 / 186 | 909 / 756 | 0.335 / 0.246 |
| 3 | indexOf jumps with cached next comma, LF, CR | 292 / 173 | (same) | 0.32 / 0.23 |
| 3b | same, main.ts `--no-turbofan` (Maglev top tier) | 234 / 110 | (house flag) | 0.26 / 0.15 |
| - | tried: `new Array(width)` rows (holey) | +9 / +8 | | reverted |
| - | tried: `--single-threaded-gc`, semi-space sizes, `--always-sparkplug`, Maglev budget | no gain or worse | | dropped |
| - | tried: split(',') fast path for plain lines | not built: only 6 to 31% of the characters are on such lines | | |
| 4 | main.ts `--maglev --no-turbofan --no-parallel-scavenge` (final) | 220 / 102 | 920 / 705 | 0.239 / 0.145 |

Whole process (node start included): solve 278 ms, reference 978 ms (0.285).

Cold-start findings: warm passes take about 48 ms (TurboFan) or 57 ms (Maglev) for the practice set, a cold process
about 80 ms more; most of the remaining gap is the scavenger copying rows that stay live until JSON.stringify.
`--max-opt=2` set through setFlagsFromString had no effect; `--no-turbofan` does. `--maglev` is set explicitly so a
build with Maglev off does not drop to Sparkplug only.

## Node 22 check in the grader's image (2026-11-21, lead)

The agent tuned flags on Node 26 locally; the grader runs `node:22-slim` (22.23.4, digest from the kit's `grader/images.json`).
Re-measured there: `docker run --network none --cpus=1 --memory=1g`, `TIMEFORMAT` user+sys of the whole `node /bot/main.ts`, 1 warm-up and
9 timed rounds, trimmed mean of 5 (practice set, 6 cases).

| variant | CPU ms |
|---|---|
| reference csv-reader 1.0.0 (house driver) | 1942 |
| ours, `--maglev --no-turbofan --no-parallel-scavenge` (the agent's flags) | 654 |
| ours, house flag only | 487 |
| ours, house + `--min-semi-space-size=64` | 489 |
| ours, house + `--single-threaded` | 485 |
| ours, house + `--no-parallel-scavenge --single-threaded-gc` | 468 |
| ours, house + `--single-threaded-gc` (kept) | 462, 465 |

The Node 26 gain from Maglev did not carry over; the flag set is now the house flag plus `--single-threaded-gc`. Ratio against the reference: 0.24.
