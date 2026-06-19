import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { resolveSelection } from '@/selection/resolveSelection';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const FACT = 'model.shop.f_order';
const DIM = 'model.shop.d_product';

describe('resolveSelection', () => {
  it('resolves a bare table to just itself', () => {
    const { nodes } = resolveSelection(model, 'f_order');
    expect([...nodes]).toEqual([FACT]);
  });

  it('expands toward dimensions with suffix + (out)', () => {
    const { nodes } = resolveSelection(model, 'f_order+');
    expect(nodes.has(FACT)).toBe(true);
    expect(nodes.has(DIM)).toBe(true);
    expect(nodes.has('model.shop.d_customer')).toBe(true);
    expect(nodes.has('model.shop.d_employee')).toBe(true);
  });

  it('expands toward facts with prefix + (in)', () => {
    const { nodes } = resolveSelection(model, '+d_product');
    expect(nodes.has(DIM)).toBe(true);
    expect(nodes.has(FACT)).toBe(true); // a fact that references the dim
  });

  it('derives edges where both endpoints are selected', () => {
    const { edges } = resolveSelection(model, 'f_order+');
    expect(edges.some((e) => e.fromTable === FACT && e.toTable === DIM)).toBe(true);
  });

  it('intersects a group with a glob', () => {
    const { nodes } = resolveSelection(model, 'group:sales,*.f_*');
    expect([...nodes].sort()).toEqual([
      'model.shop.f_order',
      'model.shop.f_shipment',
    ]);
  });

  it('subtracts excludes', () => {
    const { nodes } = resolveSelection(model, 'group:sales !f_shipment');
    expect(nodes.has('model.shop.f_shipment')).toBe(false);
    expect(nodes.has('model.shop.d_customer')).toBe(true);
  });

  it('resolves empty input to an empty selection', () => {
    const { nodes, edges } = resolveSelection(model, '');
    expect(nodes.size).toBe(0);
    expect(edges.length).toBe(0);
  });
});

describe('path: operator', () => {
  it('resolves the shortest FK path between two tables (undirected)', () => {
    // f_order -> d_product <- f_stock -> d_warehouse
    const { nodes } = resolveSelection(model, 'path:f_order>d_warehouse');
    expect([...nodes].sort()).toEqual([
      'model.shop.d_product',
      'model.shop.d_warehouse',
      'model.shop.f_order',
      'model.shop.f_stock',
    ]);
  });
  it('resolves empty for an unknown endpoint', () => {
    expect(resolveSelection(model, 'path:f_order>does_not_exist').nodes.size).toBe(0);
  });
  it('parseSelector keeps path:a>b as a single none-atom', () => {
    // guards that '>' does not get mis-tokenized
    const { nodes } = resolveSelection(model, 'path:d_warehouse>f_order');
    expect(nodes.has('model.shop.d_warehouse')).toBe(true);
    expect(nodes.has('model.shop.f_order')).toBe(true);
  });
});
