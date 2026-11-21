// SPDX-License-Identifier: MIT
// One left-to-right pass over a CSV text that answers {columns, rows, errors} exactly as csv-reader 1.0.0 does.

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
      let c = text.charCodeAt(pos);
      if (c === 34) {
        if (fields.length === 0) firstQuoted = true;
        const open = pos;
        const openLine = line;
        pos++;
        let seg = pos;
        let closed = false;
        while (pos < n) {
          c = text.charCodeAt(pos);
          if (c > 34) {
            pos++;
          } else if (c === 34) {
            if (text.charCodeAt(pos + 1) === 34) {
              acc += text.slice(seg, pos + 1);
              pos += 2;
              seg = pos;
            } else {
              acc += text.slice(seg, pos);
              pos++;
              closed = true;
              break;
            }
          } else if (c === 13) {
            acc += text.slice(seg, pos) + '\n';
            line++;
            pos += text.charCodeAt(pos + 1) === 10 ? 2 : 1;
            seg = pos;
          } else {
            if (c === 10) line++;
            pos++;
          }
        }
        if (!closed) {
          // Never closes: the quote is literal and the rest is read again as unquoted.
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recLine, row: recRow });
          acc = '"';
        } else if (pos >= n) {
          value = acc;
          scan = false;
        } else {
          c = text.charCodeAt(pos);
          if (c === 44) {
            pos++;
            value = acc;
            more = true;
            scan = false;
          } else if (c === 10) {
            pos++;
            line++;
            value = acc;
            more = false;
            scan = false;
          } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
            pos += 2;
            line++;
            value = acc;
            more = false;
            scan = false;
          } else {
            junkBase = acc.length;
          }
        }
      }
      if (scan) {
        let start = pos;
        for (;;) {
          if (pos >= n) {
            value = acc + text.slice(start, n);
            more = false;
            break;
          }
          c = text.charCodeAt(pos);
          if (c > 44) {
            pos++;
          } else if (c === 44) {
            value = acc + text.slice(start, pos);
            pos++;
            more = true;
            break;
          } else if (c === 10) {
            value = acc + text.slice(start, pos);
            pos++;
            line++;
            more = false;
            break;
          } else if (c === 13) {
            if (text.charCodeAt(pos + 1) === 10) {
              value = acc + text.slice(start, pos);
              pos += 2;
              line++;
              more = false;
              break;
            }
            errors.push({ code: 'stray_cr', line: recLine, row: recRow });
            acc += text.slice(start, pos);
            pos++;
            start = pos;
          } else {
            pos++;
          }
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
