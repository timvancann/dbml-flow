// src/app/Inspector.tsx
import { useState } from 'react';
import { useAppStore } from '@/app/store';
import { classifyTable } from '@/canvas/classifyTable';
import { focusSelector } from '@/app/focus';

const seg = (name: string) => name.split('.').pop() ?? name;

export function Inspector() {
  const model = useAppStore((s) => s.model);
  const selectedTable = useAppStore((s) => s.selectedTable);
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);

  if (!model || !selectedTable) {
    return <div className="p-4 text-[12.5px] text-[var(--ink-3)]">Select a table to inspect.</div>;
  }
  const table = model.tables.get(selectedTable);
  if (!table) return <div className="p-4 text-[12.5px] text-[var(--ink-3)]">Unknown table.</div>;

  const kind = classifyTable(selectedTable);
  const outbound = model.refs.filter((r) => r.fromTable === selectedTable);
  const inbound = model.refs.filter((r) => r.toTable === selectedTable);
  const add = (name: string) => setSelector(selector ? `${selector} ${seg(name)}` : seg(name));
  const focus = (name: string) => setSelector(focusSelector(seg(name)));
  const inSelection = selector.trim().length > 0;

  // Build a set of FK column names for this table
  const fkColNames = new Set<string>(outbound.flatMap((r) => r.fromColumns));

  return (
    <div className="p-4">
      <div className="text-[10px] uppercase tracking-[.18em] text-[var(--ink-3)]">{kind} table</div>
      <button
        onClick={() => focus(selectedTable)}
        style={{ fontFamily: '"Spline Sans Mono", monospace', cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
        className="text-[14px] text-[var(--ink)] mt-[7px] mb-[2px] hover:text-[var(--dim)]"
      >{seg(selectedTable)}</button>
      <div className="text-[11.5px] text-[var(--ink-3)] mb-[14px]">{table.group ?? 'ungrouped'}</div>

      <Row k="Columns" v={String(table.columns.length)} />
      <Row k="Foreign keys" v={String(outbound.length)} />
      <Row k="Primary key" v={table.columns.some((c) => c.isPrimaryKey) ? '✓' : '—'} />
      <Row k="In selection" v={inSelection ? 'yes' : 'no'} vColor={inSelection ? 'var(--dim)' : 'var(--ink-3)'} />

      <Collapsible label="Columns" count={table.columns.length} defaultOpen={table.columns.length <= 12}>
        {table.columns.map((col) => (
          <div key={col.name} className="flex items-center gap-2 py-1 px-2 text-[12px]">
            <span style={{ fontFamily: '"Spline Sans Mono", monospace' }} className="text-[var(--ink-2)] flex-1 truncate">
              {col.name}
            </span>
            <span style={{ fontFamily: '"Spline Sans Mono", monospace', color: 'var(--ink-3)', fontSize: '11px' }} className="shrink-0">
              {col.type}
            </span>
            {col.isPrimaryKey && (
              <span style={{ color: 'var(--pk)', fontSize: '13px' }} title="Primary key">⚷</span>
            )}
            {fkColNames.has(col.name) && (
              <span style={{ color: 'var(--fact)', fontSize: '13px' }} title="Foreign key">⌖</span>
            )}
          </div>
        ))}
      </Collapsible>

      {outbound.length > 0 && (
        <Collapsible label="Foreign keys" count={outbound.length} defaultOpen>
          {outbound.map((r, i) => (
            <button
              key={i}
              onClick={() => add(r.toTable)}
              className="flex items-center gap-2 w-full text-left text-[12px] text-[var(--ink-2)] py-1.5 px-2 rounded-md hover:bg-[var(--panel-2)]"
              style={{ fontFamily: '"Spline Sans Mono", monospace' }}
            >
              <span style={{ color: 'var(--fact)' }}>{r.fromColumns.join(', ')}</span>
              <span className="text-[var(--ink-3)]">→</span>
              <span className="truncate">{seg(r.toTable)}</span>
            </button>
          ))}
        </Collapsible>
      )}

      {inbound.length > 0 && <RefList title="Referenced by (toward facts)" arrow="←" refs={inbound.map((r) => r.fromTable)} onClick={add} />}
    </div>
  );
}

function Collapsible({ label, count, defaultOpen, children }: { label: string; count: number; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left text-[10px] uppercase tracking-wider text-[var(--ink-3)] mb-1 hover:text-[var(--ink-2)]"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>{label} ({count})</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function Row({ k, v, vColor }: { k: string; v: string; vColor?: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-[var(--line)] text-[12.5px]">
      <span className="text-[var(--ink-3)]">{k}</span>
      <span style={{ fontFamily: '"Spline Sans Mono", monospace', color: vColor ?? 'var(--ink-2)' }}>{v}</span>
    </div>
  );
}

function RefList({ title, arrow, refs, onClick }: { title: string; arrow: string; refs: string[]; onClick: (n: string) => void }) {
  return (
    <div className="mt-3.5">
      <h4 className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mb-2">{title}</h4>
      {refs.map((name, i) => (
        <button key={`${name}-${i}`} onClick={() => onClick(name)} className="flex items-center gap-2 w-full text-left text-[12px] text-[var(--ink-2)] py-1.5 px-2 rounded-md hover:bg-[var(--panel-2)]" style={{ fontFamily: '"Spline Sans Mono", monospace' }}>
          <span className="text-[var(--fact)]">{arrow}</span>
          <span className="truncate">{name.split('.').pop()}</span>
        </button>
      ))}
    </div>
  );
}
