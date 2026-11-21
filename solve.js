// SPDX-License-Identifier: MIT
// One left-to-right pass over a CSV text that answers {columns, rows, errors} exactly as csv-reader 1.0.0 does.

// Field ends are found with indexOf jumps. nComma, nLF and nCR cache the next comma, LF and CR at or after the point
// they were last searched from; a cache behind pos is searched again, and the one rewind (an unterminated quote)
// clears them all.

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const rows = [];
  const errors = [];
  let columns = null;
  let width = -1;
  let wantHeader = header;
  let pos = n > 0 && text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let nComma = -1;
  let nLF = -1;
  let nCR = -1;

  for (;;) {
    // Empty lines (LF, CRLF) are no records; a lone CR is left for the field reader.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos++;
        line++;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line++;
      } else break;
    }
    if (pos >= n) break;

    const recLine = line;
    const recRow = wantHeader ? null : rows.length;
    const fields = [];
    let firstQuoted = false;
    let more = false;
    do {
      let value = '';
      let acc = '';
      let scan = true;
      let junkBase = -1;
      more = false;
      if (text.charCodeAt(pos) === 34) {
        if (fields.length === 0) firstQuoted = true;
        const open = pos;
        const openLine = line;
        let seg = pos + 1;
        let closed = false;
        for (;;) {
          let q = text.indexOf('"', seg);
          if (q < 0) q = n;
          if (nLF < seg) nLF = (nLF = text.indexOf('\n', seg)) < 0 ? n : nLF;
          if (nCR < seg) nCR = (nCR = text.indexOf('\r', seg)) < 0 ? n : nCR;
          if (nLF < q || nCR < q) {
            // Line breaks inside the quotes: CRLF and lone CR are one LF, each counts a line.
            let i = seg;
            while (i < q) {
              const c = text.charCodeAt(i);
              if (c === 13) {
                acc += text.slice(seg, i) + '\n';
                line++;
                i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
                seg = i;
              } else {
                if (c === 10) line++;
                i++;
              }
            }
            // A CRLF whose LF is the quote position cannot happen: q holds a quote or is n.
          }
          if (q >= n) break;
          if (text.charCodeAt(q + 1) === 34) {
            acc += text.slice(seg, q + 1);
            seg = q + 2;
          } else {
            acc += text.slice(seg, q);
            pos = q + 1;
            closed = true;
            break;
          }
        }
        if (!closed) {
          // Never closes: the quote is literal and the rest is read again as unquoted.
          pos = open + 1;
          line = openLine;
          nComma = nLF = nCR = -1;
          errors.push({ code: 'unterminated_quote', line: recLine, row: recRow });
          acc = '"';
        } else if (pos >= n) {
          value = acc;
          scan = false;
        } else {
          const c = text.charCodeAt(pos);
          if (c === 44) {
            pos++;
            value = acc;
            more = true;
            scan = false;
          } else if (c === 10) {
            pos++;
            line++;
            value = acc;
            scan = false;
          } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
            pos += 2;
            line++;
            value = acc;
            scan = false;
          } else {
            junkBase = acc.length;
          }
        }
      }
      if (scan) {
        for (;;) {
          if (nComma < pos) nComma = (nComma = text.indexOf(',', pos)) < 0 ? n : nComma;
          if (nLF < pos) nLF = (nLF = text.indexOf('\n', pos)) < 0 ? n : nLF;
          if (nCR < pos) nCR = (nCR = text.indexOf('\r', pos)) < 0 ? n : nCR;
          if (nComma < nLF && nComma < nCR) {
            value = acc + text.slice(pos, nComma);
            pos = nComma + 1;
            more = true;
            break;
          }
          if (nCR < nLF) {
            if (nCR + 1 === nLF && nLF < n) {
              value = acc + text.slice(pos, nCR);
              pos = nLF + 1;
              line++;
              break;
            }
            errors.push({ code: 'stray_cr', line: recLine, row: recRow });
            acc += text.slice(pos, nCR);
            pos = nCR + 1;
            continue;
          }
          // nLF first, or nothing left (all three at n).
          value = acc + text.slice(pos, nLF);
          if (nLF < n) line++;
          pos = nLF + 1;
          break;
        }
        if (junkBase >= 0 && value.length > junkBase) {
          errors.push({ code: 'quote_junk', line: recLine, row: recRow });
        }
      }
      fields.push(value);
    } while (more);

    // A line of stray CRs only is left with no characters: no record (its errors stay).
    if (fields.length === 1 && !firstQuoted && fields[0] === '') continue;

    if (width < 0) width = fields.length;
    if (wantHeader) {
      columns = fields;
      wantHeader = false;
      continue;
    }
    const count = fields.length;
    if (count < width) {
      errors.push({ code: 'short_row', line: recLine, row: recRow, fields: count });
      while (fields.length < width) fields.push('');
    } else if (count > width) {
      errors.push({ code: 'long_row', line: recLine, row: recRow, extra: fields.slice(width) });
      fields.length = width;
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}

// Warm-up at import: tiny texts that reach every branch (one-byte and two-byte strings, both header values), so the
// optimizing compiler sees full type feedback and does not deoptimize on the first rare branch of a real input.
// run keeps no state between calls, so this changes no answer.
const PRIME = [
  '﻿a,b,c\r\n"d""e","f\r\ng\rh\ni",j\r\n\n\r\n\r\r\nk\r,"l"m\r,n\r\n"o" p,q,r,s\n "t",u\r\nv\n"w"\r\nx,"y"\n,,\n"z",',
  'a,b\n"c"\rd,e\n"f\n',
  'a,"b',
  '"a"',
  '﻿é,一,b\r\n"é""x",y\r\n一 z,"w"q,\r\n',
];
for (const text of PRIME) {
  run({ text, header: true });
  run({ text, header: false });
}
