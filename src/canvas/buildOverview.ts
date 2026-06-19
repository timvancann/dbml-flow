import type { Model } from '@/model/types';

export interface GroupNodeData {
  name: string;
  label: string;
  tableCount: number;
  refCount: number;
}

export interface OverviewNode {
  id: string;
  type: 'group';
  position: { x: number; y: number };
  data: GroupNodeData;
  width: number;
  height: number;
}

export interface OverviewEdge {
  id: string;
  source: string;
  target: string;
  data: { count: number };
}

export function buildOverview(model: Model): { nodes: OverviewNode[]; edges: OverviewEdge[] } {
  // table name -> group name
  const groupOf = new Map<string, string>();
  for (const group of model.groups.values()) {
    for (const table of group.tables) groupOf.set(table, group.name);
  }

  const intraCount = new Map<string, number>();
  const interCount = new Map<string, number>();
  for (const ref of model.refs) {
    const a = groupOf.get(ref.fromTable);
    const b = groupOf.get(ref.toTable);
    if (!a || !b) continue;
    if (a === b) {
      intraCount.set(a, (intraCount.get(a) ?? 0) + 1);
    } else {
      const key = [a, b].sort().join('|');
      interCount.set(key, (interCount.get(key) ?? 0) + 1);
    }
  }

  const nodes: OverviewNode[] = [];
  for (const group of model.groups.values()) {
    nodes.push({
      id: group.name,
      type: 'group',
      position: { x: 0, y: 0 },
      width: 200,
      height: 64,
      data: {
        name: group.name,
        label: group.name.split('.').pop() ?? group.name,
        tableCount: group.tables.length,
        refCount: intraCount.get(group.name) ?? 0,
      },
    });
  }

  const edges: OverviewEdge[] = [];
  for (const [key, count] of interCount) {
    const [source, target] = key.split('|');
    edges.push({ id: `${source}--${target}`, source, target, data: { count } });
  }

  return { nodes, edges };
}
