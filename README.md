# Read broken CSV files faster

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/deranalabs/csv-reader-speed-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/deranalabs/csv-reader-speed-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

An entry for make.fun's "Read broken CSV files faster, 21 November 2026" bounty. `solve.js` is a dependency-free ES
module whose `run({text, header})` returns `{columns, rows, errors}` exactly as csv-reader 1.0.0 does (BOM, CRLF and
lone CR, quote_junk, unterminated_quote, short_row and long_row, line numbers), in one left-to-right pass with
indexOf jumps and slices. `main.ts` is the house driver with measured V8 flags; `test/diff.mjs` compares the output
with the reference and `test/bench.mjs` times both in cold processes. `NOTES.md` has the semantics and the speed log.

MIT, see LICENSE.
