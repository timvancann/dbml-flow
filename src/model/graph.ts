import type { Model } from '@/model/types';

export type Direction = 'out' | 'in' | 'both';

export interface Adjacency {
  out: Map<string, Set<string>>;
  in: Map<string, Set<string>>;
}

export function buildAdjacency(model: Model): Adjacency {
  const out = new Map<string, Set<string>>();
  const inn = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, key: string, value: string) => {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  };
  for (const ref of model.refs) {
    if (!model.tables.has(ref.fromTable) || !model.tables.has(ref.toTable)) continue;
    add(out, ref.fromTable, ref.toTable);
    add(inn, ref.toTable, ref.fromTable);
  }
  return { out, in: inn };
}

export function neighbors(
  adjacency: Adjacency,
  start: Iterable<string>,
  direction: Direction,
  hops: number,
): Set<string> {
  const maps =
    direction === 'out' ? [adjacency.out]
    : direction === 'in' ? [adjacency.in]
    : [adjacency.out, adjacency.in];

  // Seed with start nodes that actually exist in the graph (appear in either
  // adjacency map). Non-existent names are dropped so hops=0 returns only real
  // nodes. The selection layer (Plan 2) validates names against model.tables
  // before calling neighbors, so existing-but-isolated tables are handled there.
  const visited = new Set<string>(
    [...start].filter((n) => adjacency.out.has(n) || adjacency.in.has(n)),
  );

  let frontier = new Set<string>(visited);
  for (let depth = 0; depth < hops; depth++) {
    const next = new Set<string>();
    for (const node of frontier) {
      for (const map of maps) {
        for (const adj of map.get(node) ?? []) {
          if (!visited.has(adj)) {
            visited.add(adj);
            next.add(adj);
          }
        }
      }
    }
    if (next.size === 0) break;
    frontier = next;
  }

  return visited;
}

export function shortestPath(adjacency: Adjacency, from: string, to: string): string[] | null {
  const exists = (n: string) => adjacency.out.has(n) || adjacency.in.has(n);
  if (!exists(from) || !exists(to)) return null;
  if (from === to) return [from];

  const prev = new Map<string, string>();
  const visited = new Set<string>([from]);
  let frontier = [from];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const node of frontier) {
      const neighborsOf = [
        ...(adjacency.out.get(node) ?? []),
        ...(adjacency.in.get(node) ?? []),
      ];
      for (const adj of neighborsOf) {
        if (visited.has(adj)) continue;
        visited.add(adj);
        prev.set(adj, node);
        if (adj === to) {
          const path = [to];
          let cur = to;
          while (cur !== from) {
            cur = prev.get(cur)!;
            path.unshift(cur);
          }
          return path;
        }
        next.push(adj);
      }
    }
    frontier = next;
  }
  return null;
}
