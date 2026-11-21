# Read broken CSV files faster

An entry for make.fun's "Read broken CSV files faster, 21 November 2026" bounty. `solve.js` is a dependency-free ES
module whose `run({text, header})` returns `{columns, rows, errors}` exactly as csv-reader 1.0.0 does (BOM, CRLF and
lone CR, quote_junk, unterminated_quote, short_row and long_row, line numbers), in one left-to-right pass with
indexOf jumps and slices. `main.ts` is the house driver with measured V8 flags; `test/diff.mjs` compares the output
with the reference and `test/bench.mjs` times both in cold processes. `NOTES.md` has the semantics and the speed log.

MIT, see LICENSE.
