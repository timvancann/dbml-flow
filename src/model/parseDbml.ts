import { Parser } from '@dbml/core';
import type { Column, Ref, Table } from '@/model/types';

export class DbmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DbmlParseError';
  }
}

export function parseDbml(content: string): { tables: Table[]; refs: Ref[] } {
  let db: any;
  try {
    // @dbml/core's typings are loose; the runtime signature is parse(content, format).
    db = (Parser as any).parse(content, 'dbml');
  } catch (error: any) {
    const msg = error?.message ?? error?.diags?.[0]?.message ?? String(error);
    throw new DbmlParseError(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  const schemas: any[] = db.schemas ?? [];

  // Native TableGroup membership: tableName -> groupName.
  const groupByTable = new Map<string, string>();
  for (const schema of schemas) {
    for (const group of schema.tableGroups ?? []) {
      for (const member of group.tables ?? []) {
        if (member?.name) groupByTable.set(member.name, group.name);
      }
    }
  }

  const tables: Table[] = [];
  for (const schema of schemas) {
    for (const table of schema.tables ?? []) {
      const pkColumns = new Set<string>();
      for (const index of table.indexes ?? []) {
        if (index.pk) for (const col of index.columns ?? []) pkColumns.add(col.value);
      }
      const columns: Column[] = (table.fields ?? []).map((field: any) => ({
        name: field.name,
        type: field.type?.type_name ?? 'unknown',
        isPrimaryKey: field.pk === true || pkColumns.has(field.name),
        note: extractNote(field.note),
      }));
      tables.push({
        name: table.name,
        columns,
        group: groupByTable.get(table.name),
        note: extractNote(table.note),
      });
    }
  }

  const refs: Ref[] = [];
  for (const schema of schemas) {
    for (const ref of schema.refs ?? []) {
      const [a, b] = ref.endpoints ?? [];
      if (!a || !b) continue;
      const aIsMany = a.relation === '*';
      const from = aIsMany ? a : b;
      const to = aIsMany ? b : a;
      const fromCols: string[] = from.fieldNames ?? [];
      const toCols: string[] = to.fieldNames ?? [];
      refs.push({
        id: `${from.tableName}.${fromCols.join(',')}->${to.tableName}.${toCols.join(',')}`,
        fromTable: from.tableName,
        fromColumns: fromCols,
        toTable: to.tableName,
        toColumns: toCols,
      });
    }
  }

  return { tables, refs };
}

function extractNote(note: unknown): string | undefined {
  if (!note) return undefined;
  if (typeof note === 'string') return note || undefined;
  const value = (note as any).value;
  return typeof value === 'string' && value ? value : undefined;
}
