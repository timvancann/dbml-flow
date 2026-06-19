import type { Model } from '@/model/types';
import type { Selection } from '@/selection/resolveSelection';
import { classifyTable, type TableKind } from '@/canvas/classifyTable';

export const MAX_VISIBLE_COLUMNS = 8;
export const HEADER_H = 46;
export const ROW_H = 26;
export const FOOTER_H = 30;
export const NODE_WIDTH = 248;

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

export interface FlowNode {
  id: string;
  type: 'table';
  position: { x: number; y: number };
  data: TableNodeData;
  width: number;
  height: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  data: { fromColumn: string; toColumn: string };
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

  const nodes: FlowNode[] = [];
  for (const name of selection.nodes) {
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
    const size = estimateNodeSize(data);
    nodes.push({ id: name, type: 'table', position: { x: 0, y: 0 }, data, ...size });
  }

  const edges: FlowEdge[] = [];
  for (const ref of selection.edges) {
    edges.push({
      id: ref.id,
      source: ref.fromTable,
      target: ref.toTable,
      sourceHandle: ref.fromColumns[0],
      targetHandle: ref.toColumns[0],
      data: { fromColumn: ref.fromColumns[0], toColumn: ref.toColumns[0] },
    });
  }

  return { nodes, edges };
}
