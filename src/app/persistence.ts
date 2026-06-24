export function selectorFromSearch(search: string): string {
  return new URLSearchParams(search).get('s') ?? '';
}

export function searchWithSelector(selector: string): string {
  if (!selector) return '';
  const params = new URLSearchParams();
  params.set('s', selector);
  return `?${params.toString()}`;
}

export function dbFromSearch(search: string): string | null {
  return new URLSearchParams(search).get('db');
}

export function searchWith({ db, selector }: { db?: string | null; selector?: string }): string {
  const params = new URLSearchParams();
  if (db) params.set('db', db);
  if (selector) params.set('s', selector);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
