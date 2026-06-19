import { buildModel } from '@/model/buildModel';
import type { Table, Ref } from '@/model/types';

const t = (name: string, group?: string): Table => ({ name, columns: [], group });

describe('buildModel', () => {
  it('indexes tables by name', () => {
    const model = buildModel([t('a'), t('b')], []);
    expect(model.tables.size).toBe(2);
    expect(model.tables.get('a')?.name).toBe('a');
  });

  it('derives groups from table.group membership', () => {
    const model = buildModel([t('a', 'g1'), t('b', 'g1'), t('c', 'g2'), t('d')], []);
    expect([...model.groups.keys()].sort()).toEqual(['g1', 'g2']);
    expect(model.groups.get('g1')?.tables.sort()).toEqual(['a', 'b']);
    expect(model.groups.get('g2')?.tables).toEqual(['c']);
  });

  it('keeps refs as-is', () => {
    const ref: Ref = { id: 'r', fromTable: 'a', fromColumns: ['x'], toTable: 'b', toColumns: ['y'] };
    const model = buildModel([t('a'), t('b')], [ref]);
    expect(model.refs).toEqual([ref]);
  });
});
