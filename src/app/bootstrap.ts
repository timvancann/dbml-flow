import { selectorFromSearch } from '@/app/persistence';
import { useAppStore } from '@/app/store';

export function looksLikeDbml(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed) return false;
  if (trimmed.startsWith('<')) return false;
  return /Table |Ref:|TableGroup /.test(trimmed);
}

export const BAKED_DBML_URL = `${import.meta.env.BASE_URL}dbml/default.dbml`;

export async function fetchBakedDbml(): Promise<string | null> {
  try {
    const res = await fetch(BAKED_DBML_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    if (!looksLikeDbml(text)) return null;
    return text;
  } catch {
    return null;
  }
}

export async function bootstrap(search: string, fallback: string): Promise<void> {
  const baked = await fetchBakedDbml();
  const content = baked ?? fallback;
  useAppStore.getState().loadDbmlSafe(content);
  const sel = selectorFromSearch(search);
  if (sel) useAppStore.getState().setSelector(sel);
}
