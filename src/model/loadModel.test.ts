import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';

const raw = readFileSync('src/model/__fixtures__/raw.dbml', 'utf8');
const grouped = readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8');

describe('loadModel', () => {
  it('builds an indexed model from native TableGroups', () => {
    const model = loadModel(grouped);
    expect(model.tables.size).toBe(8);
    expect(model.groups.size).toBe(3);
  });

  it('recovers the same 3 groups from dbterd comments when native groups are absent', () => {
    const model = loadModel(raw);
    expect(model.groups.size).toBe(3);
    expect(model.tables.get('model.shop.d_customer')?.group)
      .toBe('shop.sales');
  });

  it('prefers native group over the comment fallback', () => {
    // grouped fixture has both comments and native TableGroups; native must win.
    const model = loadModel(grouped);
    const table = model.tables.get('model.shop.d_customer')!;
    expect(table.group).toBe('shop.sales');
  });
});
