import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { buildOverview } from '@/canvas/buildOverview';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));

describe('buildOverview', () => {
  it('produces one node per group with table counts', () => {
    const { nodes } = buildOverview(model);
    expect(nodes).toHaveLength(3);
    const sales = nodes.find((n) => n.data.name === 'shop.sales')!;
    expect(sales.data.tableCount).toBe(3);
    expect(sales.type).toBe('group');
  });

  it('aggregates inter-group edges with counts', () => {
    const { edges } = buildOverview(model);
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(e.data.count).toBeGreaterThan(0);
      expect(e.source).not.toBe(e.target);
    }
  });

  it('counts intra-group refs on the node', () => {
    const { nodes } = buildOverview(model);
    const sales = nodes.find((n) => n.data.name === 'shop.sales')!;
    expect(sales.data.refCount).toBeGreaterThanOrEqual(2);
  });
});
