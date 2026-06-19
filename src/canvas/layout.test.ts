import { layoutGraph } from '@/canvas/layout';
import type { FlowEdge, FlowNode } from '@/canvas/selectionToFlow';

const node = (id: string): FlowNode => ({
  id, type: 'table', position: { x: 0, y: 0 }, width: 248, height: 160,
  data: { name: id, label: id, schema: '', kind: 'other', columns: [], hiddenCount: 0, columnCount: 0, fkCount: 0, pkCount: 0 },
});

describe('layoutGraph', () => {
  it('assigns numeric positions to every node', async () => {
    const out = await layoutGraph([node('a'), node('b')], [
      { id: 'e', source: 'a', target: 'b', sourceHandle: 'x', targetHandle: 'y', data: { fromColumn: 'x', toColumn: 'y' } } as FlowEdge,
    ]);
    expect(out).toHaveLength(2);
    for (const n of out) {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });

  it('lays the source (fact) left of its target (dim) for RIGHT direction', async () => {
    const out = await layoutGraph([node('fact'), node('dim')], [
      { id: 'e', source: 'fact', target: 'dim', sourceHandle: 'x', targetHandle: 'y', data: { fromColumn: 'x', toColumn: 'y' } } as FlowEdge,
    ]);
    const fact = out.find((n) => n.id === 'fact')!;
    const dim = out.find((n) => n.id === 'dim')!;
    expect(fact.position.x).toBeLessThan(dim.position.x);
  });

  it('handles an empty graph', async () => {
    expect(await layoutGraph([], [])).toEqual([]);
  });
});
