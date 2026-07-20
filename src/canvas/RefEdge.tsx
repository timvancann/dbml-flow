// src/canvas/RefEdge.tsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

const labelStyle: React.CSSProperties = {
  position: 'absolute', fontFamily: '"Spline Sans Mono", monospace', fontSize: 9,
  color: 'var(--ink-3)', background: 'rgba(13,16,24,.75)', border: '1px solid var(--line)',
  borderRadius: 4, padding: '0 3px', pointerEvents: 'none',
};

export function RefEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, markerEnd } = props;
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const count = (data as { count?: number })?.count ?? 1;
  const fromCol = (data as { fromColumn?: string })?.fromColumn;
  const toCol = (data as { toColumn?: string })?.toColumn;
  const fromCard = (data as { fromCardinality?: string })?.fromCardinality;
  const toCard = (data as { toCardinality?: string })?.toCardinality;
  const hovered = (data as { hovered?: boolean })?.hovered;

  return (
    <>
      <BaseEdge path={path} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        {count > 1 && (
          <div style={{ ...labelStyle, transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}>
            {count}
          </div>
        )}
        {hovered && count === 1 && fromCol && (
          <div style={{ ...labelStyle, fontSize: 10, transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}>
            {`${fromCol} -> ${toCol}`}
          </div>
        )}
        {count === 1 && fromCard && (
          <div style={{ ...labelStyle, transform: `translate(-50%,-50%) translate(${sourceX + (targetX > sourceX ? 14 : -14)}px,${sourceY - 10}px)` }}>
            {fromCard === '*' ? 'N' : '1'}
          </div>
        )}
        {count === 1 && toCard && (
          <div style={{ ...labelStyle, transform: `translate(-50%,-50%) translate(${targetX + (targetX > sourceX ? -14 : 14)}px,${targetY - 10}px)` }}>
            {toCard === '*' ? 'N' : '1'}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
