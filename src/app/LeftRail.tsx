// src/app/LeftRail.tsx
import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '@/app/store';
import { classifyTable, type TableKind } from '@/canvas/classifyTable';
import { focusSelector } from '@/app/focus';

type Segment = 'all' | 'fact' | 'dim';

type VRow =
  | { type: 'header'; groupName: string; color: string; count: number }
  | { type: 'table'; name: string; kind: TableKind };

// Stable group colors cycling through fact/dim palette
const GROUP_COLORS = [
  'var(--dim)',
  'var(--fact)',
  '#8b9cff',
  '#e9c46a',
  'var(--dim)',
  'var(--fact)',
];

export function LeftRail() {
  const model = useAppStore((s) => s.model);
  const setSelector = useAppStore((s) => s.setSelector);
  const setSelectedTable = useAppStore((s) => s.setSelectedTable);
  const pathMode = useAppStore((s) => s.pathMode);
  const pathStart = useAppStore((s) => s.pathStart);
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<Segment>('all');
  const parentRef = useRef<HTMLDivElement>(null);

  const { rows, factCount, dimCount } = useMemo(() => {
    if (!model) return { rows: [] as VRow[], factCount: 0, dimCount: 0 };

    const q = query.toLowerCase();
    let factCount = 0;
    let dimCount = 0;

    // Count totals
    for (const name of model.tables.keys()) {
      const k = classifyTable(name);
      if (k === 'fact') factCount++;
      else if (k === 'dim') dimCount++;
    }

    const rows: VRow[] = [];

    const groupEntries = [...model.groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    let colorIdx = 0;

    for (const [groupName, group] of groupEntries) {
      const color = GROUP_COLORS[colorIdx % GROUP_COLORS.length];
      colorIdx++;

      const matchingTables = group.tables
        .filter((t) => {
          const k = classifyTable(t);
          if (segment === 'fact' && k !== 'fact') return false;
          if (segment === 'dim' && k !== 'dim') return false;
          if (q && !t.toLowerCase().includes(q) && !t.split('.').pop()?.toLowerCase().includes(q)) return false;
          return true;
        })
        .sort();

      if (matchingTables.length === 0) continue;

      rows.push({ type: 'header', groupName, color, count: matchingTables.length });
      for (const t of matchingTables) {
        rows.push({ type: 'table', name: t, kind: classifyTable(t) });
      }
    }

    // Tables with no group
    const ungrouped = [...model.tables.keys()].filter((t) => {
      const table = model.tables.get(t);
      if (table?.group) return false;
      const k = classifyTable(t);
      if (segment === 'fact' && k !== 'fact') return false;
      if (segment === 'dim' && k !== 'dim') return false;
      if (q && !t.toLowerCase().includes(q)) return false;
      return true;
    });

    if (ungrouped.length > 0) {
      rows.push({ type: 'header', groupName: 'ungrouped', color: 'var(--ink-3)', count: ungrouped.length });
      for (const t of ungrouped.sort()) {
        rows.push({ type: 'table', name: t, kind: classifyTable(t) });
      }
    }

    return { rows, factCount, dimCount };
  }, [model, query, segment]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i]?.type === 'header' ? 34 : 28),
    overscan: 12,
  });

  const focusTable = (name: string) => {
    const seg = name.split('.').pop() ?? name;
    setSelector(focusSelector(seg));
    setSelectedTable(name);
  };

  const tableCount = model?.tables.size ?? 0;
  const segLabels: { key: Segment; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'fact', label: `Facts ${factCount}` },
    { key: 'dim', label: `Dims ${dimCount}` },
  ];

  return (
    <div className="flex flex-col h-full">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${tableCount} tables…`}
        className="m-3 h-[34px] rounded-[9px] border border-[var(--line)] bg-[var(--bg-2)] px-2.5 text-[13px] text-[var(--ink-2)] outline-none"
      />
      <div className="flex gap-1 mx-3 mb-2">
        {segLabels.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSegment(key)}
            className="text-[11px] px-2 py-[3px] rounded-md"
            style={
              segment === key
                ? { color: 'var(--ink)', background: 'var(--panel-2)', border: '1px solid var(--line)' }
                : { color: 'var(--ink-3)', border: '1px solid transparent' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto px-2 pb-3">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index];
            if (!row) return null;

            if (row.type === 'header') {
              return (
                <div
                  key={vi.key}
                  className="absolute top-0 left-0 w-full flex items-center gap-2 px-2"
                  style={{
                    height: vi.size,
                    transform: `translateY(${vi.start}px)`,
                    paddingTop: 9,
                    paddingBottom: 5,
                    fontSize: 11,
                    letterSpacing: '.04em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-3)',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 2,
                      background: row.color,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span className="truncate">{row.groupName.split('.').pop() ?? row.groupName}</span>
                  <span
                    className="ml-auto"
                    style={{ fontFamily: '"Spline Sans Mono", monospace', fontSize: 10.5, color: 'var(--ink-3)' }}
                  >
                    {row.count}
                  </span>
                </div>
              );
            }

            // table row
            const { name, kind } = row;
            return (
              <button
                key={vi.key}
                onClick={() => focusTable(name)}
                className="absolute top-0 left-0 w-full flex items-center gap-2 px-2 rounded-md hover:bg-[var(--panel-2)]"
                style={{
                  height: vi.size,
                  transform: `translateY(${vi.start}px)`,
                  fontSize: 12.5,
                  color: 'var(--ink-2)',
                  fontFamily: '"Spline Sans Mono", monospace',
                }}
              >
                <span
                  className="grid place-items-center flex-none rounded"
                  style={{
                    width: 15,
                    height: 15,
                    fontSize: 9,
                    fontWeight: 700,
                    color: kind === 'fact' ? 'var(--fact)' : kind === 'dim' ? 'var(--dim)' : 'var(--ink-3)',
                    background: kind === 'fact' ? 'var(--fact-dim)' : kind === 'dim' ? 'var(--dim-dim)' : 'transparent',
                  }}
                >
                  {kind === 'fact' ? 'f' : kind === 'dim' ? 'd' : '·'}
                </span>
                <span className="truncate">{name.split('.').pop()}</span>
                {pathMode && pathStart === name && (
                  <span
                    className="ml-auto"
                    style={{
                      fontFamily: '"Spline Sans Mono", monospace',
                      fontSize: 10,
                      color: 'var(--accent)',
                      border: '1px solid rgba(139,156,255,.4)',
                      borderRadius: 5,
                      padding: '1px 5px',
                      flexShrink: 0,
                    }}
                  >
                    start
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
