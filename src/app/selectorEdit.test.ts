import { toggleTableCollapsed, expandGroup, collapseGroup, expandedGroupTokens, collapseAll, expandAll } from '@/app/selectorEdit';

describe('selectorEdit', () => {
  it('collapses a table by appending an exact dotted atom', () => {
    expect(toggleTableCollapsed('group:sales', 'shop.fact_orders', true)).toBe('group:sales .fact_orders');
  });

  it('replaces a prior exact atom for the same table', () => {
    expect(toggleTableCollapsed('group:sales .fact_orders', 'shop.fact_orders', false)).toBe('group:sales fact_orders');
  });

  it('uses the overview base when the selector is empty', () => {
    expect(toggleTableCollapsed('', 'd_customer', true)).toBe('.g:* .d_customer');
  });

  it('expandGroup appends onto the overview base', () => {
    expect(expandGroup('', 'sales')).toBe('.g:* group:sales');
    expect(expandGroup('.g:* group:sales', 'sales')).toBe('.g:* group:sales');
  });

  it('collapseGroup rewrites the token to dotted', () => {
    expect(collapseGroup('.g:* group:sales', 'sales')).toBe('.g:* .group:sales');
  });

  it('expandedGroupTokens lists undotted group tokens', () => {
    expect(expandedGroupTokens('.g:* group:sales g:ops_*')).toEqual([
      { token: 'group:sales', name: 'sales' },
      { token: 'g:ops_*', name: 'ops_*' },
    ]);
  });

  it('expandGroup replaces a collapsed dotted token (round-trip)', () => {
    expect(expandGroup('.g:* .group:sales', 'sales')).toBe('.g:* group:sales');
    expect(expandGroup('.g:* .g:sales', 'sales')).toBe('.g:* group:sales');
  });

  it('collapseAll dots every undotted include token', () => {
    expect(collapseAll('group:sales ~2f_order !d_date')).toBe('.group:sales .~2f_order !d_date');
  });

  it('collapseAll leaves already-dotted tokens unchanged', () => {
    expect(collapseAll('.group:sales fact_orders')).toBe('.group:sales .fact_orders');
  });

  it('collapseAll skips the --exclude keyword and its argument', () => {
    expect(collapseAll('group:sales --exclude fact_orders d_date')).toBe('.group:sales --exclude fact_orders .d_date');
  });

  it('collapseAll on empty selector returns .g:*', () => {
    expect(collapseAll('')).toBe('.g:*');
  });

  it('collapseAll is idempotent', () => {
    const once = collapseAll('group:sales ~2f_order !d_date');
    expect(collapseAll(once)).toBe(once);
  });

  it('expandAll strips one leading dot from every include token', () => {
    expect(expandAll('.group:sales .~2f_order !d_date')).toBe('group:sales ~2f_order !d_date');
  });

  it('expandAll leaves already-undotted tokens unchanged', () => {
    expect(expandAll('.group:sales fact_orders')).toBe('group:sales fact_orders');
  });

  it('expandAll skips the --exclude keyword and its argument', () => {
    expect(expandAll('.group:sales --exclude fact_orders .d_date')).toBe('group:sales --exclude fact_orders d_date');
  });

  it('expandAll on empty selector returns g:*', () => {
    expect(expandAll('')).toBe('g:*');
  });

  it('expandAll is idempotent', () => {
    const once = expandAll('.group:sales .~2f_order !d_date');
    expect(expandAll(once)).toBe(once);
  });
});
