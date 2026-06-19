import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { selectorCompletions } from '@/app/selectorCompletions';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const labels = (text: string) => selectorCompletions(model, text).options.map((o) => o.label);

describe('selectorCompletions', () => {
  it('suggests table last-segments for a bare token', () => {
    const r = selectorCompletions(model, 'd_cust');
    expect(r.from).toBe(0);
    expect(r.options.map((o) => o.label)).toContain('d_customer');
  });
  it('preserves a leading operator on table suggestions', () => {
    expect(labels('~d_cu')).toContain('~d_customer');
    expect(labels('+f_or')).toContain('+f_order');
  });
  it('suggests group segments after group:', () => {
    const r = selectorCompletions(model, 'group:sal');
    expect(r.from).toBe('group:'.length);
    expect(r.options.map((o) => o.label)).toContain('sales');
  });
  it('suggests the second table after path:a>', () => {
    const r = selectorCompletions(model, 'path:f_order>d_war');
    expect(r.from).toBe('path:f_order>'.length);
    expect(r.options.map((o) => o.label)).toContain('d_warehouse');
  });
  it('suggests keyword prefixes for a fresh token', () => {
    expect(labels('gr')).toContain('group:');
    expect(labels('pa')).toContain('path:');
  });
  it('completions are scoped to the last whitespace token', () => {
    const r = selectorCompletions(model, 'group:sales d_cust');
    expect(r.from).toBe('group:sales '.length);
    expect(r.options.map((o) => o.label)).toContain('d_customer');
  });
  it('matches substrings inside table names (no prefix needed)', () => {
    expect(labels('order')).toContain('f_order');
    expect(labels('house')).toContain('d_warehouse');
    expect(labels('product')).toContain('d_product');
  });
  it('matches substrings case-insensitively and preserves operators', () => {
    expect(labels('ORDER')).toContain('f_order');
    expect(labels('~order')).toContain('~f_order');
  });
  it('matches substrings inside group names', () => {
    // synthetic groups: shop.sales / shop.inventory / shop.people
    expect(labels('group:vent')).toContain('inventory');
  });
  it('ranks a prefix match before a substring-only match', () => {
    // 'd_p' is a prefix of d_product and not a substring of any other table
    const opts = labels('d_p');
    expect(opts[0]).toBe('d_product');
  });
});
