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

CPU time = `process.cpuUsage()` user+system, 9 timed rounds after 1 warm-up, trimmed mean (2 fastest and 2 slowest
dropped), on the practice set, `run` only unless marked. Local machine: M1 Air, Node 26 (the grader runs Node 22).

| change | solve.js ms | reference ms | ratio |
|---|---|---|---|
