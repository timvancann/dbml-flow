import type { SavedMart } from '@/app/store';

const MARTS_KEY = 'dbmlflow.marts';

export function selectorFromSearch(search: string): string {
  return new URLSearchParams(search).get('s') ?? '';
}

export function searchWithSelector(selector: string): string {
  if (!selector) return '';
  const params = new URLSearchParams();
  params.set('s', selector);
  return `?${params.toString()}`;
}

export function loadMarts(storage: Storage): SavedMart[] {
  try {
    const raw = storage.getItem(MARTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMarts(storage: Storage, marts: SavedMart[]): void {
  storage.setItem(MARTS_KEY, JSON.stringify(marts));
}
