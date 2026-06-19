export type TableKind = 'fact' | 'dim' | 'other';

export interface KindPrefixes {
  fact: string[];
  dim: string[];
}

export const DEFAULT_KIND_PREFIXES: KindPrefixes = {
  fact: ['f_', 'fak_'],
  dim: ['d_', 'dim_'],
};

export function classifyTable(
  tableName: string,
  prefixes: KindPrefixes = DEFAULT_KIND_PREFIXES,
): TableKind {
  const segment = tableName.split('.').pop()?.toLowerCase() ?? '';
  if (prefixes.fact.some((p) => segment.startsWith(p.toLowerCase()))) return 'fact';
  if (prefixes.dim.some((p) => segment.startsWith(p.toLowerCase()))) return 'dim';
  return 'other';
}
