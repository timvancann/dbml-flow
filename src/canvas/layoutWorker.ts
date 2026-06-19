import { layoutGraph } from '@/canvas/layout';
import type { FlowEdge, FlowNode } from '@/canvas/selectionToFlow';

self.onmessage = async (e: MessageEvent<{ nodes: FlowNode[]; edges: FlowEdge[] }>) => {
  const result = await layoutGraph(e.data.nodes, e.data.edges);
  (self as unknown as Worker).postMessage(result);
};
