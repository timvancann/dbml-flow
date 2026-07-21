import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { parseDbtManifest } from '@/model/parseDbtManifest';
import type { Model } from '@/model/types';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const manifest = JSON.parse(readFileSync('examples/shop.manifest.json', 'utf8'));

const ALL_TABLES = [
  'model.shop.f_order',
  'model.shop.f_shipment',
  'model.shop.d_customer',
  'model.shop.d_product',
  'model.shop.f_stock',
  'model.shop.d_warehouse',
  'model.shop.d_employee',
  'model.shop.f_sales_rep',
];

describe('parseDbtManifest', () => {
  it('exact-id join finds all 8 dbml tables', () => {
    const { matchedTables } = parseDbtManifest(manifest, model);
    expect(matchedTables.size).toBe(8);
    for (const t of ALL_TABLES) expect(matchedTables.has(t)).toBe(true);
  });

  it('staging models and sources land in unmatchedNodes', () => {
    const { unmatchedNodes } = parseDbtManifest(manifest, model);
    expect(unmatchedNodes).toContain('model.shop.stg_customers');
    expect(unmatchedNodes).toContain('model.shop.stg_orders');
    expect(unmatchedNodes).toContain('source.shop.raw.customers');
    expect(unmatchedNodes).toContain('source.shop.raw.orders');
    // 7 staging models + 7 sources
    expect(unmatchedNodes.length).toBe(14);
  });

  it('every edge endpoint resolves to a table in the model', () => {
    const { edges } = parseDbtManifest(manifest, model);
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(model.tables.has(e.fromTable)).toBe(true);
      expect(model.tables.has(e.toTable)).toBe(true);
    }
  });

  it('drops dims-from-staging edges (staging endpoint unmatched)', () => {
    const { edges } = parseDbtManifest(manifest, model);
    const hasStagingEdge = edges.some(
      (e) => e.fromTable.includes('stg_') || e.toTable.includes('stg_'),
    );
    expect(hasStagingEdge).toBe(false);
  });

  it('keeps fact-from-dim edges where both endpoints are model tables', () => {
    const { edges } = parseDbtManifest(manifest, model);
    const has = (from: string, to: string) =>
      edges.some((e) => e.fromTable === `model.shop.${from}` && e.toTable === `model.shop.${to}`);
    expect(has('d_customer', 'f_order')).toBe(true);
    expect(has('d_product', 'f_order')).toBe(true);
    expect(has('d_employee', 'f_order')).toBe(true);
    expect(has('d_product', 'f_stock')).toBe(true);
    expect(has('d_warehouse', 'f_stock')).toBe(true);
    expect(has('d_customer', 'f_shipment')).toBe(true);
    expect(has('d_product', 'f_shipment')).toBe(true);
    expect(has('d_employee', 'f_sales_rep')).toBe(true);
    expect(edges.length).toBe(8);
  });

  it('drops the fabricated fact-to-fact deps', () => {
    const { edges } = parseDbtManifest(manifest, model);
    const has = (from: string, to: string) =>
      edges.some((e) => e.fromTable === `model.shop.${from}` && e.toTable === `model.shop.${to}`);
    expect(has('f_order', 'f_shipment')).toBe(false);
    expect(has('f_order', 'f_sales_rep')).toBe(false);
    expect(has('f_shipment', 'f_stock')).toBe(false);
  });

  it('extracts 1-hop external parents (staging models) for matched tables', () => {
    const { external } = parseDbtManifest(manifest, model);
    const orderParent = external.find(
      (e) => e.toTable === 'model.shop.f_order' && e.fromNode === 'model.shop.stg_orders',
    );
    expect(orderParent).toBeDefined();
    expect(orderParent!.fromLabel).toBe('stg_orders');
    expect(orderParent!.resourceType).toBe('model');

    const customerParent = external.find(
      (e) => e.toTable === 'model.shop.d_customer' && e.fromNode === 'model.shop.stg_customers',
    );
    expect(customerParent).toBeDefined();
    expect(customerParent!.resourceType).toBe('model');
  });

  it('does not surface sources as external parents of marts (staging sits between)', () => {
    const { external } = parseDbtManifest(manifest, model);
    const sourceAsExternal = external.some((e) => e.fromNode.startsWith('source.'));
    expect(sourceAsExternal).toBe(false);
  });

  it('falls back to schema.name matching when node id does not exact-match a table', () => {
    const fallbackModel: Model = {
      tables: new Map([
        ['shop.orders', { name: 'shop.orders', group: 'shop', columns: [] }],
        ['shop.customers', { name: 'shop.customers', group: 'shop', columns: [] }],
      ]),
      refs: [],
      groups: new Map(),
    };
    const fallbackManifest = {
      nodes: {
        'model.myproject.orders': { resource_type: 'model', name: 'orders', schema: 'shop' },
        'model.myproject.customers': { resource_type: 'model', name: 'customers', schema: 'shop' },
      },
      parent_map: {
        'model.myproject.orders': ['model.myproject.customers'],
        'model.myproject.customers': [],
      },
    };
    const { edges, matchedTables } = parseDbtManifest(fallbackManifest, fallbackModel);
    expect(matchedTables.has('shop.orders')).toBe(true);
    expect(matchedTables.has('shop.customers')).toBe(true);
    expect(edges).toEqual([{ fromTable: 'shop.customers', toTable: 'shop.orders' }]);
  });

  it('reports unmatched nodes rather than throwing on malformed json', () => {
    expect(() => parseDbtManifest({ nonsense: true }, model)).not.toThrow();
    const { edges, external, matchedTables, unmatchedNodes } = parseDbtManifest(null, model);
    expect(edges).toEqual([]);
    expect(external).toEqual([]);
    expect(matchedTables.size).toBe(0);
    expect(unmatchedNodes).toEqual([]);
  });
});
