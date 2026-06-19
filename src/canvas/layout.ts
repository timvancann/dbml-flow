import ELK from 'elkjs/lib/elk.bundled.js';
import type { FlowEdge, FlowNode } from '@/canvas/selectionToFlow';

const elk = new ELK();

const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '120',
  'elk.spacing.nodeNode': '36',
  // Crossing minimization: spend more effort and don't force input order, so
  // elk is free to reorder nodes within layers to reduce edge intersections.
  'elk.layered.thoroughness': '40',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.considerModelOrder.strategy': 'NONE',
  // Straighter edges / fewer bends, which also reads as fewer visual crossings.
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.nodePlacement.favorStraightEdges': 'true',
};

export async function layoutGraph(nodes: FlowNode[], edges: FlowEdge[]): Promise<FlowNode[]> {
  if (nodes.length === 0) return [];

  const graph = {
    id: 'root',
    layoutOptions: LAYOUT_OPTIONS,
    children: nodes.map((n) => ({ id: n.id, width: n.width, height: n.height })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };

  const laidOut = await elk.layout(graph);
  const positions = new Map<string, { x: number; y: number }>();
  for (const child of laidOut.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  return nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position }));
}
