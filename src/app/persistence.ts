export function selectorFromSearch(search: string): string {
  return new URLSearchParams(search).get('s') ?? '';
}

export function searchWithSelector(selector: string): string {
  if (!selector) return '';
  const params = new URLSearchParams();
  params.set('s', selector);
  return `?${params.toString()}`;
}

export type ViewMode = 'refs' | 'lineage' | 'sources';

export function viewFromSearch(search: string): ViewMode | null {
  const v = new URLSearchParams(search).get('v');
  return v === 'refs' || v === 'lineage' || v === 'sources' ? v : null;
}

export function dbFromSearch(search: string): string | null {
  return new URLSearchParams(search).get('db');
}

export function searchWith({ db, selector, view }: { db?: string | null; selector?: string; view?: ViewMode }): string {
  const params = new URLSearchParams();
  if (db) params.set('db', db);
  if (selector) params.set('s', selector);
  if (view && view !== 'refs') params.set('v', view);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
