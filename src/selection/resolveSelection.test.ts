import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { resolveSelection } from '@/selection/resolveSelection';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const FACT = 'model.shop.f_order';
const DIM = 'model.shop.d_product';
const DIM_D_CUSTOMER = 'model.shop.d_customer';

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

  it('resolves empty input to the overview (all groups as super-nodes)', () => {
    // Empty input now behaves as '.g:*' (Task 3): no tables rendered individually,
    // but their super-groups still pull in member tables so edges resolve.
    const { full, collapsed, superGroups } = resolveSelection(model, '');
    expect(full.size).toBe(0);
    expect(collapsed.size).toBe(0);
    expect(superGroups.size).toBe(model.groups.size);
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

describe('detail levels', () => {
  it('empty selector resolves as .g:* (all super-groups, no table nodes rendered individually)', () => {
    const sel = resolveSelection(model, '');
    expect(sel.full.size).toBe(0);
    expect(sel.collapsed.size).toBe(0);
    expect([...sel.superGroups.keys()].sort()).toEqual([...model.groups.keys()].sort());
    // nodes still contains the member tables so edges resolve
    expect(sel.nodes.size).toBeGreaterThan(0);
  });

  it('a dotted table atom selects collapsed', () => {
    const sel = resolveSelection(model, '.d_customer');
    expect(sel.collapsed.has(DIM_D_CUSTOMER)).toBe(true);
    expect(sel.full.size).toBe(0);
  });

  it('.g:* group:sales expands sales, keeps other groups as super-nodes', () => {
    const sel = resolveSelection(model, '.g:* group:sales');
    const sales = model.groups.get('shop.sales')!;
    for (const t of sales.tables) expect(sel.full.has(t)).toBe(true);
    expect(sel.superGroups.has('shop.sales')).toBe(false);
    expect(sel.superGroups.size).toBe(model.groups.size - 1);
  });

  it('exact dotted atom beats a group match: group:sales .f_order', () => {
    const sel = resolveSelection(model, 'group:sales .f_order');
    expect(sel.collapsed.has(FACT)).toBe(true);
    expect(sel.full.has(FACT)).toBe(false);
  });

  it('expanded wins at equal specificity: g:* .g:* renders tables full', () => {
    const sel = resolveSelection(model, 'g:* .g:*');
    // .g:* standalone is a super-group atom, but every table escapes via g:* full detail
    expect(sel.superGroups.size).toBe(0);
    expect(sel.full.size).toBeGreaterThan(0);
  });

  it('a table selected individually escapes its dotted group', () => {
    const sel = resolveSelection(model, '.g:* f_order');
    expect(sel.full.has(FACT)).toBe(true);
    const g = model.tables.get(FACT)!.group!;
    const remaining = sel.superGroups.get(g);
    expect(remaining).toBeDefined();
    expect(remaining!.includes(FACT)).toBe(false);
  });

  it('intersection is collapsed only when all atoms are dotted', () => {
    const collapsed = resolveSelection(model, '.f_order,.~1f_order');
    expect(collapsed.collapsed.has(FACT)).toBe(true);
    const mixed = resolveSelection(model, 'f_order,.~1f_order');
    expect(mixed.full.has(FACT)).toBe(true);
  });

  it('exclusion removes from super-group members', () => {
    const sel = resolveSelection(model, '.g:* !f_order');
    const g = model.tables.get(FACT)!.group!;
    expect(sel.superGroups.get(g)?.includes(FACT) ?? false).toBe(false);
    expect(sel.nodes.has(FACT)).toBe(false);
  });
});
