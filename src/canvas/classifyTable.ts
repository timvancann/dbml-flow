import { isSourceTable } from '@/model/sourceFrontier';

export type TableKind = 'fact' | 'dim' | 'source' | 'other';

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
  if (isSourceTable(tableName)) return 'source';
  const segment = tableName.split('.').pop()?.toLowerCase() ?? '';
  if (prefixes.fact.some((p) => segment.startsWith(p.toLowerCase()))) return 'fact';
  if (prefixes.dim.some((p) => segment.startsWith(p.toLowerCase()))) return 'dim';
  return 'other';
}
