import { selectorFromSearch, searchWithSelector } from '@/app/persistence';

describe('persistence', () => {
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
