import { parseManifest, prettifyLabel } from '@/app/bakedManifest';

describe('prettifyLabel', () => {
  it('turns separators into spaces', () => {
    expect(prettifyLabel('warehouse_prod')).toBe('warehouse prod');
    expect(prettifyLabel('sales-eu')).toBe('sales eu');
  });
});

describe('parseManifest', () => {
  it('parses entries and derives id + label from the file when absent', () => {
    const entries = parseManifest({ databases: [{ file: 'warehouse_prod.dbml' }] });
    expect(entries).toEqual([
      { id: 'warehouse_prod', label: 'warehouse prod', file: 'warehouse_prod.dbml' },
    ]);
  });

  it('keeps an explicit id and label when provided', () => {
    const entries = parseManifest({
      databases: [{ id: 'wh', label: 'Warehouse', file: 'warehouse_prod.dbml' }],
    });
    expect(entries).toEqual([{ id: 'wh', label: 'Warehouse', file: 'warehouse_prod.dbml' }]);
  });

  it('drops entries with no file', () => {
    const entries = parseManifest({ databases: [{ id: 'x' }, { file: 'ok.dbml' }] });
    expect(entries.map((e) => e.id)).toEqual(['ok']);
  });

  it('returns [] for malformed shapes', () => {
    expect(parseManifest(null)).toEqual([]);
    expect(parseManifest({})).toEqual([]);
    expect(parseManifest({ databases: 'nope' })).toEqual([]);
    expect(parseManifest({ databases: [] })).toEqual([]);
  });
});
