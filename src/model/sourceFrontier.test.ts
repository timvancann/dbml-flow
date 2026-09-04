import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { computeSourceFrontier, isSourceTable } from '@/model/sourceFrontier';
import type { LineageEdge, Table } from '@/model/types';

const t = (name: string): [string, Table] => [name, { name, columns: [] }];
const edge = (fromTable: string, toTable: string): LineageEdge => ({ fromTable, toTable });

function frontier(names: string[], lineage: LineageEdge[]) {
  return computeSourceFrontier({ tables: new Map(names.map(t)), lineage });
}

describe('isSourceTable', () => {
  it('is true only when the first dotted segment is "source"', () => {
    expect(isSourceTable('source.shop.orders')).toBe(true);
    expect(isSourceTable('model.shop.stg_orders')).toBe(false);
    expect(isSourceTable('source')).toBe(false);
  });
});

describe('computeSourceFrontier', () => {
  it('walks upstream through staging to the sources', () => {
    const f = frontier(
      ['source.shop.orders', 'model.shop.stg_orders', 'model.shop.f_order'],
      [edge('source.shop.orders', 'model.shop.stg_orders'), edge('model.shop.stg_orders', 'model.shop.f_order')],
    );
    expect(f.sourcesOf.get('model.shop.f_order')).toEqual(['source.shop.orders']);
    expect(f.sourcesOf.get('model.shop.stg_orders')).toEqual(['source.shop.orders']);
  });

  it('dedupes fan-in that reaches the same source by two paths, sorted', () => {
    const f = frontier(
      ['source.shop.b', 'source.shop.a', 'model.shop.stg_1', 'model.shop.stg_2', 'model.shop.f'],
      [
        edge('source.shop.b', 'model.shop.stg_1'),
        edge('source.shop.b', 'model.shop.stg_2'),
        edge('source.shop.a', 'model.shop.stg_2'),
        edge('model.shop.stg_1', 'model.shop.f'),
        edge('model.shop.stg_2', 'model.shop.f'),
      ],
    );
    expect(f.sourcesOf.get('model.shop.f')).toEqual(['source.shop.a', 'source.shop.b']);
  });

  it('stops at a source: a source upstream of a source is not reported', () => {
    const f = frontier(
      ['source.shop.raw', 'source.shop.derived', 'model.shop.m'],
      [edge('source.shop.raw', 'source.shop.derived'), edge('source.shop.derived', 'model.shop.m')],
    );
    expect(f.sourcesOf.get('model.shop.m')).toEqual(['source.shop.derived']);
  });

  it('gives a table with no upstream sources an empty list, and sources themselves an empty list', () => {
    const f = frontier(['source.shop.x', 'model.shop.lonely'], []);
    expect(f.sourcesOf.get('model.shop.lonely')).toEqual([]);
    expect(f.sourcesOf.get('source.shop.x')).toEqual([]);
  });

  it('inverts into feeds: source -> every table it reaches, sorted', () => {
    const f = frontier(
      ['source.shop.orders', 'model.shop.stg_orders', 'model.shop.f_order', 'model.shop.f_sales_rep'],
      [
        edge('source.shop.orders', 'model.shop.stg_orders'),
        edge('model.shop.stg_orders', 'model.shop.f_sales_rep'),
        edge('model.shop.stg_orders', 'model.shop.f_order'),
      ],
    );
    expect(f.feeds.get('source.shop.orders')).toEqual(['model.shop.f_order', 'model.shop.f_sales_rep', 'model.shop.stg_orders']);
  });

  it('terminates on a cycle', () => {
    const f = frontier(
      ['source.shop.s', 'model.shop.a', 'model.shop.b'],
      [edge('source.shop.s', 'model.shop.a'), edge('model.shop.a', 'model.shop.b'), edge('model.shop.b', 'model.shop.a')],
    );
    expect(f.sourcesOf.get('model.shop.b')).toEqual(['source.shop.s']);
  });

  it('example file: f_order resolves to three sources, f_shipment to two', () => {
    const model = loadModel(readFileSync('examples/shop.dbml', 'utf8'));
    const f = computeSourceFrontier(model);
    expect(f.sourcesOf.get('model.shop.f_order')).toEqual(['source.shop.customers', 'source.shop.orders', 'source.shop.web_sessions']);
    expect(f.sourcesOf.get('model.shop.f_shipment')).toEqual(['source.shop.shipments', 'source.shop.warehouses']);
  });
});
