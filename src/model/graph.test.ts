import { buildAdjacency, neighbors, shortestPath } from '@/model/graph';
import { buildModel } from '@/model/buildModel';
import type { Ref, Table } from '@/model/types';

const t = (name: string): Table => ({ name, columns: [] });
const ref = (from: string, to: string): Ref => ({
  id: `${from}->${to}`, fromTable: from, fromColumns: ['x'], toTable: to, toColumns: ['y'],
  fromCardinality: '*', toCardinality: '1',
});

// fact f -> dim d1; fact f -> dim d2; dim d1 -> dim d3 (chain)
const model = buildModel(
  [t('f'), t('d1'), t('d2'), t('d3')],
  [ref('f', 'd1'), ref('f', 'd2'), ref('d1', 'd3')],
);
const adj = buildAdjacency(model);

describe('neighbors', () => {
  it('follows outgoing edges (toward dimensions)', () => {
    expect([...neighbors(adj, ['f'], 'out', 1)].sort()).toEqual(['d1', 'd2', 'f']);
  });

  it('follows incoming edges (toward facts)', () => {
    expect([...neighbors(adj, ['d1'], 'in', 1)].sort()).toEqual(['d1', 'f']);
  });

  it('treats both directions as undirected', () => {
    expect([...neighbors(adj, ['d1'], 'both', 1)].sort()).toEqual(['d1', 'd3', 'f']);
  });

  it('expands multiple hops', () => {
    expect([...neighbors(adj, ['f'], 'out', 2)].sort()).toEqual(['d1', 'd2', 'd3', 'f']);
  });

  it('hops=0 returns only the existing start nodes', () => {
    expect([...neighbors(adj, ['f', 'ghost'], 'both', 0)].sort()).toEqual(['f']);
  });
});

describe('shortestPath', () => {
  it('finds a directed-forward path undirectionally', () => {
    expect(shortestPath(adj, 'f', 'd3')).toEqual(['f', 'd1', 'd3']);
  });
  it('finds a path against edge direction (undirected)', () => {
    expect(shortestPath(adj, 'd3', 'f')).toEqual(['d3', 'd1', 'f']);
  });
  it('returns [from] when from === to', () => {
    expect(shortestPath(adj, 'f', 'f')).toEqual(['f']);
  });
  it('returns null when unreachable or unknown', () => {
    expect(shortestPath(adj, 'd2', 'ghost')).toBeNull();
  });
});
