import { selectorFromSearch, searchWithSelector, dbFromSearch, searchWith, viewFromSearch } from '@/app/persistence';

describe('persistence', () => {
  it('reads the active database from a search string', () => {
    expect(dbFromSearch('?db=warehouse_prod')).toBe('warehouse_prod');
    expect(dbFromSearch('?s=x')).toBeNull();
    expect(dbFromSearch('')).toBeNull();
  });

  it('encodes db and selector together, omitting empties', () => {
    expect(searchWith({ db: 'analytics', selector: 'f_x+' })).toBe('?db=analytics&s=f_x%2B');
    expect(searchWith({ db: 'analytics', selector: '' })).toBe('?db=analytics');
    expect(searchWith({ db: null, selector: 'f_x' })).toBe('?s=f_x');
    expect(searchWith({ db: null, selector: '' })).toBe('');
  });

  it('round-trips db + selector through search', () => {
    const out = searchWith({ db: 'analytics', selector: 'group:sales' });
    expect(dbFromSearch(out)).toBe('analytics');
    expect(selectorFromSearch(out)).toBe('group:sales');
  });

  it('reads selector from a search string', () => {
    expect(selectorFromSearch('?s=group%3Asales')).toBe('group:sales');
    expect(selectorFromSearch('')).toBe('');
  });

  it('encodes selector into a search string, empty -> ""', () => {
    expect(searchWithSelector('f_x+')).toBe('?s=f_x%2B');
    expect(searchWithSelector('')).toBe('');
  });

  it('round-trips selector through search', () => {
    const s = 'group:sales,*.f_* !f_shipment';
    expect(selectorFromSearch(searchWithSelector(s))).toBe(s);
  });
});

describe('persistence: view mode', () => {
  it('reads v from a search string, null when absent or unknown', () => {
    expect(viewFromSearch('?s=x&v=sources')).toBe('sources');
    expect(viewFromSearch('?v=lineage')).toBe('lineage');
    expect(viewFromSearch('?v=bogus')).toBeNull();
    expect(viewFromSearch('')).toBeNull();
  });

  it('writes v only for non-default views, so refs links are unchanged', () => {
    expect(searchWith({ db: 'shop', selector: 'f_x', view: 'sources' })).toBe('?db=shop&s=f_x&v=sources');
    expect(searchWith({ db: 'shop', selector: 'f_x', view: 'refs' })).toBe('?db=shop&s=f_x');
    expect(searchWith({ db: 'shop', selector: 'f_x' })).toBe('?db=shop&s=f_x');
  });
});
