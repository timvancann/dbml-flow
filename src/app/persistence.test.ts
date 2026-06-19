import { selectorFromSearch, searchWithSelector, loadMarts, saveMarts } from '@/app/persistence';

class FakeStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

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

  it('loads marts, tolerating missing/invalid storage', () => {
    const store = new FakeStorage();
    expect(loadMarts(store)).toEqual([]);
    store.setItem('dbmlflow.marts', 'not json');
    expect(loadMarts(store)).toEqual([]);
  });

  it('saves and reloads marts', () => {
    const store = new FakeStorage();
    const marts = [{ name: 'A', selector: 'a' }];
    saveMarts(store, marts);
    expect(loadMarts(store)).toEqual(marts);
  });
});
