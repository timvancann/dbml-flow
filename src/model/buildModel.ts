import type { Group, Model, Ref, Table } from '@/model/types';

export function buildModel(tables: Table[], refs: Ref[]): Model {
  const tableMap = new Map<string, Table>();
  for (const table of tables) tableMap.set(table.name, table);

  const groups = new Map<string, Group>();
  for (const table of tables) {
    if (!table.group) continue;
    let group = groups.get(table.group);
    if (!group) {
      group = { name: table.group, tables: [] };
      groups.set(table.group, group);
    }
    group.tables.push(table.name);
  }

  return { tables: tableMap, refs, groups };
}
