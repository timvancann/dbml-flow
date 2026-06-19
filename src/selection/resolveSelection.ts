import { buildAdjacency, neighbors, shortestPath, type Adjacency, type Direction } from '@/model/graph';
import type { Model, Ref } from '@/model/types';
import { matchPiece } from '@/selection/matchPiece';
import { parseSelector, type Atom } from '@/selection/parseSelector';

export interface Selection {
  nodes: Set<string>;
  edges: Ref[];
}

function opToDirection(op: Atom['op']): Direction | null {
  if (op === 'in') return 'in';
  if (op === 'out') return 'out';
  if (op === 'both') return 'both';
  return null;
}

function resolveAtom(model: Model, adjacency: Adjacency, atom: Atom): Set<string> {
  if (atom.op === 'none' && atom.piece.startsWith('path:')) {
    const [aRaw, bRaw] = atom.piece.slice('path:'.length).split('>');
    if (!aRaw || !bRaw) return new Set();
    const from = [...matchPiece(model, aRaw)][0];
    const to = [...matchPiece(model, bRaw)][0];
    if (!from || !to) return new Set();
    const path = shortestPath(adjacency, from, to);
    return new Set(path ?? []);
  }
  const base = matchPiece(model, atom.piece);
  const direction = opToDirection(atom.op);
  if (direction === null) return base;
  const expanded = neighbors(adjacency, base, direction, atom.hops);
  for (const name of base) expanded.add(name);
  return expanded;
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const x of a) if (b.has(x)) result.add(x);
  return result;
}

export function resolveSelection(
  model: Model,
  input: string,
  adjacency: Adjacency = buildAdjacency(model),
): Selection {
  const ast = parseSelector(input);
  const nodes = new Set<string>();

  for (const group of ast.include) {
    let groupSet: Set<string> | null = null;
    for (const atom of group) {
      const atomSet = resolveAtom(model, adjacency, atom);
      groupSet = groupSet === null ? atomSet : intersect(groupSet, atomSet);
    }
    if (groupSet) for (const name of groupSet) nodes.add(name);
  }

  for (const atom of ast.exclude) {
    for (const name of resolveAtom(model, adjacency, atom)) nodes.delete(name);
  }

  const edges = model.refs.filter((r) => nodes.has(r.fromTable) && nodes.has(r.toTable));
  return { nodes, edges };
}
