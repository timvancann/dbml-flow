// src/canvas/TableNode.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TableNodeData } from '@/canvas/selectionToFlow';

export function TableNode({ data }: NodeProps & { data: TableNodeData }) {
  const accent = data.kind === 'fact' ? 'var(--fact)' : data.kind === 'dim' ? 'var(--dim)' : 'var(--line-2)';
  const accentDim = data.kind === 'fact' ? 'var(--fact-dim)' : 'var(--dim-dim)';

  return (
    <div
      style={{
        width: 248,
        borderTop: `2px solid ${accent}`,
        fontFamily: '"Spline Sans Mono", monospace',
        borderRadius: 13,
        border: `1px solid var(--line-2)`,
        borderTopColor: accent,
        borderTopWidth: 2,
        background: 'linear-gradient(180deg, var(--panel-2), var(--panel))',
        boxShadow: '0 18px 40px -22px rgba(0,0,0,.9), 0 2px 0 rgba(255,255,255,.02) inset',
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--line)]">
        <span
          className="grid place-items-center flex-none rounded-[5px] text-[10px] font-bold"
          style={{ width: 19, height: 19, color: accent, background: accentDim }}
        >
          {data.kind === 'fact' ? 'F' : data.kind === 'dim' ? 'D' : '·'}
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">{data.label}</div>
          <div className="text-[10px] text-[var(--ink-3)] truncate">{data.schema}</div>
        </div>
        <span className="ml-auto text-[9.5px] tracking-[.14em] uppercase" style={{ color: accent }}>
          {data.kind}
        </span>
      </div>

      <div className="p-[5px] flex flex-col">
        {data.columns.map((col) => (
          <div
            key={col.name}
            className="relative grid items-center gap-2 px-2 py-1 rounded-md text-[12px]"
            style={{
              gridTemplateColumns: '14px 1fr auto',
              background: col.isForeignKey ? 'rgba(240,168,104,.06)' : undefined,
            }}
          >
            {/* FK left accent bar */}
            {col.isForeignKey && (
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 5,
                  bottom: 5,
                  width: 2,
                  borderRadius: 2,
                  background: 'var(--fact)',
                }}
              />
            )}
            <span className="text-[11px]" style={{ color: col.isPrimaryKey ? 'var(--pk)' : 'var(--fact)' }}>
              {col.isPrimaryKey ? '⚷' : col.isForeignKey ? '⌖' : ''}
            </span>
            <span
              className="truncate"
              style={{ color: col.isForeignKey ? 'var(--fact)' : col.isPrimaryKey ? 'var(--ink)' : 'var(--ink-2)' }}
            >
              {col.name}
            </span>
            <span className="text-[11px] text-[var(--ink-3)]">{col.type}</span>
            {col.isForeignKey && (
              <Handle
                type="source"
                id={col.name}
                position={Position.Right}
                style={{ background: 'var(--fact)', width: 8, height: 8, border: '2px solid var(--panel-2)' }}
              />
            )}
            {col.isReferenced && (
              <Handle
                type="target"
                id={col.name}
                position={Position.Left}
                style={{ background: 'var(--dim)', width: 8, height: 8, border: '2px solid var(--panel-2)' }}
              />
            )}
          </div>
        ))}
        {data.hiddenCount > 0 && (
          <div className="px-2 py-1 text-[12px] text-[var(--ink-3)]">+ {data.hiddenCount} more columns</div>
        )}
      </div>

      <div
        className="flex gap-2.5 px-3 py-1.5 border-t border-[var(--line)] text-[10.5px] text-[var(--ink-3)]"
        style={{ fontFamily: '"Spline Sans Mono", monospace' }}
      >
        <span>{data.columnCount} cols</span>
        {data.fkCount > 0 && <span>{data.fkCount} fk</span>}
        {data.pkCount > 0 && <span>{data.pkCount} pk</span>}
      </div>
    </div>
  );
}
