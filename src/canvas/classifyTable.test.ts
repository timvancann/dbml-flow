import { classifyTable } from '@/canvas/classifyTable';

describe('classifyTable', () => {
  it('classifies fact tables by prefix on the last segment', () => {
    expect(classifyTable('model.shop.f_order')).toBe('fact');
  });
  it('classifies dimension tables', () => {
    expect(classifyTable('model.shop.d_customer')).toBe('dim');
  });
  it('recognizes alternative prefixes (fak_, dim_)', () => {
    expect(classifyTable('warehouse.fak_sales')).toBe('fact');
    expect(classifyTable('warehouse.dim_customer')).toBe('dim');
  });
  it('is case-insensitive', () => {
    expect(classifyTable('X.F_THING')).toBe('fact');
  });
  it('returns other when no prefix matches', () => {
    expect(classifyTable('model.x.staging_events')).toBe('other');
  });
});

describe('classifyTable: sources', () => {
  it('classifies a dbterd source entity (first segment "source") as source', () => {
    expect(classifyTable('source.shop.orders')).toBe('source');
  });
  it('does not treat a model whose last segment starts with source as a source', () => {
    expect(classifyTable('model.shop.source_of_truth')).toBe('other');
  });
});
