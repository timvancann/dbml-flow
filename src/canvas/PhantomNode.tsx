// src/canvas/PhantomNode.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PhantomNodeData } from '@/canvas/selectionToFlow';

export function PhantomNode({ data }: NodeProps & { data: PhantomNodeData }) {
  return (
    <div
      className="w-[200px] rounded-[10px] px-3 py-2"
      style={{
        fontFamily: '"Spline Sans Mono", monospace',
        background: 'transparent',
        border: '1px dashed var(--line-2)',
      }}
    >
      <div className="text-[12px] text-[var(--ink-3)] truncate">{data.label}</div>
      <div className="mt-1 text-[9px] uppercase tracking-wide text-[var(--ink-3)]">{data.resourceType}</div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
