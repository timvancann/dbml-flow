export interface Column {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  note?: string;
}

export interface Table {
  name: string;
  columns: Column[];
  group?: string;
  note?: string;
}

export interface Ref {
  id: string;
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
  fromCardinality: '1' | '*';
  toCardinality: '1' | '*';
}

export interface Group {
  name: string;
  tables: string[];
}

export interface Model {
  tables: Map<string, Table>;
  refs: Ref[];
  groups: Map<string, Group>;
}
