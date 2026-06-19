export function selectorFromSearch(search: string): string {
  return new URLSearchParams(search).get('s') ?? '';
}

export function searchWithSelector(selector: string): string {
  if (!selector) return '';
  const params = new URLSearchParams();
  params.set('s', selector);
  return `?${params.toString()}`;
}
