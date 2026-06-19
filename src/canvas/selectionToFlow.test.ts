import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { resolveSelection } from '@/selection/resolveSelection';
import { selectionToFlow, estimateNodeSize, MAX_VISIBLE_COLUMNS } from '@/canvas/selectionToFlow';
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
        { id: 'ref1', fromTable: 'test_table', fromColumns: ['fk_1'], toTable: 'ref_target_1', toColumns: ['id'] },
        { id: 'ref2', fromTable: 'test_table', fromColumns: ['fk_2'], toTable: 'ref_target_2', toColumns: ['id'] },
        { id: 'ref3', fromTable: 'test_table', fromColumns: ['fk_3'], toTable: 'ref_target_3', toColumns: ['id'] },
        { id: 'ref4', fromTable: 'test_table', fromColumns: ['fk_4'], toTable: 'ref_target_4', toColumns: ['id'] },
        { id: 'ref5', fromTable: 'test_table', fromColumns: ['fk_5'], toTable: 'ref_target_5', toColumns: ['id'] },
        { id: 'ref6', fromTable: 'test_table', fromColumns: ['fk_6'], toTable: 'ref_target_6', toColumns: ['id'] },
        { id: 'ref7', fromTable: 'test_table', fromColumns: ['fk_7'], toTable: 'ref_target_7', toColumns: ['id'] },
        { id: 'ref8', fromTable: 'test_table', fromColumns: ['fk_8'], toTable: 'ref_target_8', toColumns: ['id'] },
        { id: 'ref9', fromTable: 'test_table', fromColumns: ['fk_9'], toTable: 'ref_target_9', toColumns: ['id'] },
      ],
    };

    const { nodes } = selectionToFlow(syntheticModel, { nodes: ['test_table'], edges: [] });
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
