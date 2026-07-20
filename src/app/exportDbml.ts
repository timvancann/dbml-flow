import type { Model } from '@/model/types';
import type { Selection } from '@/selection/resolveSelection';

function quoteName(name: string): string {
  return name.includes('.') ? `"${name}"` : name;
}

function colType(type: string): string {
  return /\s/.test(type) ? `"${type}"` : type;
}

function colList(table: string, cols: string[]): string {
  const t = quoteName(table);
  return cols.length === 1 ? `${t}.${cols[0]}` : `${t}.(${cols.join(', ')})`;
}

export function selectionToDbml(model: Model, selection: Selection): string {
  const blocks: string[] = [];
  for (const name of selection.nodes) {
    const table = model.tables.get(name);
    if (!table) continue;
    const lines = table.columns.map(
      (c) => `  ${c.name} ${colType(c.type)}${c.isPrimaryKey ? ' [pk]' : ''}`,
    );
    blocks.push(`Table ${quoteName(name)} {\n${lines.join('\n')}\n}`);
  }
  for (const ref of selection.edges) {
    blocks.push(`Ref: ${colList(ref.fromTable, ref.fromColumns)} > ${colList(ref.toTable, ref.toColumns)}`);
  }
  return blocks.join('\n\n') + '\n';
}
