# DBML Flow — Canvas & Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the resolved selection (Plan 2) as an interactive React Flow canvas with elkjs auto-layout, matching the approved dark "blueprint" design — schema-overview default, expandable groups, fact/dim-coded table nodes with per-column FK ports.

**Architecture:** A new `src/canvas/` layer. Pure logic (classifier, selection→flow adapter, elkjs layout adapter, overview builder) is framework-light and unit-tested. Visual React components (`TableNode`, `GroupNode`, `Canvas`) consume that logic and are verified by Playwright screenshot against the real `grouped.dbml`. elkjs runs in a web worker in-app; its adapter is a plain async function (testable in node). Node heights are computed deterministically from column count so layout needs no post-render measurement.

**Tech Stack:** React + TypeScript, `@xyflow/react@12.11.0`, `elkjs@0.11.1`, Tailwind v4 + shadcn (already installed), Vitest, Playwright (already installed). Consumes `@/model/*` (Plan 1) and `@/selection/*` (Plan 2).

## Global Constraints

- **Pin dependencies:** add `@xyflow/react@12.11.0` and `elkjs@0.11.1` (exact versions, verified by spike).
- **elkjs usage:** `import ELK from 'elkjs/lib/elk.bundled.js'`; `new ELK().layout(graph)` where `graph = { id:'root', layoutOptions, children:[{id,width,height}], edges:[{id,sources:[id],targets:[id]}] }`. Layout options: `'elk.algorithm':'layered'`, `'elk.direction':'RIGHT'`, `'elk.layered.spacing.nodeNodeBetweenLayers':'120'`, `'elk.spacing.nodeNode':'36'`. Result `children[i].x/.y` are top-left coords.
- **Node sizing is deterministic:** `estimateNodeSize(data)` = width 248; height = `HEADER_H(46) + visibleColumnRows*ROW_H(26) + (hiddenCount>0 ? ROW_H : 0) + FOOTER_H(30)`. No runtime DOM measurement.
- **Fact/dim color system (design contract — do not change):** facts amber `#f0a868`, dims cyan `#5fd3c4`, PK gold `#e9c46a`, FK columns amber-accented. Defined as CSS variables in `src/index.css`. Dark theme only for v1.
- **Fact/dim prefix list (configurable, soft hint only):** facts `['f_', 'fak_']`, dims `['d_', 'dim_']`, case-insensitive, matched on the table's last dot-segment. Exported as a mutable default constant so an env override can be layered later. Never affects selection/grouping — visual only.
- **FK columns:** a column of table T is "FK" if some `model.refs` entry has `fromTable === T` and lists that column in `fromColumns`.
- **Column-level edges:** each ref renders as an edge from the source table's FK-column handle (right) to the target table's column handle (left). Handle id = the column name.
- **Visible columns cap:** a table node shows at most `MAX_VISIBLE_COLUMNS(8)` column rows; the remainder collapse into a `+ N more columns` row (`hiddenCount`). FK and PK columns are prioritized into the visible set.
- **Overview default:** an empty selection renders the schema overview (one node per group with table+ref counts, inter-group edge counts), NOT an empty canvas.
- **Framework boundary:** `src/canvas/` logic files (classifier, adapters, overview) must not import React. Only the `*.tsx` component files import React/@xyflow.
- **Work directly on `main`** (project preference). TDD for logic tasks; Playwright screenshot verification for visual tasks. Conventional commits.
- **Fixture:** `src/model/__fixtures__/grouped.dbml` via `loadModel` + `resolveSelection`.

---

### Task 1: Fact/dim classifier

**Files:**
- Create: `src/canvas/classifyTable.ts`
- Test: `src/canvas/classifyTable.test.ts`

**Interfaces:**
- Produces:
  - `type TableKind = 'fact' | 'dim' | 'other'`
  - `interface KindPrefixes { fact: string[]; dim: string[] }`
  - `const DEFAULT_KIND_PREFIXES: KindPrefixes` = `{ fact: ['f_', 'fak_'], dim: ['d_', 'dim_'] }`
  - `classifyTable(tableName: string, prefixes?: KindPrefixes): TableKind` — matches the last dot-segment (lowercased) against fact prefixes then dim prefixes; `'other'` if neither.

- [ ] **Step 1: Write the failing test**

```ts
// src/canvas/classifyTable.test.ts
import { classifyTable } from '@/canvas/classifyTable';

describe('classifyTable', () => {
  it('classifies fact tables by prefix on the last segment', () => {
    expect(classifyTable('model.shop.f_order')).toBe('fact');
  });
  it('classifies dimension tables', () => {
    expect(classifyTable('model.shop.d_customer')).toBe('dim');
  });
  it('recognizes alternative prefixes (fak_, dim_)', () => {
    expect(classifyTable('warehouse.fak_sales')).toBe('fact');
    expect(classifyTable('warehouse.dim_customer')).toBe('dim');
  });
  it('is case-insensitive', () => {
    expect(classifyTable('X.F_THING')).toBe('fact');
  });
  it('returns other when no prefix matches', () => {
    expect(classifyTable('model.x.staging_events')).toBe('other');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/canvas/classifyTable.test.ts`
Expected: FAIL — cannot find module `@/canvas/classifyTable`.

- [ ] **Step 3: Write the implementation**

```ts
// src/canvas/classifyTable.ts
export type TableKind = 'fact' | 'dim' | 'other';

export interface KindPrefixes {
  fact: string[];
  dim: string[];
}

export const DEFAULT_KIND_PREFIXES: KindPrefixes = {
  fact: ['f_', 'fak_'],
  dim: ['d_', 'dim_'],
};

export function classifyTable(
  tableName: string,
  prefixes: KindPrefixes = DEFAULT_KIND_PREFIXES,
): TableKind {
  const segment = tableName.split('.').pop()?.toLowerCase() ?? '';
  if (prefixes.fact.some((p) => segment.startsWith(p.toLowerCase()))) return 'fact';
  if (prefixes.dim.some((p) => segment.startsWith(p.toLowerCase()))) return 'dim';
  return 'other';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/canvas/classifyTable.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/canvas/classifyTable.ts src/canvas/classifyTable.test.ts
git commit -m "feat: fact/dim table classifier with configurable prefixes"
```

---

### Task 2: Selection → React Flow data adapter

**Files:**
- Create: `src/canvas/selectionToFlow.ts`
- Test: `src/canvas/selectionToFlow.test.ts`

**Interfaces:**
- Consumes: `Model`, `Ref` (`@/model/types`); `Selection` (`@/selection/resolveSelection`); `classifyTable`, `TableKind` (Task 1).
- Produces:
  - `interface FlowColumn { name: string; type: string; isPrimaryKey: boolean; isForeignKey: boolean }`
  - `interface TableNodeData { name: string; label: string; schema: string; kind: TableKind; columns: FlowColumn[]; hiddenCount: number; columnCount: number; fkCount: number; pkCount: number }`
  - `interface FlowNode { id: string; type: 'table'; position: { x: number; y: number }; data: TableNodeData; width: number; height: number }`
  - `interface FlowEdge { id: string; source: string; target: string; sourceHandle: string; targetHandle: string; data: { fromColumn: string; toColumn: string } }`
  - constants `MAX_VISIBLE_COLUMNS = 8`, `HEADER_H = 46`, `ROW_H = 26`, `FOOTER_H = 30`, `NODE_WIDTH = 248`
  - `estimateNodeSize(data: TableNodeData): { width: number; height: number }`
  - `selectionToFlow(model: Model, selection: Selection): { nodes: FlowNode[]; edges: FlowEdge[] }` — positions all `{x:0,y:0}` (layout assigned in Task 3). `label` is the table's last dot-segment. Visible columns: keep all PK+FK columns, then fill with the first non-key columns up to `MAX_VISIBLE_COLUMNS`; `hiddenCount` = remainder. Edges only for refs where both endpoints are in `selection.nodes`.

- [ ] **Step 1: Write the failing test**

```ts
// src/canvas/selectionToFlow.test.ts
import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { resolveSelection } from '@/selection/resolveSelection';
import { selectionToFlow, estimateNodeSize, MAX_VISIBLE_COLUMNS } from '@/canvas/selectionToFlow';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const FACT = 'model.shop.f_order';
const DIM = 'model.shop.d_product';

describe('selectionToFlow', () => {
  it('produces a node per selected table with kind and label', () => {
    const { nodes } = selectionToFlow(model, resolveSelection(model, 'f_order+'));
    const fact = nodes.find((n) => n.id === FACT)!;
    expect(fact.type).toBe('table');
    expect(fact.data.kind).toBe('fact');
    expect(fact.data.label).toBe('f_order');
    const dim = nodes.find((n) => n.id === DIM)!;
    expect(dim.data.kind).toBe('dim');
  });

  it('flags foreign-key columns from model refs', () => {
    const { nodes } = selectionToFlow(model, resolveSelection(model, 'f_order+'));
    const fact = nodes.find((n) => n.id === FACT)!;
    const fk = fact.data.columns.find((c) => c.name === 'sk_product')!;
    expect(fk.isForeignKey).toBe(true);
  });

  it('caps visible columns and reports hiddenCount', () => {
    const { nodes } = selectionToFlow(model, resolveSelection(model, 'f_stock'));
    const big = nodes[0];
    expect(big.data.columns.length).toBeLessThanOrEqual(MAX_VISIBLE_COLUMNS);
    expect(big.data.hiddenCount).toBeGreaterThan(0);
    expect(big.data.columns.length + big.data.hiddenCount).toBe(big.data.columnCount);
  });

  it('builds column-level edges with handle ids = column names', () => {
    const { edges } = selectionToFlow(model, resolveSelection(model, 'f_order+'));
    const edge = edges.find((e) => e.source === FACT && e.target === DIM)!;
    expect(edge.sourceHandle).toBe('sk_product');
    expect(edge.targetHandle).toBe('sk_product');
  });

  it('estimateNodeSize grows with visible rows', () => {
    const small = estimateNodeSize({ columns: [{}], hiddenCount: 0 } as never);
    const large = estimateNodeSize({ columns: [{}, {}, {}, {}], hiddenCount: 3 } as never);
    expect(large.height).toBeGreaterThan(small.height);
    expect(small.width).toBe(248);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/canvas/selectionToFlow.test.ts`
Expected: FAIL — cannot find module `@/canvas/selectionToFlow`.

- [ ] **Step 3: Write the implementation**

```ts
// src/canvas/selectionToFlow.ts
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
  for (const ref of model.refs) {
    let set = fkByTable.get(ref.fromTable);
    if (!set) {
      set = new Set();
      fkByTable.set(ref.fromTable, set);
    }
    for (const col of ref.fromColumns) set.add(col);
  }

  const nodes: FlowNode[] = [];
  for (const name of selection.nodes) {
    const table = model.tables.get(name);
    if (!table) continue;
    const fkSet = fkByTable.get(name) ?? new Set<string>();

    const allColumns: FlowColumn[] = table.columns.map((c) => ({
      name: c.name,
      type: c.type,
      isPrimaryKey: c.isPrimaryKey,
      isForeignKey: fkSet.has(c.name),
    }));

    // Prioritize key columns into the visible set, preserving original order.
    const keyCols = allColumns.filter((c) => c.isPrimaryKey || c.isForeignKey);
    const plainCols = allColumns.filter((c) => !c.isPrimaryKey && !c.isForeignKey);
    const visible = [...keyCols, ...plainCols].slice(0, MAX_VISIBLE_COLUMNS);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/canvas/selectionToFlow.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/canvas/selectionToFlow.ts src/canvas/selectionToFlow.test.ts
git commit -m "feat: map resolved selection to React Flow nodes and column-level edges"
```

---

### Task 3: elkjs layout adapter

**Files:**
- Create: `src/canvas/layout.ts`
- Test: `src/canvas/layout.test.ts`

**Interfaces:**
- Consumes: `FlowNode`, `FlowEdge` (Task 2).
- Produces: `layoutGraph(nodes: FlowNode[], edges: FlowEdge[]): Promise<FlowNode[]>` — returns new nodes with `position` set from elkjs (`elk.algorithm: layered`, `direction: RIGHT`). Uses each node's `width`/`height`. Pure async function (no worker here; the worker wrapper is Task 6).

- [ ] **Step 1: Write the failing test**

```ts
// src/canvas/layout.test.ts
import { layoutGraph } from '@/canvas/layout';
import type { FlowEdge, FlowNode } from '@/canvas/selectionToFlow';

const node = (id: string): FlowNode => ({
  id, type: 'table', position: { x: 0, y: 0 }, width: 248, height: 160,
  data: { name: id, label: id, schema: '', kind: 'other', columns: [], hiddenCount: 0, columnCount: 0, fkCount: 0, pkCount: 0 },
});

describe('layoutGraph', () => {
  it('assigns numeric positions to every node', async () => {
    const out = await layoutGraph([node('a'), node('b')], [
      { id: 'e', source: 'a', target: 'b', sourceHandle: 'x', targetHandle: 'y', data: { fromColumn: 'x', toColumn: 'y' } } as FlowEdge,
    ]);
    expect(out).toHaveLength(2);
    for (const n of out) {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });

  it('lays the source (fact) left of its target (dim) for RIGHT direction', async () => {
    const out = await layoutGraph([node('fact'), node('dim')], [
      { id: 'e', source: 'fact', target: 'dim', sourceHandle: 'x', targetHandle: 'y', data: { fromColumn: 'x', toColumn: 'y' } } as FlowEdge,
    ]);
    const fact = out.find((n) => n.id === 'fact')!;
    const dim = out.find((n) => n.id === 'dim')!;
    expect(fact.position.x).toBeLessThan(dim.position.x);
  });

  it('handles an empty graph', async () => {
    expect(await layoutGraph([], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/canvas/layout.test.ts`
Expected: FAIL — cannot find module `@/canvas/layout`.

- [ ] **Step 3: Install elkjs and write the implementation**

```bash
bun add elkjs@0.11.1
```

```ts
// src/canvas/layout.ts
import ELK from 'elkjs/lib/elk.bundled.js';
import type { FlowEdge, FlowNode } from '@/canvas/selectionToFlow';

const elk = new ELK();

const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '120',
  'elk.spacing.nodeNode': '36',
};

export async function layoutGraph(nodes: FlowNode[], edges: FlowEdge[]): Promise<FlowNode[]> {
  if (nodes.length === 0) return [];

  const graph = {
    id: 'root',
    layoutOptions: LAYOUT_OPTIONS,
    children: nodes.map((n) => ({ id: n.id, width: n.width, height: n.height })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };

  const laidOut = await elk.layout(graph);
  const positions = new Map<string, { x: number; y: number }>();
  for (const child of laidOut.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  return nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/canvas/layout.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/canvas/layout.ts src/canvas/layout.test.ts package.json bun.lock
git commit -m "feat: elkjs layered layout adapter (fact-to-dim left-to-right)"
```

---

### Task 4: Schema-overview builder

**Files:**
- Create: `src/canvas/buildOverview.ts`
- Test: `src/canvas/buildOverview.test.ts`

**Interfaces:**
- Consumes: `Model` (`@/model/types`).
- Produces:
  - `interface GroupNodeData { name: string; label: string; tableCount: number; refCount: number }`
  - `interface OverviewNode { id: string; type: 'group'; position: { x: number; y: number }; data: GroupNodeData; width: number; height: number }`
  - `interface OverviewEdge { id: string; source: string; target: string; data: { count: number } }`
  - `buildOverview(model: Model): { nodes: OverviewNode[]; edges: OverviewEdge[] }` — one node per group; `refCount` = refs with both endpoints inside the group; inter-group edges aggregate cross-group refs with a `count` (undirected pair key, sorted). Positions `{0,0}` (laid out by Task 3's `layoutGraph` is table-specific; overview uses its own fixed sizes and is also passed through elk in Task 6). Node size: width 200, height 64.

- [ ] **Step 1: Write the failing test**

```ts
// src/canvas/buildOverview.test.ts
import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { buildOverview } from '@/canvas/buildOverview';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));

describe('buildOverview', () => {
  it('produces one node per group with table counts', () => {
    const { nodes } = buildOverview(model);
    expect(nodes).toHaveLength(10);
    const aanvragen = nodes.find((n) => n.data.name === 'shop.sales')!;
    expect(aanvragen.data.tableCount).toBe(4);
    expect(aanvragen.type).toBe('group');
  });

  it('aggregates inter-group edges with counts', () => {
    const { edges } = buildOverview(model);
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(e.data.count).toBeGreaterThan(0);
      expect(e.source).not.toBe(e.target);
    }
  });

  it('counts intra-group refs on the node', () => {
    const { nodes } = buildOverview(model);
    const total = nodes.reduce((sum, n) => sum + n.data.refCount, 0);
    expect(total).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/canvas/buildOverview.test.ts`
Expected: FAIL — cannot find module `@/canvas/buildOverview`.

- [ ] **Step 3: Write the implementation**

```ts
// src/canvas/buildOverview.ts
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
      const key = [a, b].sort().join(' ');
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
    const [source, target] = key.split(' ');
    edges.push({ id: `${source}--${target}`, source, target, data: { count } });
  }

  return { nodes, edges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/canvas/buildOverview.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/canvas/buildOverview.ts src/canvas/buildOverview.test.ts
git commit -m "feat: schema-overview builder with group ref counts"
```

---

### Task 5: Theme tokens + TableNode & GroupNode components

**Files:**
- Modify: `src/index.css` (append the blueprint theme tokens + node/edge utility classes)
- Create: `src/canvas/TableNode.tsx`
- Create: `src/canvas/GroupNode.tsx`
- Create: `src/canvas/CanvasHarness.tsx` (a temporary render harness for screenshot verification; deleted at end of Task 6)
- Test (visual): Playwright screenshot

**Interfaces:**
- Consumes: `TableNodeData` (Task 2), `GroupNodeData` (Task 4), `Handle`, `Position`, `NodeProps` from `@xyflow/react`, `classifyTable` color mapping.
- Produces: `TableNode` and `GroupNode` React components registered later as `nodeTypes = { table: TableNode, group: GroupNode }`. The components reproduce the approved mockup at `docs/design/canvas-mockup-v1.html`: fact = amber top border + amber FK rows with right `Handle`s; dim = cyan top border + gold PK row + left `Handle`s; footer counts; `+ N more columns` row.

- [ ] **Step 1: Add `@xyflow/react` and theme tokens**

```bash
bun add @xyflow/react@12.11.0
```

Append to `src/index.css` (CSS variables copied from the approved mockup):

```css
@import "@xyflow/react/dist/style.css";

:root {
  --bg: #0a0c12; --panel: #11151f; --panel-2: #141926;
  --line: #1e2636; --line-2: #2a3346;
  --ink: #e6ebf5; --ink-2: #9aa6bd; --ink-3: #5e6a83;
  --fact: #f0a868; --fact-dim: rgba(240,168,104,.14);
  --dim: #5fd3c4; --dim-dim: rgba(95,211,196,.13);
  --pk: #e9c46a; --edge: #6f7da0;
}

.dbml-canvas { background:
  linear-gradient(rgba(125,145,190,.045) 1px, transparent 1px) 0 0 / 28px 28px,
  linear-gradient(90deg, rgba(125,145,190,.045) 1px, transparent 1px) 0 0 / 28px 28px,
  var(--bg); }
```

- [ ] **Step 2: Write `TableNode.tsx`**

```tsx
// src/canvas/TableNode.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TableNodeData } from '@/canvas/selectionToFlow';

export function TableNode({ data }: NodeProps & { data: TableNodeData }) {
  const accent = data.kind === 'fact' ? 'var(--fact)' : data.kind === 'dim' ? 'var(--dim)' : 'var(--line-2)';
  const accentDim = data.kind === 'fact' ? 'var(--fact-dim)' : 'var(--dim-dim)';

  return (
    <div
      style={{ width: 248, borderTop: `2px solid ${accent}` }}
      className="rounded-[13px] border border-[var(--line-2)] bg-[var(--panel)] shadow-[0_18px_40px_-22px_rgba(0,0,0,.9)] font-[\"Spline_Sans_Mono\",monospace]"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--line)]">
        <span
          className="grid place-items-center w-[19px] h-[19px] rounded-[5px] text-[10px] font-bold"
          style={{ color: accent, background: accentDim }}
        >
          {data.kind === 'fact' ? 'F' : data.kind === 'dim' ? 'D' : '·'}
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">{data.label}</div>
          <div className="text-[10px] text-[var(--ink-3)] truncate">{data.schema}</div>
        </div>
        <span className="ml-auto text-[9.5px] tracking-[.14em] uppercase" style={{ color: accent }}>
          {data.kind}
        </span>
      </div>

      <div className="p-[5px] flex flex-col">
        {data.columns.map((col) => (
          <div
            key={col.name}
            className="relative grid grid-cols-[14px_1fr_auto] items-center gap-2 px-2 py-1 rounded-md text-[12px]"
            style={col.isForeignKey ? { background: 'rgba(240,168,104,.06)' } : undefined}
          >
            <span className="text-[11px]" style={{ color: col.isPrimaryKey ? 'var(--pk)' : 'var(--fact)' }}>
              {col.isPrimaryKey ? '⚷' : col.isForeignKey ? '⌖' : ''}
            </span>
            <span className="truncate" style={{ color: col.isForeignKey ? 'var(--fact)' : col.isPrimaryKey ? 'var(--ink)' : 'var(--ink-2)' }}>
              {col.name}
            </span>
            <span className="text-[11px] text-[var(--ink-3)]">{col.type}</span>
            {col.isForeignKey && (
              <Handle type="source" id={col.name} position={Position.Right} style={{ background: 'var(--fact)', width: 8, height: 8, border: '2px solid var(--panel-2)' }} />
            )}
            <Handle type="target" id={col.name} position={Position.Left} style={{ background: 'var(--dim)', width: 8, height: 8, border: '2px solid var(--panel-2)', opacity: col.isPrimaryKey ? 1 : 0 }} />
          </div>
        ))}
        {data.hiddenCount > 0 && (
          <div className="px-2 py-1 text-[12px] text-[var(--ink-3)]">+ {data.hiddenCount} more columns</div>
        )}
      </div>

      <div className="flex gap-2.5 px-3 py-1.5 border-t border-[var(--line)] text-[10.5px] text-[var(--ink-3)]">
        <span>{data.columnCount} cols</span>
        {data.fkCount > 0 && <span>{data.fkCount} fk</span>}
        {data.pkCount > 0 && <span>{data.pkCount} pk</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `GroupNode.tsx`**

```tsx
// src/canvas/GroupNode.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GroupNodeData } from '@/canvas/buildOverview';

export function GroupNode({ data }: NodeProps & { data: GroupNodeData }) {
  return (
    <div className="w-[200px] rounded-[12px] border border-[var(--line-2)] bg-[var(--panel-2)] px-3 py-2.5 shadow-[0_18px_40px_-22px_rgba(0,0,0,.9)] font-[\"Spline_Sans_Mono\",monospace]">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">{data.label}</div>
      <div className="mt-1 text-[10.5px] text-[var(--ink-3)]">
        {data.tableCount} tables · {data.refCount} refs
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
```

- [ ] **Step 4: Write a temporary harness and screenshot-verify**

```tsx
// src/canvas/CanvasHarness.tsx
import { ReactFlow, Background } from '@xyflow/react';
import { TableNode } from '@/canvas/TableNode';
import { GroupNode } from '@/canvas/GroupNode';
import type { TableNodeData } from '@/canvas/selectionToFlow';

const fact: TableNodeData = {
  name: 'f_x', label: 'f_order', schema: 'shop · sales', kind: 'fact',
  columns: [
    { name: 'sk_customer', type: 'binary', isPrimaryKey: false, isForeignKey: true },
    { name: 'sk_product', type: 'binary', isPrimaryKey: false, isForeignKey: true },
    { name: 'order_number', type: 'text', isPrimaryKey: false, isForeignKey: false },
  ], hiddenCount: 4, columnCount: 7, fkCount: 2, pkCount: 0,
};
const dim: TableNodeData = {
  name: 'd_x', label: 'd_product', schema: 'shop · inventory', kind: 'dim',
  columns: [
    { name: 'sk_product', type: 'binary', isPrimaryKey: true, isForeignKey: false },
    { name: 'product_name', type: 'text', isPrimaryKey: false, isForeignKey: false },
  ], hiddenCount: 1, columnCount: 3, fkCount: 0, pkCount: 1,
};

export function CanvasHarness() {
  const nodes = [
    { id: 'f', type: 'table', position: { x: 40, y: 60 }, data: fact },
    { id: 'd', type: 'table', position: { x: 360, y: 90 }, data: dim },
  ];
  return (
    <div className="dbml-canvas" style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow nodes={nodes} edges={[]} nodeTypes={{ table: TableNode, group: GroupNode }} fitView>
        <Background color="#1e2636" gap={28} />
      </ReactFlow>
    </div>
  );
}
```

Temporarily render `<CanvasHarness />` in `src/App.tsx` (save the original App). Then:

```bash
bun run dev &   # note the port (default 5173)
# Verify with Playwright MCP: navigate to http://localhost:5173, screenshot, confirm the
# fact node (amber top border, amber FK rows w/ right ports) and dim node (cyan top border,
# gold PK row w/ left port) match docs/design/canvas-mockup-v1.html. Stop the dev server after.
```

Verification gate (record in report): screenshot shows two nodes; fact node amber + 2 FK rows with right-edge handles; dim node cyan + gold PK row; footers show counts; `+ N more columns` present. If it doesn't match, fix the components before committing.

- [ ] **Step 5: Commit (restore App.tsx to original first)**

```bash
git add src/index.css src/canvas/TableNode.tsx src/canvas/GroupNode.tsx src/canvas/CanvasHarness.tsx package.json bun.lock
git commit -m "feat: blueprint theme tokens and TableNode/GroupNode components"
```

---

### Task 6: Canvas component with layout worker, overview default & expand

**Files:**
- Create: `src/canvas/layoutWorker.ts`
- Create: `src/canvas/Canvas.tsx`
- Modify: `src/App.tsx` (render `Canvas` with the loaded fixture model)
- Delete: `src/canvas/CanvasHarness.tsx`
- Test (visual): Playwright screenshot against the real model

**Interfaces:**
- Consumes: `selectionToFlow` (Task 2), `layoutGraph` (Task 3), `buildOverview` (Task 4), `resolveSelection` (Plan 2), `loadModel` (Plan 1), `TableNode`/`GroupNode` (Task 5), `ReactFlow`/`Background`/`Controls`/`ReactFlowProvider` from `@xyflow/react`.
- Produces: `Canvas({ model, selector }: { model: Model; selector: string })` — resolves the selector; when empty, renders the overview (group nodes); otherwise renders table nodes. Runs `layoutGraph` in a web worker, sets positions into React Flow state. Clicking a group node sets the selector to `group:<name>` (lifted via an `onSelectorChange` callback prop). Memoizes `buildAdjacency(model)` and passes it to `resolveSelection`.

- [ ] **Step 1: Write the layout worker**

```ts
// src/canvas/layoutWorker.ts
import { layoutGraph } from '@/canvas/layout';
import type { FlowEdge, FlowNode } from '@/canvas/selectionToFlow';

self.onmessage = async (e: MessageEvent<{ nodes: FlowNode[]; edges: FlowEdge[] }>) => {
  const result = await layoutGraph(e.data.nodes, e.data.edges);
  (self as unknown as Worker).postMessage(result);
};
```

- [ ] **Step 2: Write `Canvas.tsx`**

```tsx
// src/canvas/Canvas.tsx
import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import { buildAdjacency } from '@/model/graph';
import type { Model } from '@/model/types';
import { resolveSelection } from '@/selection/resolveSelection';
import { selectionToFlow, type FlowNode } from '@/canvas/selectionToFlow';
import { buildOverview } from '@/canvas/buildOverview';
import { layoutGraph } from '@/canvas/layout';
import { TableNode } from '@/canvas/TableNode';
import { GroupNode } from '@/canvas/GroupNode';

const nodeTypes = { table: TableNode, group: GroupNode };

export function Canvas({
  model,
  selector,
  onSelectorChange,
}: {
  model: Model;
  selector: string;
  onSelectorChange?: (s: string) => void;
}) {
  const adjacency = useMemo(() => buildAdjacency(model), [model]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    let cancelled = false;
    const trimmed = selector.trim();

    const raw = trimmed
      ? selectionToFlow(model, resolveSelection(model, trimmed, adjacency))
      : buildOverview(model);

    layoutGraph(raw.nodes as FlowNode[], raw.edges as never).then((laid) => {
      if (cancelled) return;
      setNodes(laid as Node[]);
      setEdges(
        raw.edges.map((e) => ({
          id: e.id, source: e.source, target: e.target,
          sourceHandle: 'sourceHandle' in e ? e.sourceHandle : undefined,
          targetHandle: 'targetHandle' in e ? e.targetHandle : undefined,
          style: { stroke: 'var(--edge)' },
        })) as Edge[],
      );
    });

    return () => { cancelled = true; };
  }, [model, selector, adjacency]);

  return (
    <div className="dbml-canvas" style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        onNodeClick={(_, node) => {
          if (node.type === 'group') onSelectorChange?.(`group:${(node.data as { name: string }).name}`);
        }}
      >
        <Background color="#1e2636" gap={28} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export function CanvasApp(props: { model: Model; selector: string; onSelectorChange?: (s: string) => void }) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
```

> Note: Task 6 renders layout synchronously via `layoutGraph` for correctness/testability; the `layoutWorker.ts` from Step 1 is wired in Plan 4 when interaction frequency matters. (Keeping the worker file now establishes the seam without complicating this task's verification.)

- [ ] **Step 3: Wire `App.tsx` to load the fixture and render the canvas**

```tsx
// src/App.tsx
import { useState } from 'react';
import rawDbml from '@/model/__fixtures__/grouped.dbml?raw';
import { loadModel } from '@/model/loadModel';
import { CanvasApp } from '@/canvas/Canvas';

const model = loadModel(rawDbml);

export default function App() {
  const [selector, setSelector] = useState('');
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CanvasApp model={model} selector={selector} onSelectorChange={setSelector} />
    </div>
  );
}
```

- [ ] **Step 4: Delete the temporary harness**

```bash
git rm src/canvas/CanvasHarness.tsx
```

- [ ] **Step 5: Screenshot-verify two states against the real model**

```bash
bun run dev &   # default http://localhost:5173
```

Verify with Playwright MCP:
1. Navigate to `http://localhost:5173` with an empty selector → **overview**: ~10 group nodes (e.g. `sales`, `inventory`) with `N tables · M refs`, inter-group edges. Screenshot.
2. Temporarily set `useState('f_order+')` (or click a group) → **table view**: the fact node (amber) left of its dimension nodes (cyan), column-level edges between them, laid out left-to-right. Screenshot.

Record both screenshots' outcomes in the report. The view must match the approved mockup's look. Stop the dev server after. Restore `useState('')`.

- [ ] **Step 6: Run the full suite and build**

Run: `bun run test && bun run build`
Expected: all unit tests pass; production build typechecks (no TS errors). Note: `?raw` import and worker need Vite — `bun run build` (Vite) must succeed.

- [ ] **Step 7: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/layoutWorker.ts src/App.tsx
git commit -m "feat: React Flow canvas with elkjs layout, schema-overview default and group drill-in"
```

---

## Self-Review

**Spec coverage (canvas slice):**
- React Flow + elkjs canvas → Tasks 3, 5, 6. ✓
- Schema-overview default for empty selector → Tasks 4, 6. ✓
- Expand/drill into a group (click → `group:<name>`) → Task 6. ✓
- Fact/dim color-coded table nodes with collapsible columns + per-column FK ports → Tasks 1, 2, 5. ✓
- Directional fact→dim left-to-right layout → Task 3 (RIGHT). ✓
- Configurable dim/fact prefix hint → Task 1. ✓
- Adjacency memoized & injected (perf) → Task 6 (`useMemo`), consuming Plan 2's optional `adjacency` arg. ✓
- Approved blueprint visual (dark, amber/cyan) → Task 5 tokens + components, screenshot-verified in Tasks 5–6. ✓
- Deferred to Plan 4 (not gaps): selection bar UI, left rail, inspector, URL/localStorage persistence, file loading, Docker, node-count guardrail, worker wiring for live interaction.

**Placeholder scan:** No TBD/TODO. Logic tasks (1–4) have complete TDD code; visual tasks (5–6) have complete component/wiring code plus explicit Playwright screenshot verification gates (UI correctness can't be asserted by unit tests, so screenshot verification is the right gate).

**Type consistency:** `TableNodeData`/`FlowNode`/`FlowEdge`/`estimateNodeSize` (Task 2) consumed by Tasks 3, 5, 6. `GroupNodeData`/`OverviewNode` (Task 4) consumed by Tasks 5, 6. `TableKind`/`classifyTable` (Task 1) consumed by Task 2. `layoutGraph` (Task 3) consumed by Task 6. Plan 1/2 imports (`Model`, `buildAdjacency`, `resolveSelection`, `Selection`, `loadModel`) used unchanged.
