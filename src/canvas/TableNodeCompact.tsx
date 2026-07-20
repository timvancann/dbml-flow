// src/canvas/TableNodeCompact.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CompactTableNodeData } from '@/canvas/selectionToFlow';
import { useAppStore } from '@/app/store';
import { toggleTableCollapsed } from '@/app/selectorEdit';

export function TableNodeCompact({ data }: NodeProps & { data: CompactTableNodeData }) {
  const accent = data.kind === 'fact' ? 'var(--fact)' : data.kind === 'dim' ? 'var(--dim)' : 'var(--line-2)';
  const accentDim = data.kind === 'fact' ? 'var(--fact-dim)' : 'var(--dim-dim)';
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);

  return (
    <div
      style={{
        width: 248, height: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
        borderRadius: 13, border: '1px solid var(--line-2)', borderTop: `2px solid ${accent}`,
        fontFamily: '"Spline Sans Mono", monospace',
        background: 'linear-gradient(180deg, var(--panel-2), var(--panel))',
        boxShadow: '0 18px 40px -22px rgba(0,0,0,.9), 0 2px 0 rgba(255,255,255,.02) inset',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--dim)', width: 8, height: 8, border: '2px solid var(--panel-2)' }} />
      <span className="grid place-items-center flex-none rounded-[5px] text-[10px] font-bold" style={{ width: 19, height: 19, color: accent, background: accentDim }}>
        {data.kind === 'fact' ? 'F' : data.kind === 'dim' ? 'D' : '·'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">{data.label}</div>
        <div className="text-[10px] text-[var(--ink-3)] truncate">
          {data.schema}, {data.columnCount} cols{data.fkCount > 0 ? `, ${data.fkCount} fk` : ''}
        </div>
      </div>
      <button
        title="Expand columns"
        onClick={(e) => { e.stopPropagation(); setSelector(toggleTableCollapsed(selector, data.name, false)); }}
        style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 12, padding: 2 }}
      >
        ▸
      </button>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--fact)', width: 8, height: 8, border: '2px solid var(--panel-2)' }} />
    </div>
  );
}
