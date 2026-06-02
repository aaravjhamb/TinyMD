'use client';

import { useMemo, useRef, useState } from 'react';

type Props = {
  entryId: string;
  initialBody: string;
  onChange: (body: string) => void;
};

type Row = { id: string; cells: string[] };

const DEFAULT_COLUMNS = ['Qty', 'Part', 'Description', 'Source', 'Cost'];

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function isSeparator(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c.replace(/\s/g, '')));
}

// Pull the first Markdown table out of the body into a columns + rows model.
function parseBom(md: string): { columns: string[]; rows: string[][] } {
  const lines = md.split('\n');
  const tableLines: string[] = [];
  let started = false;
  for (const ln of lines) {
    if (ln.trim().startsWith('|')) { tableLines.push(ln); started = true; }
    else if (started) break;
  }
  if (tableLines.length) {
    const columns = splitRow(tableLines[0]);
    let bodyLines = tableLines.slice(1);
    if (bodyLines.length && isSeparator(bodyLines[0])) bodyLines = bodyLines.slice(1);
    const rows = bodyLines.map((l) => {
      const cells = splitRow(l);
      return columns.map((_, i) => cells[i] ?? '');
    });
    if (columns.length) return { columns, rows };
  }
  return { columns: DEFAULT_COLUMNS.slice(), rows: [DEFAULT_COLUMNS.map(() => '')] };
}

function escapeCell(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function serializeBom(columns: string[], rows: Row[], total: string | null): string {
  const cols = columns.length ? columns : ['Column'];
  const header = '| ' + cols.map((c) => escapeCell(c) || ' ').join(' | ') + ' |';
  const sep = '| ' + cols.map(() => '---').join(' | ') + ' |';
  const body = rows.map(
    (r) => '| ' + cols.map((_, i) => escapeCell(r.cells[i] || '') || ' ').join(' | ') + ' |'
  );
  let md = [header, sep, ...body].join('\n');
  if (total) md += `\n\n**Total:** ${total}`;
  return md + '\n';
}

function computeTotal(columns: string[], rows: Row[]): string | null {
  const costIdx = columns.findIndex((c) => /cost|price/i.test(c));
  if (costIdx < 0) return null;
  const qtyIdx = columns.findIndex((c) => /qty|quantity|count/i.test(c));
  let sum = 0;
  let any = false;
  let currency = '';
  for (const r of rows) {
    const raw = (r.cells[costIdx] || '').trim();
    if (!raw) continue;
    const num = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
    if (isNaN(num)) continue;
    const cm = raw.match(/[$£€]/);
    if (cm && !currency) currency = cm[0];
    let qty = 1;
    if (qtyIdx >= 0) {
      const q = parseFloat((r.cells[qtyIdx] || '').replace(/[^0-9.\-]/g, ''));
      if (!isNaN(q)) qty = q;
    }
    sum += num * qty;
    any = true;
  }
  if (!any) return null;
  const rounded = Math.round(sum * 100) / 100;
  return currency ? currency + rounded : String(rounded);
}

export default function BomEditor({ initialBody, onChange }: Props) {
  const idc = useRef(0);
  const newId = () => 'r' + (++idc.current);

  const [columns, setColumns] = useState<string[]>(() => parseBom(initialBody).columns);
  const [rows, setRows] = useState<Row[]>(() =>
    parseBom(initialBody).rows.map((cells) => ({ id: newId(), cells }))
  );

  const total = useMemo(() => computeTotal(columns, rows), [columns, rows]);

  function commit(nextColumns: string[], nextRows: Row[]) {
    setColumns(nextColumns);
    setRows(nextRows);
    onChange(serializeBom(nextColumns, nextRows, computeTotal(nextColumns, nextRows)));
  }

  function setCell(rowId: string, c: number, value: string) {
    commit(
      columns,
      rows.map((r) => {
        if (r.id !== rowId) return r;
        const cells = r.cells.slice();
        cells[c] = value;
        return { ...r, cells };
      })
    );
  }

  function setHeader(c: number, value: string) {
    const next = columns.slice();
    next[c] = value;
    commit(next, rows);
  }

  function addRow() {
    commit(columns, [...rows, { id: newId(), cells: columns.map(() => '') }]);
  }

  function deleteRow(rowId: string) {
    commit(columns, rows.filter((r) => r.id !== rowId));
  }

  function addColumn() {
    commit([...columns, ''], rows.map((r) => ({ ...r, cells: [...r.cells, ''] })));
  }

  function deleteColumn(c: number) {
    if (columns.length <= 1) return;
    commit(
      columns.filter((_, i) => i !== c),
      rows.map((r) => ({ ...r, cells: r.cells.filter((_, i) => i !== c) }))
    );
  }

  return (
    <div className="bom-editor">
      <div className="bom-toolbar">
        <span className="bom-hint">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="12" y1="3" x2="12" y2="21" />
          </svg>
          Fill the grid — it saves as a Markdown table.
        </span>
        <button className="ghost-btn" onClick={addColumn}>+ Column</button>
      </div>

      <div className="bom-grid-wrap">
        <table className="bom-grid">
          <thead>
            <tr>
              <th className="bom-rownum" />
              {columns.map((col, c) => (
                <th key={c}>
                  <div className="bom-th">
                    <input
                      className="bom-head-input"
                      value={col}
                      placeholder="Column"
                      onChange={(e) => setHeader(c, e.target.value)}
                    />
                    {columns.length > 1 && (
                      <button className="bom-col-del" title="Remove column" onClick={() => deleteColumn(c)}>×</button>
                    )}
                  </div>
                </th>
              ))}
              <th className="bom-row-actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.id}>
                <td className="bom-rownum">{r + 1}</td>
                {columns.map((_, c) => (
                  <td key={c}>
                    <input
                      className="bom-cell-input"
                      value={row.cells[c] || ''}
                      onChange={(e) => setCell(row.id, c, e.target.value)}
                    />
                  </td>
                ))}
                <td className="bom-row-actions">
                  <button className="bom-row-del" title="Remove row" onClick={() => deleteRow(row.id)}>×</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="bom-empty" colSpan={columns.length + 2}>No rows yet — add one below.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bom-foot">
        <button className="bom-addrow" onClick={addRow}>
          <span className="plus">+</span> Add row
        </button>
        {total != null && (
          <div className="bom-total">Total <span>{total}</span></div>
        )}
      </div>
    </div>
  );
}
