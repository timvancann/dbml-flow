export const HISTORY_KEY = 'dbml-flow:selector-history';
const CAP = 15;

export function loadHistory(storage: Storage = window.localStorage): string[] {
  try {
    const raw = storage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function pushHistory(selector: string, storage: Storage = window.localStorage): string[] {
  const trimmed = selector.trim();
  if (!trimmed) return loadHistory(storage);
  const list = [trimmed, ...loadHistory(storage).filter((s) => s !== trimmed)].slice(0, CAP);
  storage.setItem(HISTORY_KEY, JSON.stringify(list));
  return list;
}
