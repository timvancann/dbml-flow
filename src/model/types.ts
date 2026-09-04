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

// A lineage edge from a DBML `Dep` block: fromTable is the upstream table,
// toTable the downstream one. Both are always declared tables (the parser
// rejects a Dep whose endpoint is not).
export interface LineageEdge {
  fromTable: string;
  toTable: string;
}

export interface Lineage {
  edges: LineageEdge[];
}

export interface Model {
  tables: Map<string, Table>;
  refs: Ref[];
  groups: Map<string, Group>;
  lineage: LineageEdge[];
}
