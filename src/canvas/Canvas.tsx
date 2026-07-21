// src/canvas/Canvas.tsx
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ReactFlow, Background, Controls, ReactFlowProvider, useReactFlow, getNodesBounds, getViewportForBounds, MiniMap, type Node, type Edge } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { buildAdjacency } from '@/model/graph';
import type { Model } from '@/model/types';
import { resolveSelection } from '@/selection/resolveSelection';
import { selectionToFlow, type FlowNode } from '@/canvas/selectionToFlow';
import { layoutGraph } from '@/canvas/layout';
import { TableNode } from '@/canvas/TableNode';
import { TableNodeCompact } from '@/canvas/TableNodeCompact';
import { GroupNode } from '@/canvas/GroupNode';
import { PhantomNode } from '@/canvas/PhantomNode';
import { RefEdge } from '@/canvas/RefEdge';
import { HopStepper } from '@/app/HopStepper';
import { useAppStore } from '@/app/store';
import { expandGroup, collapseGroup, expandedGroupTokens, collapseAll, expandAll } from '@/app/selectorEdit';
import { selectionToDbml } from '@/app/exportDbml';

const hudButtonStyle: CSSProperties = {
  fontFamily: '"Spline Sans Mono", monospace',
  fontSize: 11,
  color: 'var(--ink-2)',
  background: 'rgba(13,16,24,.7)',
  border: '1px solid var(--line)',
  padding: '5px 9px',
  borderRadius: 7,
  cursor: 'pointer',
  backdropFilter: 'blur(6px)',
};

const nodeTypes = { table: TableNode, tableCompact: TableNodeCompact, superGroup: GroupNode, phantom: PhantomNode };
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
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const pathMode = useAppStore((s) => s.pathMode);
  const pathStart = useAppStore((s) => s.pathStart);
  const pickPathTable = useAppStore((s) => s.pickPathTable);
  const lineage = useAppStore((s) => s.lineage);
  const showLineage = useAppStore((s) => s.showLineage);
  const setShowLineage = useAppStore((s) => s.setShowLineage);
  const { getNodes, fitView } = useReactFlow();
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const [pngExportState, setPngExportState] = useState<'idle' | 'error'>('idle');

  const copyDbml = async () => {
    try {
      const dbml = selectionToDbml(model, resolveSelection(model, selector, adjacency));
      await navigator.clipboard.writeText(dbml);
      setCopyState('success');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch (err) {
      console.error('Copy DBML failed', err);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 1500);
    }
  };

  const exportPng = async () => {
    try {
      const bounds = getNodesBounds(getNodes());
      const width = Math.min(bounds.width + 80, 4096);
      const height = Math.min(bounds.height + 80, 4096);
      const viewport = getViewportForBounds(bounds, width, height, 0.2, 2, 0.1);
      const el = document.querySelector('.react-flow__viewport') as HTMLElement;
      const dataUrl = await toPng(el, {
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
        backgroundColor: '#0d1018',
      });
      const a = document.createElement('a');
      a.download = 'dbml-flow.png';
      a.href = dataUrl;
      a.click();
      setPngExportState('idle');
    } catch (err) {
      console.error('PNG export failed', err);
      setPngExportState('error');
      setTimeout(() => setPngExportState('idle'), 1500);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setHoveredNode(null);
    setHoveredEdge(null);

    const raw = selectionToFlow(
      model,
      resolveSelection(model, selector, adjacency),
      showLineage ? (lineage ?? undefined) : undefined,
    );

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
          style:
            e.data.kind === 'lineage'
              ? {
                  stroke: 'var(--dim)',
                  strokeWidth: 1.4,
                  opacity: 0.7,
                  strokeDasharray: '2 5',
                  strokeLinecap: 'round',
                }
              : { stroke: 'var(--edge)', strokeWidth: 1.4, opacity: 0.5 },
        })) as Edge[],
      );
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          fitView({ padding: 0.15, duration: 300 });
        });
      });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, selector, adjacency, lineage, showLineage]);

  const tableCount = nodes.filter((n) => n.type === 'table' || n.type === 'tableCompact').length;
  const edgeCount = edges.filter((e) => (e.data as { kind?: string } | undefined)?.kind !== 'lineage').length;

  const connectedNodeIds = useMemo(() => {
    if (!hoveredNode) return null;
    const set = new Set<string>([hoveredNode]);
    for (const e of edges) {
      if (e.source === hoveredNode) set.add(e.target);
      if (e.target === hoveredNode) set.add(e.source);
    }
    return set;
  }, [hoveredNode, edges]);

  const displayNodes = useMemo(() => {
    if (!connectedNodeIds) return nodes;
    return nodes.map((n) =>
      connectedNodeIds.has(n.id)
        ? n
        : { ...n, style: { ...n.style, opacity: 0.18, transition: 'opacity 120ms' } },
    );
  }, [nodes, connectedNodeIds]);

  const displayEdges = useMemo(() => {
    return edges.map((e) => {
      const hovered = e.id === hoveredEdge;
      const data = { ...e.data, hovered };
      if (!connectedNodeIds) return { ...e, data };
      const connected = e.source === hoveredNode || e.target === hoveredNode;
      return {
        ...e,
        data,
        style: { ...e.style, opacity: connected ? 1 : 0.06 },
      };
    });
  }, [edges, connectedNodeIds, hoveredNode, hoveredEdge]);

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
        {lineage !== null && (
          <button
            onClick={() => setShowLineage(!showLineage)}
            title="Toggle dbt lineage overlay (dotted)"
            style={{
              fontFamily: '"Spline Sans Mono", monospace',
              fontSize: 11,
              color: showLineage ? 'var(--accent)' : 'var(--ink-2)',
              background: showLineage ? 'rgba(139,156,255,.12)' : 'rgba(13,16,24,.7)',
              border: showLineage ? '1px solid rgba(139,156,255,.5)' : '1px solid var(--line)',
              padding: '5px 9px',
              borderRadius: 7,
              cursor: 'pointer',
              backdropFilter: 'blur(6px)',
            }}
          >
            <span style={{ color: 'var(--dim)' }}>┄</span> lineage
          </button>
        )}
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
            {pathStart ? `start: ${pathStart.split('.').pop()}, pick target table` : 'Pick start table'}
          </div>
        )}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 16,
          top: 14,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          zIndex: 6,
        }}
      >
        <button onClick={() => onSelectorChange?.(collapseAll(selector))} style={hudButtonStyle}>
          Collapse all
        </button>
        <button onClick={() => onSelectorChange?.(expandAll(selector))} style={hudButtonStyle}>
          Expand all
        </button>
        <button onClick={copyDbml} style={hudButtonStyle}>
          {copyState === 'success' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy DBML'}
        </button>
        <button onClick={exportPng} style={hudButtonStyle}>
          {pngExportState === 'error' ? 'PNG failed' : 'PNG'}
        </button>
      </div>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        zoomOnDoubleClick={false}
        onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
        onNodeMouseLeave={() => setHoveredNode(null)}
        onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdge(null)}
        onNodeClick={(_, node) => {
          if (pathMode) {
            if (node.type === 'table' || node.type === 'tableCompact') {
              pickPathTable((node.data as { name: string }).name);
            }
            return;
          }
          if (node.type === 'table' || node.type === 'tableCompact') {
            const name = (node.data as { name: string }).name;
            const seg = name.split('.').pop() ?? name;
            onTableFocus?.(seg);
            onTableSelect?.(name);
          } else if (node.type === 'superGroup') {
            onSelectorChange?.(expandGroup(selector, (node.data as { name: string }).name));
          }
        }}
      >
        <Background color="#1e2636" gap={28} />
        <Controls />
        {nodes.length >= 10 && (
          <MiniMap
            pannable
            zoomable
            style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8 }}
            maskColor="rgba(13,16,24,.75)"
            nodeColor={(n) => (n.type === 'superGroup' ? 'var(--panel-2)' : 'var(--line-2)')}
            nodeStrokeColor="var(--line)"
          />
        )}
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
