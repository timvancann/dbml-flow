import { toggleTableCollapsed, expandGroup, collapseGroup, expandedGroupTokens } from '@/app/selectorEdit';

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
});
