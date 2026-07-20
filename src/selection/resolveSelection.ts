import { buildAdjacency, neighbors, shortestPath, type Adjacency, type Direction } from '@/model/graph';
import type { Model, Ref } from '@/model/types';
import { matchGroups, matchPiece } from '@/selection/matchPiece';
import { parseSelector, type Atom } from '@/selection/parseSelector';

export interface Selection {
  nodes: Set<string>; // every selected table (full + collapsed + super-group members)
  edges: Ref[]; // refs with both endpoints in nodes
  full: Set<string>; // render with columns
  collapsed: Set<string>; // render as compact cards
  superGroups: Map<string, string[]>; // group name -> member tables inside the super-node
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

type Detail = 'full' | 'collapsed';

function isGroupPiece(piece: string): boolean {
  return piece.startsWith('group:') || piece.startsWith('g:');
}

function isExactAtom(atom: Atom): boolean {
  return (
    atom.op === 'none' &&
    !atom.piece.includes('*') &&
    !isGroupPiece(atom.piece) &&
    !atom.piece.startsWith('path:')
  );
}

/** Expanded wins at equal specificity: never downgrade 'full' to 'collapsed'. */
function upsertDetail(map: Map<string, Detail>, name: string, detail: Detail): void {
  if (map.get(name) !== 'full') map.set(name, detail);
}

export function resolveSelection(
  model: Model,
  input: string,
  adjacency: Adjacency = buildAdjacency(model),
): Selection {
  const effective = input.trim() === '' ? '.g:*' : input;
  const ast = parseSelector(effective);

  const generalDetail = new Map<string, Detail>();
  const exactDetail = new Map<string, Detail>();
  const superGroupNames = new Set<string>();

  for (const group of ast.include) {
    // Standalone dotted group atom -> super-node(s).
    if (group.length === 1 && group[0].collapsed && group[0].op === 'none' && isGroupPiece(group[0].piece)) {
      for (const name of matchGroups(model, group[0].piece)) superGroupNames.add(name);
      continue;
    }

    let groupSet: Set<string> | null = null;
    let allCollapsed = true;
    for (const atom of group) {
      if (!atom.collapsed) allCollapsed = false;
      const atomSet = resolveAtom(model, adjacency, atom);
      groupSet = groupSet === null ? atomSet : intersect(groupSet, atomSet);
    }
    if (!groupSet) continue;

    const detail: Detail = allCollapsed ? 'collapsed' : 'full';
    const target = group.length === 1 && isExactAtom(group[0]) ? exactDetail : generalDetail;
    for (const name of groupSet) upsertDetail(target, name, detail);
  }

  // Exact atoms override general matches.
  const tableDetail = new Map<string, Detail>(generalDetail);
  for (const [name, detail] of exactDetail) tableDetail.set(name, detail);

  // Exclusions remove tables everywhere.
  const excluded = new Set<string>();
  for (const atom of ast.exclude) {
    for (const name of resolveAtom(model, adjacency, atom)) excluded.add(name);
  }
  for (const name of excluded) tableDetail.delete(name);

  // Super-groups keep members without table-level detail; drop empty ones.
  const superGroups = new Map<string, string[]>();
  for (const groupName of superGroupNames) {
    const group = model.groups.get(groupName);
    if (!group) continue;
    const members = group.tables.filter((t) => !tableDetail.has(t) && !excluded.has(t));
    if (members.length > 0) superGroups.set(groupName, members);
  }

  const full = new Set<string>();
  const collapsed = new Set<string>();
  for (const [name, detail] of tableDetail) (detail === 'full' ? full : collapsed).add(name);

  const nodes = new Set<string>([...full, ...collapsed]);
  for (const members of superGroups.values()) for (const m of members) nodes.add(m);

  const edges = model.refs.filter((r) => nodes.has(r.fromTable) && nodes.has(r.toTable));
  return { nodes, edges, full, collapsed, superGroups };
}
