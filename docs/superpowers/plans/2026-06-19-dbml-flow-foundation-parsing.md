# DBML Flow — Foundation, Domain Model & Parsing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a raw DBML string into a fully-indexed, grouped, traversable in-memory graph model, on top of a scaffolded Bun + Vite + React + TypeScript app with working test infrastructure.

**Architecture:** A pure domain layer (`src/model/`) with no UI/React dependencies. `loadModel(dbml)` orchestrates: parse via `@dbml/core` → set group membership (native `TableGroup` first, dbterd `//--configured at schema:` comment fallback second) → assemble `Map`-indexed `Model` with directed FK adjacency. This is the "graph" half of the spec's graph-vs-view spine; the "view"/selection layer is Plan 2.

**Tech Stack:** Bun (package manager/runtime), Vite (dev/build), React + TypeScript, Tailwind CSS v4 + shadcn/ui, `@dbml/core` (parsing), Vitest + @testing-library (tests). Layout/canvas/state libs are installed in later plans.

## Global Constraints

- **Runtime/PM:** Bun. Use `bun`/`bunx`, not `npm`/`npx`, for scripts and installs.
- **`@dbml/core` is pinned to `8.3.0`** exactly. The npm `latest` tag points at a `-metadata` prerelease — do NOT use `^`/`latest`. Install as `@dbml/core@8.3.0`.
- **Parse entry point:** `Parser.parse(content, 'dbml')` from `@dbml/core` (verified against the real fixtures).
- **Domain layer is framework-free:** nothing under `src/model/` may import React, React Flow, Zustand, or DOM APIs. It is plain TypeScript, unit-testable in isolation.
- **FK direction convention:** an `@dbml/core` ref endpoint with `relation === '*'` is the **many/fact (source)** side; `relation === '1'` is the **one/dimension (target)** side. `Ref.fromTable` is the source (fact), `Ref.toTable` is the target (dim).
- **Grouping precedence:** native `TableGroup` membership wins; only tables with no native group fall back to the dbterd comment mapping; remaining tables are ungrouped (`group === undefined`).
- **TDD + frequent commits:** every task is test-first and ends in a commit. Conventional commit messages.
- **Test fixtures** live at `src/model/__fixtures__/raw.dbml` (dbterd comments, 0 native groups) and `src/model/__fixtures__/grouped.dbml` (standard `TableGroup`, 10 groups). Both contain 64 tables and 36 refs.

---

### Task 1: Project scaffold & test infrastructure

**Files:**
- Create: `.gitignore`, `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `vitest.config.ts`, `src/setupTests.ts`, `components.json`
- Create: `src/model/__fixtures__/raw.dbml`, `src/model/__fixtures__/grouped.dbml` (copied from existing root fixtures)
- Test: `src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable app (`bun run dev`), a passing test command (`bun run test`), the `@/*` path alias resolving to `src/*`, and the two fixtures in their test location.

- [ ] **Step 1: Initialize git and ignore file**

```bash
cd /Users/timvancann/repos/private/dbml-flow
git init
printf 'node_modules\ndist\n.DS_Store\n*.local\ncoverage\n' > .gitignore
```

- [ ] **Step 2: Scaffold Vite React-TS into a temp dir and copy in (keeps existing SPEC.md / output*.dbml)**

```bash
rm -rf /tmp/dbml-scaffold
bun create vite /tmp/dbml-scaffold --template react-ts
cp -R /tmp/dbml-scaffold/src /tmp/dbml-scaffold/public /tmp/dbml-scaffold/index.html \
      /tmp/dbml-scaffold/vite.config.ts /tmp/dbml-scaffold/tsconfig*.json \
      /tmp/dbml-scaffold/package.json /Users/timvancann/repos/private/dbml-flow/
cd /Users/timvancann/repos/private/dbml-flow
bun install
```

- [ ] **Step 3: Add Tailwind v4, Vitest, testing libs, and the `@/*` alias**

```bash
bun add tailwindcss @tailwindcss/vite
bun add -d vitest jsdom @testing-library/react @testing-library/jest-dom @types/node
```

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

Replace `src/index.css` with a single line:

```css
@import "tailwindcss";
```

In `tsconfig.json`, add the path alias inside `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

Create `src/setupTests.ts`:

```ts
import '@testing-library/jest-dom';
```

Add scripts to `package.json` (merge into existing `"scripts"`):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Initialize shadcn/ui**

```bash
bunx --bun shadcn@latest init -d
```

Expected: creates `components.json` and `src/lib/utils.ts`, wires Tailwind tokens into `src/index.css`. If it prompts, accept defaults (base color neutral, CSS variables yes).

- [ ] **Step 6: Copy fixtures into the test location**

```bash
mkdir -p src/model/__fixtures__
cp output.dbml src/model/__fixtures__/raw.dbml
cp output.grouped.dbml src/model/__fixtures__/grouped.dbml
```

- [ ] **Step 7: Write the smoke test**

```ts
// src/smoke.test.ts
import { readFileSync } from 'node:fs';

describe('scaffold smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });

  it('can read both fixtures with expected size', () => {
    const raw = readFileSync('src/model/__fixtures__/raw.dbml', 'utf8');
    const grouped = readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8');
    expect(raw).toContain('//--configured at schema:');
    expect(raw).not.toContain('TableGroup');
    expect(grouped).toContain('TableGroup');
  });
});
```

- [ ] **Step 8: Run the smoke test and the dev build**

```bash
bun run test
bun run build
```

Expected: `test` passes (2 tests). `build` completes with no type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold bun+vite+react+ts app with tailwind, shadcn, vitest"
```

---

### Task 2: Domain model types & `buildModel` assembler

**Files:**
- Create: `src/model/types.ts`
- Create: `src/model/buildModel.ts`
- Test: `src/model/buildModel.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure types + assembler).
- Produces:
  - `Column { name: string; type: string; isPrimaryKey: boolean; note?: string }`
  - `Table { name: string; columns: Column[]; group?: string; note?: string }`
  - `Ref { id: string; fromTable: string; fromColumns: string[]; toTable: string; toColumns: string[] }`
  - `Group { name: string; tables: string[] }`
  - `Model { tables: Map<string, Table>; refs: Ref[]; groups: Map<string, Group> }`
  - `buildModel(tables: Table[], refs: Ref[]): Model` — indexes tables by name and derives `groups` from each table's `group` field (single source of truth for grouping).

- [ ] **Step 1: Write the failing test**

```ts
// src/model/buildModel.test.ts
import { buildModel } from '@/model/buildModel';
import type { Table, Ref } from '@/model/types';

const t = (name: string, group?: string): Table => ({ name, columns: [], group });

describe('buildModel', () => {
  it('indexes tables by name', () => {
    const model = buildModel([t('a'), t('b')], []);
    expect(model.tables.size).toBe(2);
    expect(model.tables.get('a')?.name).toBe('a');
  });

  it('derives groups from table.group membership', () => {
    const model = buildModel([t('a', 'g1'), t('b', 'g1'), t('c', 'g2'), t('d')], []);
    expect([...model.groups.keys()].sort()).toEqual(['g1', 'g2']);
    expect(model.groups.get('g1')?.tables.sort()).toEqual(['a', 'b']);
    expect(model.groups.get('g2')?.tables).toEqual(['c']);
  });

  it('keeps refs as-is', () => {
    const ref: Ref = { id: 'r', fromTable: 'a', fromColumns: ['x'], toTable: 'b', toColumns: ['y'] };
    const model = buildModel([t('a'), t('b')], [ref]);
    expect(model.refs).toEqual([ref]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/model/buildModel.test.ts`
Expected: FAIL — cannot find module `@/model/buildModel`.

- [ ] **Step 3: Write the types**

```ts
// src/model/types.ts
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
```

- [ ] **Step 4: Write the assembler**

```ts
// src/model/buildModel.ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bunx vitest run src/model/buildModel.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/model/types.ts src/model/buildModel.ts src/model/buildModel.test.ts
git commit -m "feat: domain model types and buildModel assembler"
```

---

### Task 3: DBML parsing via `@dbml/core`

**Files:**
- Create: `src/model/parseDbml.ts`
- Test: `src/model/parseDbml.test.ts`

**Interfaces:**
- Consumes: `Table`, `Ref` from `@/model/types`.
- Produces: `parseDbml(content: string): { tables: Table[]; refs: Ref[] }`
  - Tables carry `group` set from **native `TableGroup`** membership only (undefined if none).
  - Columns: `isPrimaryKey` is true when the column appears in a `pk` index (`table.indexes[].pk === true`, columns via `index.columns[].value`) or has field-level `pk === true`.
  - Refs: source = `relation === '*'` endpoint, target = the other; `id` is `from.table.cols->to.table.cols`.
  - Throws a `DbmlParseError` (subclass of `Error`) with a readable message if `@dbml/core` throws.

- [ ] **Step 1: Install the parser (pinned)**

```bash
bun add @dbml/core@8.3.0
```

- [ ] **Step 2: Write the failing test**

```ts
// src/model/parseDbml.test.ts
import { readFileSync } from 'node:fs';
import { parseDbml, DbmlParseError } from '@/model/parseDbml';

const raw = readFileSync('src/model/__fixtures__/raw.dbml', 'utf8');
const grouped = readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8');

describe('parseDbml', () => {
  it('parses tables and refs from the raw fixture', () => {
    const { tables, refs } = parseDbml(raw);
    expect(tables).toHaveLength(64);
    expect(refs).toHaveLength(36);
    expect(tables.find((t) => t.name === 'model.shop.d_customer')).toBeDefined();
  });

  it('extracts column name, type, and primary key from index blocks', () => {
    const { tables } = parseDbml(grouped);
    const activiteit = tables.find((t) => t.name === 'model.shop.d_product')!;
    const pkCol = activiteit.columns.find((c) => c.name === 'sk_product')!;
    expect(pkCol.type).toBe('binary');
    expect(pkCol.isPrimaryKey).toBe(true);
    expect(activiteit.columns.find((c) => c.name === 'activiteit_code')!.isPrimaryKey).toBe(false);
  });

  it('sets FK direction: many/fact is source, one/dim is target', () => {
    const { refs } = parseDbml(grouped);
    const ref = refs.find(
      (r) => r.fromTable === 'model.shop.f_order'
        && r.fromColumns.includes('sk_product'),
    )!;
    expect(ref.toTable).toBe('model.shop.d_product');
  });

  it('reads native TableGroup membership (grouped) and none for raw', () => {
    expect(parseDbml(grouped).tables.some((t) => t.group !== undefined)).toBe(true);
    expect(parseDbml(raw).tables.every((t) => t.group === undefined)).toBe(true);
  });

  it('throws DbmlParseError on invalid input', () => {
    expect(() => parseDbml('Table { broken')).toThrow(DbmlParseError);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bunx vitest run src/model/parseDbml.test.ts`
Expected: FAIL — cannot find module `@/model/parseDbml`.

- [ ] **Step 4: Write the parser**

```ts
// src/model/parseDbml.ts
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
    throw new DbmlParseError(error?.message ?? String(error));
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bunx vitest run src/model/parseDbml.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/model/parseDbml.ts src/model/parseDbml.test.ts package.json bun.lock
git commit -m "feat: parse DBML into domain tables and directed refs"
```

---

### Task 4: dbterd comment-group fallback & `loadModel`

**Files:**
- Create: `src/model/recoverCommentGroups.ts`
- Create: `src/model/loadModel.ts`
- Test: `src/model/recoverCommentGroups.test.ts`
- Test: `src/model/loadModel.test.ts`

**Interfaces:**
- Consumes: `parseDbml` (Task 3), `buildModel` (Task 2), `Model` type.
- Produces:
  - `recoverCommentGroups(content: string): Map<string, string>` — maps tableName → group from `//--configured at schema: <group>` comment lines preceding each `Table "<name>"`.
  - `loadModel(content: string): Model` — parse, apply comment fallback to tables without a native group, then `buildModel`. The single public entry point for the domain layer.

- [ ] **Step 1: Write the failing test for the recoverer**

```ts
// src/model/recoverCommentGroups.test.ts
import { readFileSync } from 'node:fs';
import { recoverCommentGroups } from '@/model/recoverCommentGroups';

const raw = readFileSync('src/model/__fixtures__/raw.dbml', 'utf8');

describe('recoverCommentGroups', () => {
  it('maps each table to the schema named in its preceding comment', () => {
    const map = recoverCommentGroups(raw);
    expect(map.get('model.shop.d_customer')).toBe('shop.sales');
    expect(map.get('model.shop.d_employee')).toBe('shop.people');
    expect(map.size).toBe(64);
  });

  it('returns an empty map when there are no such comments', () => {
    expect(recoverCommentGroups('Table "x" {\n  "c" "int"\n}').size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/model/recoverCommentGroups.test.ts`
Expected: FAIL — cannot find module `@/model/recoverCommentGroups`.

- [ ] **Step 3: Write the recoverer**

```ts
// src/model/recoverCommentGroups.ts
const COMMENT_RE = /^\s*\/\/--configured at schema:\s*(.+?)\s*$/;
const TABLE_RE = /^\s*Table\s+"?([^"{\s]+)"?/;

export function recoverCommentGroups(content: string): Map<string, string> {
  const map = new Map<string, string>();
  let pendingGroup: string | null = null;

  for (const line of content.split('\n')) {
    const comment = COMMENT_RE.exec(line);
    if (comment) {
      pendingGroup = comment[1];
      continue;
    }
    const table = TABLE_RE.exec(line);
    if (table) {
      if (pendingGroup) map.set(table[1], pendingGroup);
      pendingGroup = null;
    }
  }

  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/model/recoverCommentGroups.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing test for `loadModel`**

```ts
// src/model/loadModel.test.ts
import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';

const raw = readFileSync('src/model/__fixtures__/raw.dbml', 'utf8');
const grouped = readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8');

describe('loadModel', () => {
  it('builds an indexed model from native TableGroups', () => {
    const model = loadModel(grouped);
    expect(model.tables.size).toBe(64);
    expect(model.groups.size).toBe(10);
  });

  it('recovers the same 10 groups from dbterd comments when native groups are absent', () => {
    const model = loadModel(raw);
    expect(model.groups.size).toBe(10);
    expect(model.tables.get('model.shop.d_customer')?.group)
      .toBe('shop.sales');
  });

  it('prefers native group over the comment fallback', () => {
    // grouped fixture has both comments and native TableGroups; native must win.
    const model = loadModel(grouped);
    const table = model.tables.get('model.shop.d_customer')!;
    expect(table.group).toBe('shop.sales');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bunx vitest run src/model/loadModel.test.ts`
Expected: FAIL — cannot find module `@/model/loadModel`.

- [ ] **Step 7: Write `loadModel`**

```ts
// src/model/loadModel.ts
import { buildModel } from '@/model/buildModel';
import { parseDbml } from '@/model/parseDbml';
import { recoverCommentGroups } from '@/model/recoverCommentGroups';
import type { Model } from '@/model/types';

export function loadModel(content: string): Model {
  const { tables, refs } = parseDbml(content);
  const commentGroups = recoverCommentGroups(content);

  for (const table of tables) {
    if (table.group === undefined) {
      table.group = commentGroups.get(table.name);
    }
  }

  return buildModel(tables, refs);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bunx vitest run src/model/loadModel.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add src/model/recoverCommentGroups.ts src/model/loadModel.ts \
        src/model/recoverCommentGroups.test.ts src/model/loadModel.test.ts
git commit -m "feat: dbterd comment-group fallback and loadModel entry point"
```

---

### Task 5: Directed graph adjacency & traversal primitives

**Files:**
- Create: `src/model/graph.ts`
- Test: `src/model/graph.test.ts`

**Interfaces:**
- Consumes: `Model`, `Ref` from `@/model/types`.
- Produces:
  - `type Direction = 'out' | 'in' | 'both'` — `'out'` follows refs from source→target (fact→dim, "toward dimensions"); `'in'` follows target→source ("toward facts"); `'both'` is undirected.
  - `buildAdjacency(model: Model): Adjacency` where `Adjacency = { out: Map<string, Set<string>>; in: Map<string, Set<string>> }`.
  - `neighbors(adjacency: Adjacency, start: Iterable<string>, direction: Direction, hops: number): Set<string>` — BFS returning the start set plus all tables reachable within `hops` steps in the given direction (start nodes included; `hops === 0` returns just the starts that exist).

  These primitives are what Plan 2's selection resolver (`+x`, `x+`, `~n x`) is built on.

- [ ] **Step 1: Write the failing test**

```ts
// src/model/graph.test.ts
import { buildAdjacency, neighbors } from '@/model/graph';
import { buildModel } from '@/model/buildModel';
import type { Ref, Table } from '@/model/types';

const t = (name: string): Table => ({ name, columns: [] });
const ref = (from: string, to: string): Ref => ({
  id: `${from}->${to}`, fromTable: from, fromColumns: ['x'], toTable: to, toColumns: ['y'],
});

// fact f -> dim d1; fact f -> dim d2; dim d1 -> dim d3 (chain)
const model = buildModel(
  [t('f'), t('d1'), t('d2'), t('d3')],
  [ref('f', 'd1'), ref('f', 'd2'), ref('d1', 'd3')],
);
const adj = buildAdjacency(model);

describe('neighbors', () => {
  it('follows outgoing edges (toward dimensions)', () => {
    expect([...neighbors(adj, ['f'], 'out', 1)].sort()).toEqual(['d1', 'd2', 'f']);
  });

  it('follows incoming edges (toward facts)', () => {
    expect([...neighbors(adj, ['d1'], 'in', 1)].sort()).toEqual(['d1', 'f']);
  });

  it('treats both directions as undirected', () => {
    expect([...neighbors(adj, ['d1'], 'both', 1)].sort()).toEqual(['d1', 'd3', 'f']);
  });

  it('expands multiple hops', () => {
    expect([...neighbors(adj, ['f'], 'out', 2)].sort()).toEqual(['d1', 'd2', 'd3', 'f']);
  });

  it('hops=0 returns only the existing start nodes', () => {
    expect([...neighbors(adj, ['f', 'ghost'], 'both', 0)].sort()).toEqual(['f']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/model/graph.test.ts`
Expected: FAIL — cannot find module `@/model/graph`.

- [ ] **Step 3: Write the graph primitives**

```ts
// src/model/graph.ts
import type { Model } from '@/model/types';

export type Direction = 'out' | 'in' | 'both';

export interface Adjacency {
  out: Map<string, Set<string>>;
  in: Map<string, Set<string>>;
}

export function buildAdjacency(model: Model): Adjacency {
  const out = new Map<string, Set<string>>();
  const inn = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, key: string, value: string) => {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  };
  for (const ref of model.refs) {
    if (!model.tables.has(ref.fromTable) || !model.tables.has(ref.toTable)) continue;
    add(out, ref.fromTable, ref.toTable);
    add(inn, ref.toTable, ref.fromTable);
  }
  return { out, in: inn };
}

export function neighbors(
  adjacency: Adjacency,
  start: Iterable<string>,
  direction: Direction,
  hops: number,
): Set<string> {
  const maps =
    direction === 'out' ? [adjacency.out]
    : direction === 'in' ? [adjacency.in]
    : [adjacency.out, adjacency.in];

  // Seed with start nodes that actually exist in the graph (appear in either
  // adjacency map). Non-existent names are dropped so hops=0 returns only real
  // nodes. The selection layer (Plan 2) validates names against model.tables
  // before calling neighbors, so existing-but-isolated tables are handled there.
  const visited = new Set<string>(
    [...start].filter((n) => adjacency.out.has(n) || adjacency.in.has(n)),
  );

  let frontier = new Set<string>(visited);
  for (let depth = 0; depth < hops; depth++) {
    const next = new Set<string>();
    for (const node of frontier) {
      for (const map of maps) {
        for (const adj of map.get(node) ?? []) {
          if (!visited.has(adj)) {
            visited.add(adj);
            next.add(adj);
          }
        }
      }
    }
    if (next.size === 0) break;
    frontier = next;
  }

  return visited;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/model/graph.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite**

Run: `bun run test`
Expected: PASS — all tests across Tasks 1–5 green.

- [ ] **Step 6: Commit**

```bash
git add src/model/graph.ts src/model/graph.test.ts
git commit -m "feat: directed graph adjacency and neighbor traversal"
```

---

## Self-Review

**Spec coverage (this plan's slice):**
- Parse with `@dbml/core` → Task 3. ✓
- `TableGroup`-first, dbterd-comment fallback → Task 4. ✓
- Graph-vs-view spine, "model" half: immutable indexed model + adjacency → Tasks 2, 5. ✓
- Directional (toward-facts/toward-dims) + undirected traversal foundation → Task 5. ✓
- Framework-free domain layer → enforced by Global Constraints; all of `src/model/` is plain TS. ✓
- Bun + Vite + React + TS + Tailwind + shadcn + Vitest scaffold → Task 1. ✓
- Parse-error surfacing (`DbmlParseError`) → Task 3; UI rendering of the error is Plan 4. ✓
- Deferred to later plans (not gaps): selection DSL (Plan 2), canvas/elkjs (Plan 3), left rail/inspector/persistence/Docker/file-loading (Plan 4).

**Placeholder scan:** No TBD/TODO. Every code step shows complete, runnable code; every command step shows the command and expected result.

**Type consistency:** `Model`, `Table`, `Column`, `Ref`, `Group` defined once in Task 2 and consumed unchanged in Tasks 3–5. `loadModel` (Task 4) is the single public entry; `neighbors`/`buildAdjacency`/`Direction`/`Adjacency` (Task 5) are the named exports Plan 2 will consume. `parseDbml` returns `{ tables, refs }` (no groups) — groups are derived downstream in `buildModel`, consistent across Tasks 3–4.
