import { readFileSync } from 'node:fs';
import { recoverCommentGroups } from '@/model/recoverCommentGroups';

const raw = readFileSync('src/model/__fixtures__/raw.dbml', 'utf8');

describe('recoverCommentGroups', () => {
  it('maps each table to the schema named in its preceding comment', () => {
    const map = recoverCommentGroups(raw);
    expect(map.get('model.shop.f_order')).toBe('shop.sales');
    expect(map.get('model.shop.d_product')).toBe('shop.inventory');
    expect(map.size).toBe(8);
  });

  it('returns an empty map when there are no such comments', () => {
    expect(recoverCommentGroups('Table "x" {\n  "c" "int"\n}').size).toBe(0);
  });
});
