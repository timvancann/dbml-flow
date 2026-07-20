import { readFileSync } from 'node:fs';
import { parseDbml, DbmlParseError } from '@/model/parseDbml';

const raw = readFileSync('src/model/__fixtures__/raw.dbml', 'utf8');
const grouped = readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8');

describe('parseDbml', () => {
  it('parses tables and refs from the raw fixture', () => {
    const { tables, refs } = parseDbml(raw);
    expect(tables).toHaveLength(8);
    expect(refs).toHaveLength(9);
    expect(tables.find((t) => t.name === 'model.shop.f_order')).toBeDefined();
  });

  it('extracts column name, type, and primary key from index blocks', () => {
    const { tables } = parseDbml(grouped);
    const product = tables.find((t) => t.name === 'model.shop.d_product')!;
    const pkCol = product.columns.find((c) => c.name === 'sk_product')!;
    expect(pkCol.type).toBe('integer');
    expect(pkCol.isPrimaryKey).toBe(true);
    expect(product.columns.find((c) => c.name === 'product_name')!.isPrimaryKey).toBe(false);
  });

  it('sets FK direction: many/fact is source, one/dim is target', () => {
    const { refs } = parseDbml(grouped);
    const ref = refs.find(
      (r) => r.fromTable === 'model.shop.f_order'
        && r.fromColumns.includes('sk_product'),
    )!;
    expect(ref.toTable).toBe('model.shop.d_product');
  });

  it('captures endpoint cardinalities', () => {
    const { refs } = parseDbml(grouped);
    const ref = refs.find(
      (r) => r.fromTable === 'model.shop.f_order'
        && r.fromColumns.includes('sk_product'),
    )!;
    expect(ref.fromCardinality).toBe('*');
    expect(ref.toCardinality).toBe('1');
  });

  it('reads native TableGroup membership (grouped) and none for raw', () => {
    expect(parseDbml(grouped).tables.some((t) => t.group !== undefined)).toBe(true);
    expect(parseDbml(raw).tables.every((t) => t.group === undefined)).toBe(true);
  });

  it('throws DbmlParseError on invalid input', () => {
    expect(() => parseDbml('Table { broken')).toThrow(DbmlParseError);
  });
});
