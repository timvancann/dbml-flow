import { dbFromSearch, selectorFromSearch } from '@/app/persistence';
import { useAppStore } from '@/app/store';
import { MANIFEST_URL, parseManifest, type DbEntry } from '@/app/bakedManifest';
import { resolveBootstrap } from '@/app/resolveBootstrap';
import { parseDbtManifest } from '@/model/parseDbtManifest';

export function looksLikeDbml(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed) return false;
  if (trimmed.startsWith('<')) return false;
  return /Table |Ref:|TableGroup /.test(trimmed);
}

export const BAKED_DBML_URL = `${import.meta.env.BASE_URL}dbml/default.dbml`;
const dbFileUrl = (file: string) => `${import.meta.env.BASE_URL}dbml/${file}`;

async function fetchDbml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    if (!looksLikeDbml(text)) return null;
    return text;
  } catch {
    return null;
  }
}

export async function fetchBakedDbml(): Promise<string | null> {
  return fetchDbml(BAKED_DBML_URL);
}

// Sibling dbt manifest for a baked/demo dbml file, e.g. `dbml/shop.dbml` ->
// `dbml/shop.dbml.dbt-manifest.json`. 404 (nothing baked) is silently ignored.
async function loadSiblingLineage(dbmlUrl: string): Promise<void> {
  try {
    const res = await fetch(`${dbmlUrl}.dbt-manifest.json`, { cache: 'no-store' });
    if (!res.ok) return;
    const json: unknown = await res.json();
    const model = useAppStore.getState().model;
    if (!model) return;
    const { edges } = parseDbtManifest(json, model);
    useAppStore.getState().setLineage(edges);
  } catch {
    // no dbt manifest for this demo database; nothing to overlay
  }
}

export async function fetchManifest(): Promise<DbEntry[]> {
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) return [];
    return parseManifest(await res.json());
  } catch {
    return [];
  }
}

// Fetch and load one baked database; records it as active. Returns false if the
// file is missing or not DBML (caller decides how to recover).
export async function loadDatabase(entry: DbEntry): Promise<boolean> {
  const content = await fetchDbml(dbFileUrl(entry.file));
  if (content === null) return false;
  useAppStore.getState().loadDbml(content);
  useAppStore.getState().setActiveDatabase(entry.id);
  await loadSiblingLineage(dbFileUrl(entry.file));
  return true;
}

export async function bootstrap(search: string, fallback: string): Promise<void> {
  const databases = await fetchManifest();
  useAppStore.getState().setDatabases(databases);

  const decision = resolveBootstrap(databases, dbFromSearch(search));

  if (decision.kind === 'chooser') return; // UI shows the chooser; nothing loads yet

  if (decision.kind === 'load' && (await loadDatabase(decision.entry))) {
    const sel = selectorFromSearch(search);
    if (sel) useAppStore.getState().setSelector(sel);
    return;
  }

  // fallback (no databases) or a failed direct load: legacy default.dbml → sample
  const baked = await fetchBakedDbml();
  useAppStore.getState().loadDbmlSafe(baked ?? fallback);
  if (baked !== null) await loadSiblingLineage(BAKED_DBML_URL);
  const sel = selectorFromSearch(search);
  if (sel) useAppStore.getState().setSelector(sel);
}
