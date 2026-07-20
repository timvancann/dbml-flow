import type { Model } from '@/model/types';
import type { Selection } from '@/selection/resolveSelection';
import { classifyTable, type TableKind } from '@/canvas/classifyTable';

export const MAX_VISIBLE_COLUMNS = 8;
export const HEADER_H = 46;
export const ROW_H = 26;
export const FOOTER_H = 30;
export const NODE_WIDTH = 248;
export const COMPACT_H = 48;
export const GROUP_W = 200;
export const GROUP_H = 64;

export interface FlowColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isReferenced: boolean;
}

export interface TableNodeData {
  name: string;
  label: string;
  schema: string;
  kind: TableKind;
  columns: FlowColumn[];
  hiddenCount: number;
  columnCount: number;
  fkCount: number;
  pkCount: number;
}

export type CompactTableNodeData = Omit<TableNodeData, 'columns' | 'hiddenCount'>;

export interface GroupNodeData {
  name: string;
  label: string;
  tableCount: number;
  refCount: number;
}

export interface FlowNode {
  id: string;
  type: 'table' | 'tableCompact' | 'superGroup';
  position: { x: number; y: number };
  data: TableNodeData | CompactTableNodeData | GroupNodeData;
  width: number;
  height: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data: {
    count: number;
    fromColumn?: string;
    toColumn?: string;
    fromCardinality?: '1' | '*';
    toCardinality?: '1' | '*';
  };
}

export function estimateNodeSize(data: Pick<TableNodeData, 'columns' | 'hiddenCount'>): {
  width: number;
  height: number;
} {
  const rows = data.columns.length + (data.hiddenCount > 0 ? 1 : 0);
  return { width: NODE_WIDTH, height: HEADER_H + rows * ROW_H + FOOTER_H };
}

export function selectionToFlow(
  model: Model,
  selection: Selection,
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  // FK column names per table, from model refs.
  const fkByTable = new Map<string, Set<string>>();
  const referencedByTable = new Map<string, Set<string>>();
  for (const ref of model.refs) {
    let fkSet = fkByTable.get(ref.fromTable);
    if (!fkSet) {
      fkSet = new Set();
      fkByTable.set(ref.fromTable, fkSet);
    }
    for (const col of ref.fromColumns) fkSet.add(col);

    let refSet = referencedByTable.get(ref.toTable);
    if (!refSet) {
      refSet = new Set();
      referencedByTable.set(ref.toTable, refSet);
    }
    for (const col of ref.toColumns) refSet.add(col);
  }

  const memberToGroup = new Map<string, string>();
  for (const [groupName, members] of selection.superGroups) {
    for (const m of members) memberToGroup.set(m, groupName);
  }

  const nodes: FlowNode[] = [];
  for (const name of selection.nodes) {
    if (memberToGroup.has(name)) continue;
    const table = model.tables.get(name);
    if (!table) continue;
    const fkSet = fkByTable.get(name) ?? new Set<string>();
    const refSet = referencedByTable.get(name) ?? new Set<string>();

    const allColumns: FlowColumn[] = table.columns.map((c) => ({
      name: c.name,
      type: c.type,
      isPrimaryKey: c.isPrimaryKey,
      isForeignKey: fkSet.has(c.name),
      isReferenced: refSet.has(c.name),
    }));

    // Always keep all key columns; fill remaining budget with plain columns.
    const keyCols = allColumns.filter((c) => c.isPrimaryKey || c.isForeignKey || c.isReferenced);
    const plainCols = allColumns.filter((c) => !c.isPrimaryKey && !c.isForeignKey && !c.isReferenced);
    const plainBudget = Math.max(0, MAX_VISIBLE_COLUMNS - keyCols.length);
    const visible = [...keyCols, ...plainCols.slice(0, plainBudget)];
    // Restore original column order within the visible subset.
    const visibleSet = new Set(visible.map((c) => c.name));
    const orderedVisible = allColumns.filter((c) => visibleSet.has(c.name));
    const hiddenCount = allColumns.length - orderedVisible.length;

    const data: TableNodeData = {
      name,
      label: name.split('.').pop() ?? name,
      schema: table.group ?? 'ungrouped',
      kind: classifyTable(name),
      columns: orderedVisible,
      hiddenCount,
      columnCount: allColumns.length,
      fkCount: fkSet.size,
      pkCount: allColumns.filter((c) => c.isPrimaryKey).length,
    };
    if (selection.collapsed.has(name)) {
      const { columns: _columns, hiddenCount: _hiddenCount, ...compact } = data;
      nodes.push({
        id: name,
        type: 'tableCompact',
        position: { x: 0, y: 0 },
        data: compact,
        width: NODE_WIDTH,
        height: COMPACT_H,
      });
    } else {
      const size = estimateNodeSize(data);
      nodes.push({ id: name, type: 'table', position: { x: 0, y: 0 }, data, ...size });
    }
  }

  for (const [groupName, members] of selection.superGroups) {
    const memberSet = new Set(members);
    const refCount = model.refs.filter(
      (r) => memberSet.has(r.fromTable) && memberSet.has(r.toTable),
    ).length;
    nodes.push({
      id: groupName,
      type: 'superGroup',
      position: { x: 0, y: 0 },
      width: GROUP_W,
      height: GROUP_H,
      data: {
        name: groupName,
        label: groupName.split('.').pop() ?? groupName,
        tableCount: members.length,
        refCount,
      },
    });
  }

  const anchor = (table: string): { node: string } =>
    memberToGroup.has(table) ? { node: memberToGroup.get(table)! } : { node: table };

  const merged = new Map<string, FlowEdge>();
  for (const ref of selection.edges) {
    const src = anchor(ref.fromTable);
    const tgt = anchor(ref.toTable);
    // Drop only refs collapsed onto the same super-group node; a genuine
    // self-referencing FK on a non-member table must still produce an edge.
    if (src.node === tgt.node && memberToGroup.has(ref.fromTable)) continue; // intra-super-group

    const srcFull = selection.full.has(ref.fromTable) && src.node === ref.fromTable;
    const tgtFull = selection.full.has(ref.toTable) && tgt.node === ref.toTable;
    const sourceHandle = srcFull ? ref.fromColumns[0] : undefined;
    const targetHandle = tgtFull ? ref.toColumns[0] : undefined;

    const bothGroups = memberToGroup.has(ref.fromTable) && memberToGroup.has(ref.toTable);
    const anyGroup = memberToGroup.has(ref.fromTable) || memberToGroup.has(ref.toTable);
    let source = src.node;
    let target = tgt.node;
    if (bothGroups) [source, target] = [source, target].sort();

    const key = `${source}|${sourceHandle ?? ''}|${target}|${targetHandle ?? ''}`;
    const existing = merged.get(key);
    if (existing) {
      existing.data.count += 1;
      existing.id = bothGroups ? existing.id : `agg:${key}`;
      delete existing.data.fromColumn;
      delete existing.data.toColumn;
      delete existing.data.fromCardinality;
      delete existing.data.toCardinality;
    } else {
      merged.set(key, {
        id: bothGroups ? `${source}--${target}` : ref.id,
        source,
        target,
        sourceHandle,
        targetHandle,
        data: anyGroup
          ? { count: 1 }
          : {
              count: 1,
              fromColumn: ref.fromColumns[0],
              toColumn: ref.toColumns[0],
              fromCardinality: ref.fromCardinality,
              toCardinality: ref.toCardinality,
            },
      });
    }
  }

  return { nodes, edges: [...merged.values()] };
}
