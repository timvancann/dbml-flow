import type { Model } from '@/model/types';

// dbterd names a source entity `source.<package>.<table>` under any
// `resource.*` entity name format, so the first dotted segment is the marker.
export function isSourceTable(name: string): boolean {
  const dot = name.indexOf('.');
  return dot > 0 && name.slice(0, dot) === 'source';
}

export interface SourceFrontier {
  // table -> sources it is (transitively) built from, sorted. Sources map to [].
  sourcesOf: Map<string, string[]>;
  // source -> every table it (transitively) feeds, sorted.
  feeds: Map<string, string[]>;
}

// Walks the Dep graph upstream from every table, through non-source tables,
// until it reaches sources. Memoized per table; a visited stack guards cycles.
export function computeSourceFrontier(model: Pick<Model, 'tables' | 'lineage'>): SourceFrontier {
  const parents = new Map<string, string[]>();
  for (const { fromTable, toTable } of model.lineage) {
    (parents.get(toTable) ?? parents.set(toTable, []).get(toTable)!).push(fromTable);
  }

  const memo = new Map<string, Set<string>>();
  const visiting = new Set<string>();
  let hitStack = false;

  // A result computed while a cycle was open is partial (it skipped a node on
  // the stack), so it is returned but not memoized.
  function upstreamSources(table: string): Set<string> {
    const cached = memo.get(table);
    if (cached) return cached;
    const found = new Set<string>();
    if (visiting.has(table)) {
      hitStack = true;
      return found;
    }
    const outerHit = hitStack;
    hitStack = false;
    visiting.add(table);
    for (const parent of parents.get(table) ?? []) {
      if (isSourceTable(parent)) found.add(parent);
      else for (const s of upstreamSources(parent)) found.add(s);
    }
    visiting.delete(table);
    if (!hitStack) memo.set(table, found);
    hitStack = hitStack || outerHit;
    return found;
  }

  const sourcesOf = new Map<string, string[]>();
  const feeds = new Map<string, string[]>();
  for (const name of model.tables.keys()) {
    const sources = isSourceTable(name) ? [] : [...upstreamSources(name)].sort();
    sourcesOf.set(name, sources);
    for (const s of sources) (feeds.get(s) ?? feeds.set(s, []).get(s)!).push(name);
  }
  for (const list of feeds.values()) list.sort();

  return { sourcesOf, feeds };
}
