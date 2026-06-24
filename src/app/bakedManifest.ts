export interface DbEntry {
  id: string;
  label: string;
  file: string;
}

export const MANIFEST_URL = `${import.meta.env.BASE_URL}dbml/manifest.json`;

export function prettifyLabel(id: string): string {
  return id.replace(/[_-]+/g, ' ');
}

function idFromFile(file: string): string {
  const base = file.split('/').pop() ?? file;
  return base.replace(/\.[^.]+$/, '');
}

// Parse the baked manifest into validated entries. Tolerant: an entry needs only
// a `file`; `id` and `label` are derived from the filename when absent. Returns
// [] for any malformed shape so callers can treat it as "nothing baked".
export function parseManifest(raw: unknown): DbEntry[] {
  if (!raw || typeof raw !== 'object') return [];
  const list = (raw as { databases?: unknown }).databases;
  if (!Array.isArray(list)) return [];

  const entries: DbEntry[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const file = (item as { file?: unknown }).file;
    if (typeof file !== 'string' || !file) continue;
    const id =
      typeof (item as { id?: unknown }).id === 'string' && (item as { id: string }).id
        ? (item as { id: string }).id
        : idFromFile(file);
    const label =
      typeof (item as { label?: unknown }).label === 'string' && (item as { label: string }).label
        ? (item as { label: string }).label
        : prettifyLabel(id);
    entries.push({ id, label, file });
  }
  return entries;
}
