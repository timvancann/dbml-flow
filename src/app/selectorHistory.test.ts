import { describe, expect, it } from 'vitest';
import { loadHistory, pushHistory, HISTORY_KEY } from '@/app/selectorHistory';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  } as Storage;
}

describe('selectorHistory', () => {
  it('pushes, dedupes to front, caps at 15', () => {
    const s = memStorage();
    for (let i = 0; i < 20; i++) pushHistory(`sel_${i}`, s);
    pushHistory('sel_10', s);
    const list = loadHistory(s);
    expect(list[0]).toBe('sel_10');
    expect(list.length).toBe(15);
  });

  it('ignores empty selectors and survives corrupt storage', () => {
    const s = memStorage();
    pushHistory('   ', s);
    expect(loadHistory(s)).toEqual([]);
    s.setItem(HISTORY_KEY, '{not json');
    expect(loadHistory(s)).toEqual([]);
  });
});
