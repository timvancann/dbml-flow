// src/canvas/GroupNode.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GroupNodeData } from '@/canvas/selectionToFlow';

export function GroupNode({ data }: NodeProps & { data: GroupNodeData }) {
  return (
    <div className="w-[200px] rounded-[12px] border border-[var(--line-2)] bg-[var(--panel-2)] px-3 py-2.5 shadow-[0_18px_40px_-22px_rgba(0,0,0,.9)]" style={{ fontFamily: '"Spline Sans Mono", monospace' }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">{data.label}</div>
      <div className="mt-1 text-[10.5px] text-[var(--ink-3)]">
        {data.tableCount} tables · {data.refCount} refs
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
