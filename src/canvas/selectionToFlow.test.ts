import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { resolveSelection } from '@/selection/resolveSelection';
import {
  selectionToFlow,
  estimateNodeSize,
  MAX_VISIBLE_COLUMNS,
  COMPACT_H,
  type CompactTableNodeData,
  type GroupNodeData,
} from '@/canvas/selectionToFlow';
import type { Model } from '@/model/types';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const FACT = 'model.shop.f_order';
const DIM = 'model.shop.d_product';

describe('selectionToFlow', () => {
  it('produces a node per selected table with kind and label', () => {
    const { nodes } = selectionToFlow(model, resolveSelection(model, 'f_order+'));
    const fact = nodes.find((n) => n.id === FACT)!;
    expect(fact.type).toBe('table');
    expect(fact.data.kind).toBe('fact');
    expect(fact.data.label).toBe('f_order');
    const dim = nodes.find((n) => n.id === DIM)!;
    expect(dim.data.kind).toBe('dim');
  });

  it('flags foreign-key columns from model refs', () => {
    const { nodes } = selectionToFlow(model, resolveSelection(model, 'f_order+'));
    const fact = nodes.find((n) => n.id === FACT)!;
    const fk = fact.data.columns.find((c) => c.name === 'sk_product')!;
    expect(fk.isForeignKey).toBe(true);
  });

  it('caps visible columns and reports hiddenCount', () => {
    const { nodes } = selectionToFlow(model, resolveSelection(model, 'f_order'));
    const big = nodes[0];
    expect(big.data.columns.length).toBeLessThanOrEqual(MAX_VISIBLE_COLUMNS);
    expect(big.data.hiddenCount).toBeGreaterThan(0);
    expect(big.data.columns.length + big.data.hiddenCount).toBe(12);
  });

  it('builds column-level edges with handle ids = column names', () => {
    const { edges } = selectionToFlow(model, resolveSelection(model, 'f_order+'));
    const edge = edges.find((e) => e.source === FACT && e.target === DIM)!;
    expect(edge.sourceHandle).toBe('sk_product');
    expect(edge.targetHandle).toBe('sk_product');
  });

  it('flags isReferenced on PK-less join-target columns', () => {
    const D_EMPLOYEE = 'model.shop.d_employee';
    const { nodes } = selectionToFlow(model, resolveSelection(model, '+d_employee'));
    const dim = nodes.find((n) => n.id === D_EMPLOYEE)!;
    expect(dim).toBeDefined();
    // sk_employee is referenced by f_order and f_sales_rep but d_employee has no PK
    const col = dim.data.columns.find((c) => c.name === 'sk_employee')!;
    expect(col).toBeDefined();
    expect(col.isReferenced).toBe(true);
    expect(col.isPrimaryKey).toBe(false);
  });

  it('estimateNodeSize grows with visible rows', () => {
    const small = estimateNodeSize({ columns: [{}], hiddenCount: 0 } as never);
    const large = estimateNodeSize({ columns: [{}, {}, {}, {}], hiddenCount: 3 } as never);
    expect(large.height).toBeGreaterThan(small.height);
    expect(small.width).toBe(248);
  });

  it('keeps all key columns even when they exceed MAX_VISIBLE_COLUMNS', () => {
    // Build a synthetic model with one table having 9 FK columns + 5 plain columns.
    const syntheticModel: Model = {
      tables: new Map([
        [
          'test_table',
          {
            name: 'test_table',
            group: 'test',
            columns: [
              { name: 'fk_1', type: 'int', isPrimaryKey: false },
              { name: 'fk_2', type: 'int', isPrimaryKey: false },
              { name: 'fk_3', type: 'int', isPrimaryKey: false },
              { name: 'fk_4', type: 'int', isPrimaryKey: false },
              { name: 'fk_5', type: 'int', isPrimaryKey: false },
              { name: 'fk_6', type: 'int', isPrimaryKey: false },
              { name: 'fk_7', type: 'int', isPrimaryKey: false },
              { name: 'fk_8', type: 'int', isPrimaryKey: false },
              { name: 'fk_9', type: 'int', isPrimaryKey: false },
              { name: 'plain_1', type: 'varchar', isPrimaryKey: false },
              { name: 'plain_2', type: 'varchar', isPrimaryKey: false },
              { name: 'plain_3', type: 'varchar', isPrimaryKey: false },
              { name: 'plain_4', type: 'varchar', isPrimaryKey: false },
              { name: 'plain_5', type: 'varchar', isPrimaryKey: false },
            ],
          },
        ],
        [
          'ref_target_1',
          { name: 'ref_target_1', group: 'test', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
        ],
        [
          'ref_target_2',
          { name: 'ref_target_2', group: 'test', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
        ],
        [
          'ref_target_3',
          { name: 'ref_target_3', group: 'test', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
        ],
        [
          'ref_target_4',
          { name: 'ref_target_4', group: 'test', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
        ],
        [
          'ref_target_5',
          { name: 'ref_target_5', group: 'test', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
        ],
        [
          'ref_target_6',
          { name: 'ref_target_6', group: 'test', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
        ],
        [
          'ref_target_7',
          { name: 'ref_target_7', group: 'test', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
        ],
        [
          'ref_target_8',
          { name: 'ref_target_8', group: 'test', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
        ],
        [
          'ref_target_9',
          { name: 'ref_target_9', group: 'test', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
        ],
      ]),
      refs: [
        { id: 'ref1', fromTable: 'test_table', fromColumns: ['fk_1'], toTable: 'ref_target_1', toColumns: ['id'] , fromCardinality: '*', toCardinality: '1' },
        { id: 'ref2', fromTable: 'test_table', fromColumns: ['fk_2'], toTable: 'ref_target_2', toColumns: ['id'] , fromCardinality: '*', toCardinality: '1' },
        { id: 'ref3', fromTable: 'test_table', fromColumns: ['fk_3'], toTable: 'ref_target_3', toColumns: ['id'] , fromCardinality: '*', toCardinality: '1' },
        { id: 'ref4', fromTable: 'test_table', fromColumns: ['fk_4'], toTable: 'ref_target_4', toColumns: ['id'] , fromCardinality: '*', toCardinality: '1' },
        { id: 'ref5', fromTable: 'test_table', fromColumns: ['fk_5'], toTable: 'ref_target_5', toColumns: ['id'] , fromCardinality: '*', toCardinality: '1' },
        { id: 'ref6', fromTable: 'test_table', fromColumns: ['fk_6'], toTable: 'ref_target_6', toColumns: ['id'] , fromCardinality: '*', toCardinality: '1' },
        { id: 'ref7', fromTable: 'test_table', fromColumns: ['fk_7'], toTable: 'ref_target_7', toColumns: ['id'] , fromCardinality: '*', toCardinality: '1' },
        { id: 'ref8', fromTable: 'test_table', fromColumns: ['fk_8'], toTable: 'ref_target_8', toColumns: ['id'] , fromCardinality: '*', toCardinality: '1' },
        { id: 'ref9', fromTable: 'test_table', fromColumns: ['fk_9'], toTable: 'ref_target_9', toColumns: ['id'] , fromCardinality: '*', toCardinality: '1' },
      ],
    };

    const { nodes } = selectionToFlow(syntheticModel, {
      nodes: new Set(['test_table']),
      edges: [],
      full: new Set(['test_table']),
      collapsed: new Set(),
      superGroups: new Map(),
    });
    const node = nodes[0];

    // All 9 FK columns should be visible (exceeds MAX_VISIBLE_COLUMNS).
    expect(node.data.columns.map((c) => c.name)).toEqual([
      'fk_1',
      'fk_2',
      'fk_3',
      'fk_4',
      'fk_5',
      'fk_6',
      'fk_7',
      'fk_8',
      'fk_9',
    ]);
    expect(node.data.hiddenCount).toBe(5); // plain_1..plain_5 are hidden
    expect(node.data.columns.length + node.data.hiddenCount).toBe(node.data.columnCount);
  });
});

describe('mixed detail rendering', () => {
  it('collapsed tables render as tableCompact with COMPACT_H', () => {
    const sel = resolveSelection(model, '.d_customer');
    const { nodes } = selectionToFlow(model, sel);
    const n = nodes.find((x) => x.id === 'model.shop.d_customer')!;
    expect(n.type).toBe('tableCompact');
    expect(n.height).toBe(COMPACT_H);
    expect((n.data as CompactTableNodeData).columnCount).toBeGreaterThan(0);
  });

  it('super-groups render as group nodes and intra-group refs are dropped', () => {
    const sel = resolveSelection(model, '');
    const { nodes, edges } = selectionToFlow(model, sel);
    expect(nodes.every((n) => n.type === 'superGroup')).toBe(true);
    for (const e of edges) expect(e.source).not.toBe(e.target);
  });

  it('empty selector reproduces the old overview graph exactly', () => {
    const sel = resolveSelection(model, '');
    const { nodes, edges } = selectionToFlow(model, sel);
    // group node per group, undirected merged edges with a--b ids and counts
    expect(nodes.map((n) => n.id).sort()).toEqual([...model.groups.keys()].sort());
    expect(nodes).toHaveLength(3);
    const sales = nodes.find((n) => n.id === 'shop.sales')!;
    expect((sales.data as GroupNodeData).tableCount).toBe(3);
    expect((sales.data as GroupNodeData).refCount).toBe(2);
    for (const e of edges) {
      expect(e.id).toBe([e.source, e.target].sort().join('--'));
      expect(e.data.count).toBeGreaterThan(0);
    }
  });

  it('a self-referencing FK on a non-member table still produces an edge', () => {
    const selfRefModel: Model = {
      tables: new Map([
        [
          'employee',
          {
            name: 'employee',
            group: 'org',
            columns: [
              { name: 'id', type: 'int', isPrimaryKey: true },
              { name: 'manager_id', type: 'int', isPrimaryKey: false },
            ],
          },
        ],
      ]),
      refs: [
        { id: 'ref_self', fromTable: 'employee', fromColumns: ['manager_id'], toTable: 'employee', toColumns: ['id'] , fromCardinality: '*', toCardinality: '1' },
      ],
    };
    const { edges } = selectionToFlow(selfRefModel, {
      nodes: new Set(['employee']),
      edges: selfRefModel.refs,
      full: new Set(['employee']),
      collapsed: new Set(),
      superGroups: new Map(),
    });
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('employee');
    expect(edges[0].target).toBe('employee');
    expect(edges[0].data.count).toBe(1);
    expect(edges[0].sourceHandle).toBe('manager_id');
    expect(edges[0].targetHandle).toBe('id');
  });

  it('edges re-anchor onto super-group nodes and merge with counts', () => {
    // f_stock (in shop.inventory) has refs into d_product and d_warehouse, both
    // also members of shop.inventory; forcing f_stock collapsed while the rest
    // of its group stays a super-node yields ONE table->group edge with count 2.
    const sel = resolveSelection(model, '.g:* .model.shop.f_stock');
    const { edges } = selectionToFlow(model, sel);
    const out = edges.filter(
      (e) => e.source === 'model.shop.f_stock' || e.target === 'model.shop.f_stock',
    );
    expect(out.length).toBe(1);
    expect(out[0].data.count).toBe(2);
    for (const e of out) {
      expect(e.sourceHandle).toBeUndefined();
      expect(e.targetHandle).toBeUndefined();
      expect(e.data.fromCardinality).toBeUndefined();
      expect(e.data.toCardinality).toBeUndefined();
    }
  });

  it('full-to-full edges keep column handles and are not merged', () => {
    const sel = resolveSelection(model, 'g:*');
    const { edges } = selectionToFlow(model, sel);
    for (const e of edges) {
      expect(e.sourceHandle).toBeDefined();
      expect(e.data.count).toBe(1);
    }
  });

  it('a single ref between a table and a super-group drops cardinality and column data', () => {
    // model.shop.f_order references model.shop.d_product, which lives inside
    // the shop.inventory super-group; d_product is not itself full/selected.
    const sel = resolveSelection(model, '.g:* f_order');
    const { edges } = selectionToFlow(model, sel);
    const toGroup = edges.find((e) => e.target === 'shop.inventory' || e.source === 'shop.inventory');
    expect(toGroup).toBeDefined();
    expect(toGroup!.data).toEqual({ count: expect.any(Number) });
    expect(toGroup!.data.fromColumn).toBeUndefined();
    expect(toGroup!.data.toColumn).toBeUndefined();
    expect(toGroup!.data.fromCardinality).toBeUndefined();
    expect(toGroup!.data.toCardinality).toBeUndefined();
  });
});

describe('lineage overlay', () => {
  const D_CUSTOMER = 'model.shop.d_customer';
  const D_PRODUCT = 'model.shop.d_product';

  it('emits a table-level lineage edge tagged with kind: lineage', () => {
    const sel = resolveSelection(model, 'f_order+');
    const { edges } = selectionToFlow(model, sel, [{ fromTable: D_CUSTOMER, toTable: FACT }]);
    const lin = edges.find((e) => e.id.startsWith('lin:'))!;
    expect(lin).toBeDefined();
    expect(lin.source).toBe(D_CUSTOMER);
    expect(lin.target).toBe(FACT);
    expect(lin.data.kind).toBe('lineage');
  });

  it('never merges a lineage edge with a ref edge, even between the same pair', () => {
    // The dbml ref runs f_order -> d_product; add a lineage edge on the same pair.
    const sel = resolveSelection(model, 'f_order+');
    const { edges } = selectionToFlow(model, sel, [{ fromTable: FACT, toTable: D_PRODUCT }]);
    const refEdge = edges.find((e) => e.source === FACT && e.target === D_PRODUCT && !e.id.startsWith('lin:'));
    const linEdge = edges.find((e) => e.source === FACT && e.target === D_PRODUCT && e.id.startsWith('lin:'));
    expect(refEdge).toBeDefined();
    expect(linEdge).toBeDefined();
    expect(refEdge!.id).not.toBe(linEdge!.id);
  });

  it('drops lineage edges outside the current selection', () => {
    const sel = resolveSelection(model, 'f_order+');
    const { edges } = selectionToFlow(model, sel, [
      { fromTable: 'model.shop.d_warehouse', toTable: 'model.shop.f_stock' },
    ]);
    expect(edges.some((e) => e.id.startsWith('lin:'))).toBe(false);
  });

  it('drops a lineage edge when either endpoint anchors to a super-group', () => {
    // d_product is dotted-collapsed into shop.inventory; f_order stays a full
    // table node. The lineage edge must never anchor onto the group node.
    const sel = resolveSelection(model, '.g:* group:sales');
    const { edges } = selectionToFlow(model, sel, [{ fromTable: D_PRODUCT, toTable: FACT }]);
    expect(edges.some((e) => e.id.startsWith('lin:'))).toBe(false);
  });

  it('never aggregates lineage onto super-group nodes on the overview', () => {
    const sel = resolveSelection(model, '');
    const { edges } = selectionToFlow(model, sel, [
      { fromTable: D_CUSTOMER, toTable: FACT },
      { fromTable: D_PRODUCT, toTable: FACT },
    ]);
    expect(edges.some((e) => e.id.startsWith('lin:'))).toBe(false);
  });

  it('keeps lineage between two rendered full tables', () => {
    const sel = resolveSelection(model, 'f_order+');
    const { edges } = selectionToFlow(model, sel, [{ fromTable: D_CUSTOMER, toTable: FACT }]);
    const lin = edges.find((e) => e.id.startsWith('lin:'))!;
    expect(lin.source).toBe(D_CUSTOMER);
    expect(lin.target).toBe(FACT);
  });

  it('keeps lineage between two rendered tables when one is collapsed to compact', () => {
    const sel = resolveSelection(model, 'f_order+ .d_customer');
    const { nodes, edges } = selectionToFlow(model, sel, [{ fromTable: D_CUSTOMER, toTable: FACT }]);
    expect(nodes.find((n) => n.id === D_CUSTOMER)!.type).toBe('tableCompact');
    const lin = edges.find((e) => e.id.startsWith('lin:'))!;
    expect(lin).toBeDefined();
    expect(lin.source).toBe(D_CUSTOMER);
    expect(lin.target).toBe(FACT);
  });

  it('dedupes identical lineage pairs without aggregating a count', () => {
    const sel = resolveSelection(model, 'f_order+');
    const { edges } = selectionToFlow(model, sel, [
      { fromTable: D_CUSTOMER, toTable: FACT },
      { fromTable: D_CUSTOMER, toTable: FACT },
    ]);
    const lin = edges.filter((e) => e.id.startsWith('lin:'));
    expect(lin).toHaveLength(1);
  });

  it('with no lineage passed, produces no lin: edges', () => {
    const sel = resolveSelection(model, 'f_order+');
    const { edges } = selectionToFlow(model, sel);
    expect(edges.some((e) => e.id.startsWith('lin:'))).toBe(false);
  });
});
