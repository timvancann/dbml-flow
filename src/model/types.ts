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

// A dbt-manifest-derived lineage edge: fromTable is the upstream parent,
// toTable is the downstream child (dbt's parent_map direction).
export interface LineageEdge {
  fromTable: string;
  toTable: string;
}

export interface Model {
  tables: Map<string, Table>;
  refs: Ref[];
  groups: Map<string, Group>;
}
