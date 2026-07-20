// src/canvas/Canvas.tsx
import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import { buildAdjacency } from '@/model/graph';
import type { Model } from '@/model/types';
import { resolveSelection } from '@/selection/resolveSelection';
import { selectionToFlow, type FlowNode } from '@/canvas/selectionToFlow';
import { layoutGraph } from '@/canvas/layout';
import { TableNode } from '@/canvas/TableNode';
import { TableNodeCompact } from '@/canvas/TableNodeCompact';
import { GroupNode } from '@/canvas/GroupNode';
import { RefEdge } from '@/canvas/RefEdge';
import { HopStepper } from '@/app/HopStepper';
import { useAppStore } from '@/app/store';
import { expandGroup, collapseGroup, expandedGroupTokens } from '@/app/selectorEdit';

const nodeTypes = { table: TableNode, tableCompact: TableNodeCompact, group: GroupNode };
const edgeTypes = { ref: RefEdge };

export function Canvas({
  model,
  selector,
  onSelectorChange,
  onTableSelect,
  onTableFocus,
}: {
  model: Model;
  selector: string;
  onSelectorChange?: (s: string) => void;
  onTableSelect?: (name: string) => void;
  onTableFocus?: (seg: string) => void;
}) {
  const adjacency = useMemo(() => buildAdjacency(model), [model]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const pathMode = useAppStore((s) => s.pathMode);
  const pathStart = useAppStore((s) => s.pathStart);
  const pickPathTable = useAppStore((s) => s.pickPathTable);

  useEffect(() => {
    let cancelled = false;

    const raw = selectionToFlow(model, resolveSelection(model, selector, adjacency));

    layoutGraph(raw.nodes as FlowNode[], raw.edges as never).then((laid) => {
      if (cancelled) return;
      setNodes(laid as unknown as Node[]);
      setEdges(
        raw.edges.map((e) => ({
          id: e.id, source: e.source, target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          type: 'ref',
          data: e.data,
          style: { stroke: 'var(--edge)', strokeWidth: 1.4, opacity: 0.5 },
        })) as Edge[],
      );
    });

    return () => { cancelled = true; };
  }, [model, selector, adjacency]);

  const tableCount = nodes.filter((n) => n.type === 'table' || n.type === 'tableCompact').length;
  const edgeCount = edges.length;

  return (
    <div className="dbml-canvas" style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Vignette overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 200px 40px rgba(0,0,0,.55)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
      {/* HUD */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 14,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          zIndex: 6,
        }}
      >
        <div
          style={{
            fontFamily: '"Spline Sans Mono", monospace',
            fontSize: 11,
            color: 'var(--ink-2)',
            background: 'rgba(13,16,24,.7)',
            border: '1px solid var(--line)',
            padding: '5px 9px',
            borderRadius: 7,
            backdropFilter: 'blur(6px)',
          }}
        >
          <b style={{ color: 'var(--dim)', fontWeight: 600 }}>{tableCount}</b> tables ·{' '}
          <b style={{ color: 'var(--dim)', fontWeight: 600 }}>{edgeCount}</b> refs visible
        </div>
        <HopStepper />
        {expandedGroupTokens(selector).map(({ token, name }) => (
          <button
            key={token}
            onClick={() => onSelectorChange?.(collapseGroup(selector, name))}
            title={`Collapse ${name} back to a super-node`}
            style={{
              fontFamily: '"Spline Sans Mono", monospace', fontSize: 11, color: 'var(--ink-2)',
              background: 'rgba(13,16,24,.7)', border: '1px solid var(--line)', padding: '5px 9px',
              borderRadius: 7, cursor: 'pointer', backdropFilter: 'blur(6px)',
            }}
          >
            ▾ {name}
          </button>
        ))}
        {pathMode && (
          <div
            style={{
              fontFamily: '"Spline Sans Mono", monospace',
              fontSize: 11,
              color: 'var(--accent)',
              background: 'rgba(139,156,255,.12)',
              border: '1px solid rgba(139,156,255,.4)',
              padding: '5px 9px',
              borderRadius: 7,
              backdropFilter: 'blur(6px)',
            }}
          >
            {pathStart ? 'Pick target table' : 'Pick start table'}
          </div>
        )}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        onNodeClick={(_, node) => {
          if (pathMode) {
            if (node.type === 'table') {
              pickPathTable((node.data as { name: string }).name);
            }
            return;
          }
          if (node.type === 'table') {
            const name = (node.data as { name: string }).name;
            const seg = name.split('.').pop() ?? name;
            onTableFocus?.(seg);
            onTableSelect?.(name);
          } else if (node.type === 'group') {
            onSelectorChange?.(expandGroup(selector, (node.data as { name: string }).name));
          }
        }}
      >
        <Background color="#1e2636" gap={28} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export function CanvasApp(props: { model: Model; selector: string; onSelectorChange?: (s: string) => void; onTableSelect?: (name: string) => void; onTableFocus?: (seg: string) => void }) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
