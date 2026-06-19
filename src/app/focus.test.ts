import { focusSelector, parseFocus } from '@/app/focus';

describe('focus helpers', () => {
  it('builds an attached undirected focus selector', () => {
    expect(focusSelector('f_order')).toBe('~1f_order');
    expect(focusSelector('f_order', 3)).toBe('~3f_order');
  });
  it('parses a lone focus selector', () => {
    expect(parseFocus('~2d_customer')).toEqual({ table: 'd_customer', hops: 2 });
    expect(parseFocus('~d_customer')).toEqual({ table: 'd_customer', hops: 1 });
  });
  it('returns null when not a lone focus atom', () => {
    expect(parseFocus('~1a b')).toBeNull();
    expect(parseFocus('group:sales')).toBeNull();
    expect(parseFocus('')).toBeNull();
  });
});
