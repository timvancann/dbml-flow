# DBML Flow — Selection Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile a dbt-style selector string into a visible subgraph (`{ nodes, edges }`) over the Plan 1 model, supporting name/group/wildcard pieces, union/intersection/exclude set algebra, and directional/undirected graph traversal.

**Architecture:** A new framework-free layer `src/selection/`, built on Plan 1's `Model`, `buildAdjacency`, and `neighbors`. Three units: `matchPiece` (a piece → matching table names), `parseSelector` (selector string → AST), `resolveSelection` (AST + model + adjacency → `{ nodes, edges }`). The selector string is the canonical "view" half of the spec's graph-vs-view spine. The visual builder and URL/persistence (later plans) only ever produce/consume this string.

**Tech Stack:** TypeScript, Vitest. No new runtime dependencies. Consumes `@/model/*` from Plan 1.

## Global Constraints

- **Framework-free:** nothing under `src/selection/` may import React, React Flow, Zustand, or DOM APIs. Plain TypeScript, unit-testable in isolation.
- **Whitespace = union.** Tokens separated by whitespace are unioned. Graph operators therefore **attach to the piece with no whitespace**.
- **Comma = intersection**, binds tighter than union, **no surrounding whitespace** (`group:x,*y*` is one intersection term; `group:x , *y*` would parse as three union terms).
- **Operator grammar** (attached):
  - `+piece` → toward-facts, direction `in` (target→source). `N+piece` → N hops.
  - `piece+` → toward-dims, direction `out` (source→target). `piece+N` → N hops.
  - `~piece` → undirected, direction `both`. `~Npiece` → N hops.
  - Bare operator (no number) = **1 hop**. `piece` with no operator = 0 hops (just the matched set).
- **Exclusion:** a token prefixed with `!` OR a token `--exclude` whose following token is the excluded piece. Excludes are full atoms (may carry operators) and are subtracted **after** all includes are unioned. Comma inside an exclude token splits into multiple exclude atoms.
- **Piece matching** (`matchPiece`):
  - `group:NAME` → all tables of every group whose name equals `NAME` or ends with `.NAME`.
  - `g:PATTERN` → all tables of every group whose name matches the `*`-glob `PATTERN` (anchored full match).
  - a piece containing `*` → glob (anchored full match) over full table names.
  - otherwise: exact full-name match if present; else every table whose name ends with `.` + piece (last-segment convenience).
- **Operator-atoms always include their own matched base tables.** `resolveAtom` unions `matchPiece` output back into the `neighbors` result, so an isolated matched table is never dropped (this is the contract Plan 1's `neighbors` deferred to the caller).
- **`resolveSelection(model, input, adjacency?)`** — `adjacency` is optional; when omitted it is built via `buildAdjacency(model)`. Callers that resolve repeatedly (Plan 3/4) pass a memoized adjacency.
- **Edges** of a selection = every `model.refs` entry whose `fromTable` AND `toTable` are both in the node set.
- **Empty / whitespace-only input** resolves to an empty selection (`nodes` empty, `edges` empty). The schema-overview default for an empty selector is a rendering concern handled in Plan 3, not here.
- **TDD + frequent commits**; conventional commit messages. Work directly on `main` (project preference).
- **Fixtures:** reuse Plan 1's `src/model/__fixtures__/grouped.dbml` (64 tables, 10 native groups, 36 refs) via `loadModel`.

---

### Task 1: `matchPiece` — resolve a single piece to table names

**Files:**
- Create: `src/selection/matchPiece.ts`
- Test: `src/selection/matchPiece.test.ts`

**Interfaces:**
- Consumes: `Model` from `@/model/types`.
- Produces: `matchPiece(model: Model, piece: string): Set<string>` per the Global Constraints "Piece matching" rules. Also exports `globToRegExp(glob: string): RegExp` (anchored full-match, `*` → `.*`, all other regex metachars escaped).

- [ ] **Step 1: Write the failing test**

```ts
// src/selection/matchPiece.test.ts
import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { matchPiece } from '@/selection/matchPiece';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const FULL = 'model.shop.d_customer';

describe('matchPiece', () => {
  it('matches an exact full table name', () => {
    expect([...matchPiece(model, FULL)]).toEqual([FULL]);
  });

  it('matches by last segment (convenience)', () => {
    expect([...matchPiece(model, 'd_customer')]).toEqual([FULL]);
  });

  it('matches table names by glob', () => {
    const result = matchPiece(model, '*order*');
    expect(result.has(FULL)).toBe(false);
    expect(result.has('model.shop.f_order')).toBe(true);
    expect(result.has('model.shop.d_employee')).toBe(false);
  });

  it('matches a group by suffix name (group:)', () => {
    const result = matchPiece(model, 'group:sales');
    expect(result.has(FULL)).toBe(true);
    expect(result.has('model.shop.f_stock')).toBe(true);
    expect(result.size).toBe(4);
  });

  it('matches groups by glob (g:)', () => {
    const result = matchPiece(model, 'g:*sales');
    expect(result.has(FULL)).toBe(true);
    expect(result.size).toBe(4);
  });

  it('returns empty set for an unknown piece', () => {
    expect(matchPiece(model, 'does_not_exist').size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/selection/matchPiece.test.ts`
Expected: FAIL — cannot find module `@/selection/matchPiece`.

- [ ] **Step 3: Write the implementation**

```ts
// src/selection/matchPiece.ts
import type { Model } from '@/model/types';

export function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function matchPiece(model: Model, piece: string): Set<string> {
  const result = new Set<string>();

  if (piece.startsWith('group:')) {
    const name = piece.slice('group:'.length);
    for (const group of model.groups.values()) {
      if (group.name === name || group.name.endsWith('.' + name)) {
        for (const table of group.tables) result.add(table);
      }
    }
    return result;
  }

  if (piece.startsWith('g:')) {
    const re = globToRegExp(piece.slice('g:'.length));
    for (const group of model.groups.values()) {
      if (re.test(group.name)) {
        for (const table of group.tables) result.add(table);
      }
    }
    return result;
  }

  if (piece.includes('*')) {
    const re = globToRegExp(piece);
    for (const name of model.tables.keys()) {
      if (re.test(name)) result.add(name);
    }
    return result;
  }

  if (model.tables.has(piece)) {
    result.add(piece);
    return result;
  }

  for (const name of model.tables.keys()) {
    if (name.endsWith('.' + piece)) result.add(name);
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/selection/matchPiece.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/selection/matchPiece.ts src/selection/matchPiece.test.ts
git commit -m "feat: matchPiece resolves name/group/glob selector pieces"
```

---

### Task 2: `parseSelector` — selector string to AST

**Files:**
- Create: `src/selection/parseSelector.ts`
- Test: `src/selection/parseSelector.test.ts`

**Interfaces:**
- Consumes: nothing (pure string → AST).
- Produces:
  - `type Op = 'none' | 'in' | 'out' | 'both'`
  - `interface Atom { op: Op; hops: number; piece: string }`
  - `interface SelectorAst { include: Atom[][]; exclude: Atom[] }` — `include` is a union of intersection-groups (each inner `Atom[]` is intersected); `exclude` is a flat list of atoms subtracted at the end.
  - `parseAtom(raw: string): Atom`
  - `parseSelector(input: string): SelectorAst`

- [ ] **Step 1: Write the failing test**

```ts
// src/selection/parseSelector.test.ts
import { parseAtom, parseSelector } from '@/selection/parseSelector';

describe('parseAtom', () => {
  it('parses a bare piece as op none', () => {
    expect(parseAtom('d_x')).toEqual({ op: 'none', hops: 0, piece: 'd_x' });
  });
  it('parses prefix + as in, 1 hop', () => {
    expect(parseAtom('+d_x')).toEqual({ op: 'in', hops: 1, piece: 'd_x' });
  });
  it('parses N+ as in, N hops', () => {
    expect(parseAtom('2+d_x')).toEqual({ op: 'in', hops: 2, piece: 'd_x' });
  });
  it('parses suffix + as out, 1 hop', () => {
    expect(parseAtom('d_x+')).toEqual({ op: 'out', hops: 1, piece: 'd_x' });
  });
  it('parses +N suffix as out, N hops', () => {
    expect(parseAtom('d_x+3')).toEqual({ op: 'out', hops: 3, piece: 'd_x' });
  });
  it('parses ~ as both, 1 hop and ~N as both N', () => {
    expect(parseAtom('~d_x')).toEqual({ op: 'both', hops: 1, piece: 'd_x' });
    expect(parseAtom('~2d_x')).toEqual({ op: 'both', hops: 2, piece: 'd_x' });
  });
  it('keeps group: and glob pieces intact under operators', () => {
    expect(parseAtom('+group:sales')).toEqual({ op: 'in', hops: 1, piece: 'group:sales' });
    expect(parseAtom('g:sales_*')).toEqual({ op: 'none', hops: 0, piece: 'g:sales_*' });
  });
});

describe('parseSelector', () => {
  it('unions whitespace-separated terms', () => {
    expect(parseSelector('a b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a' }], [{ op: 'none', hops: 0, piece: 'b' }]],
      exclude: [],
    });
  });
  it('intersects comma-separated atoms within a term', () => {
    expect(parseSelector('a,b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a' }, { op: 'none', hops: 0, piece: 'b' }]],
      exclude: [],
    });
  });
  it('collects ! prefix as exclude', () => {
    expect(parseSelector('a !b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a' }]],
      exclude: [{ op: 'none', hops: 0, piece: 'b' }],
    });
  });
  it('collects --exclude <next> as exclude', () => {
    expect(parseSelector('a --exclude b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a' }]],
      exclude: [{ op: 'none', hops: 0, piece: 'b' }],
    });
  });
  it('returns empty AST for empty/whitespace input', () => {
    expect(parseSelector('   ')).toEqual({ include: [], exclude: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/selection/parseSelector.test.ts`
Expected: FAIL — cannot find module `@/selection/parseSelector`.

- [ ] **Step 3: Write the implementation**

```ts
// src/selection/parseSelector.ts
export type Op = 'none' | 'in' | 'out' | 'both';

export interface Atom {
  op: Op;
  hops: number;
  piece: string;
}

export interface SelectorAst {
  include: Atom[][];
  exclude: Atom[];
}

export function parseAtom(raw: string): Atom {
  let m: RegExpExecArray | null;

  // Undirected prefix: ~ or ~N
  if ((m = /^~(\d*)(.+)$/.exec(raw))) {
    return { op: 'both', hops: m[1] ? parseInt(m[1], 10) : 1, piece: m[2] };
  }
  // Toward-facts prefix: + or N+
  if ((m = /^(\d*)\+(.+)$/.exec(raw))) {
    return { op: 'in', hops: m[1] ? parseInt(m[1], 10) : 1, piece: m[2] };
  }
  // Toward-dims suffix: piece+ or piece+N
  if ((m = /^(.+?)\+(\d*)$/.exec(raw))) {
    return { op: 'out', hops: m[2] ? parseInt(m[2], 10) : 1, piece: m[1] };
  }
  return { op: 'none', hops: 0, piece: raw };
}

export function parseSelector(input: string): SelectorAst {
  const tokens = input.trim().split(/\s+/).filter((t) => t.length > 0);
  const include: Atom[][] = [];
  const exclude: Atom[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '--exclude') {
      const next = tokens[i + 1];
      if (next) {
        for (const part of next.split(',')) exclude.push(parseAtom(part));
        i++;
      }
      continue;
    }

    if (token.startsWith('!')) {
      const body = token.slice(1);
      for (const part of body.split(',')) exclude.push(parseAtom(part));
      continue;
    }

    include.push(token.split(',').map(parseAtom));
  }

  return { include, exclude };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/selection/parseSelector.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/selection/parseSelector.ts src/selection/parseSelector.test.ts
git commit -m "feat: parse selector DSL into union/intersection/exclude AST"
```

---

### Task 3: `resolveSelection` — AST + model → `{ nodes, edges }`

**Files:**
- Create: `src/selection/resolveSelection.ts`
- Test: `src/selection/resolveSelection.test.ts`

**Interfaces:**
- Consumes: `matchPiece` (Task 1), `parseSelector`/`Atom`/`Op` (Task 2), `buildAdjacency`/`neighbors`/`Adjacency`/`Direction` and `Model`/`Ref` from Plan 1.
- Produces:
  - `interface Selection { nodes: Set<string>; edges: Ref[] }`
  - `resolveSelection(model: Model, input: string, adjacency?: Adjacency): Selection`

- [ ] **Step 1: Write the failing test**

```ts
// src/selection/resolveSelection.test.ts
import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { resolveSelection } from '@/selection/resolveSelection';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const FACT = 'model.shop.f_order';
const DIM = 'model.shop.d_product';

describe('resolveSelection', () => {
  it('resolves a bare table to just itself', () => {
    const { nodes } = resolveSelection(model, 'f_order');
    expect([...nodes]).toEqual([FACT]);
  });

  it('expands toward dimensions with suffix + (out)', () => {
    const { nodes } = resolveSelection(model, 'f_order+');
    expect(nodes.has(FACT)).toBe(true);
    expect(nodes.has(DIM)).toBe(true);
    expect(nodes.has('model.shop.d_customer')).toBe(true);
  });

  it('expands toward facts with prefix + (in)', () => {
    const { nodes } = resolveSelection(model, '+d_product_extern');
    expect(nodes.has(DIM)).toBe(true);
    expect(nodes.has(FACT)).toBe(true); // a fact that references the dim
  });

  it('derives edges where both endpoints are selected', () => {
    const { edges } = resolveSelection(model, 'f_order+');
    expect(edges.some((e) => e.fromTable === FACT && e.toTable === DIM)).toBe(true);
  });

  it('intersects a group with a glob', () => {
    // *product_* requires the underscore so it does NOT match f_team_productie
    // ("productie"), only the *_product_extern / *_product_intern tables.
    const { nodes } = resolveSelection(model, 'group:sales,*product*');
    expect([...nodes].sort()).toEqual([
      'model.shop.d_product',
    ]);
  });

  it('subtracts excludes', () => {
    const { nodes } = resolveSelection(model, 'group:sales !f_stock');
    expect(nodes.has('model.shop.f_stock')).toBe(false);
    expect(nodes.has('model.shop.d_customer')).toBe(true);
  });

  it('resolves empty input to an empty selection', () => {
    const { nodes, edges } = resolveSelection(model, '');
    expect(nodes.size).toBe(0);
    expect(edges.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/selection/resolveSelection.test.ts`
Expected: FAIL — cannot find module `@/selection/resolveSelection`.

- [ ] **Step 3: Write the implementation**

```ts
// src/selection/resolveSelection.ts
import { buildAdjacency, neighbors, type Adjacency, type Direction } from '@/model/graph';
import type { Model, Ref } from '@/model/types';
import { matchPiece } from '@/selection/matchPiece';
import { parseSelector, type Atom } from '@/selection/parseSelector';

export interface Selection {
  nodes: Set<string>;
  edges: Ref[];
}

function opToDirection(op: Atom['op']): Direction | null {
  if (op === 'in') return 'in';
  if (op === 'out') return 'out';
  if (op === 'both') return 'both';
  return null;
}

function resolveAtom(model: Model, adjacency: Adjacency, atom: Atom): Set<string> {
  const base = matchPiece(model, atom.piece);
  const direction = opToDirection(atom.op);
  if (direction === null) return base;
  const expanded = neighbors(adjacency, base, direction, atom.hops);
  for (const name of base) expanded.add(name);
  return expanded;
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const x of a) if (b.has(x)) result.add(x);
  return result;
}

export function resolveSelection(
  model: Model,
  input: string,
  adjacency: Adjacency = buildAdjacency(model),
): Selection {
  const ast = parseSelector(input);
  const nodes = new Set<string>();

  for (const group of ast.include) {
    let groupSet: Set<string> | null = null;
    for (const atom of group) {
      const atomSet = resolveAtom(model, adjacency, atom);
      groupSet = groupSet === null ? atomSet : intersect(groupSet, atomSet);
    }
    if (groupSet) for (const name of groupSet) nodes.add(name);
  }

  for (const atom of ast.exclude) {
    for (const name of resolveAtom(model, adjacency, atom)) nodes.delete(name);
  }

  const edges = model.refs.filter((r) => nodes.has(r.fromTable) && nodes.has(r.toTable));
  return { nodes, edges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/selection/resolveSelection.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the full suite**

Run: `bun run test`
Expected: PASS — all Plan 1 + Plan 2 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/selection/resolveSelection.ts src/selection/resolveSelection.test.ts
git commit -m "feat: resolve selector AST into subgraph nodes and edges"
```

---

## Self-Review

**Spec coverage (selection slice):**
- Selector DSL: name picks, union (space), intersection (comma), `--exclude`/`!`, `~N` undirected, `+`/`N+`/`+`/`+N` directional, `group:`, `g:` wildcard → Tasks 1–2, exercised in Task 3. ✓
- Directional (toward-facts/toward-dims) + undirected traversal via Plan 1 `neighbors` → Task 3 `resolveAtom`. ✓
- Selector is the canonical view; resolves to `{ nodes, edges }` subgraph → Task 3. ✓
- Closes Plan 1's `neighbors` isolated-node contract: `resolveAtom` unions `matchPiece` base back in → Task 3. ✓
- Empty selector → empty selection (overview deferred to Plan 3) → Task 3. ✓
- Framework-free `src/selection/` → Global Constraints. ✓
- `adjacency` injectable for memoization (perf at scale) → Task 3 signature. ✓

**Placeholder scan:** No TBD/TODO. Every code step has complete, runnable code; every command step has command + expected result.

**Type consistency:** `Op`/`Atom`/`SelectorAst` defined in Task 2, consumed by Task 3 (`Atom['op']`). `Selection` defined in Task 3. Plan 1 imports used unchanged: `Model`/`Ref` (`@/model/types`), `buildAdjacency`/`neighbors`/`Adjacency`/`Direction` (`@/model/graph`), `loadModel` (`@/model/loadModel`). `matchPiece` (Task 1) consumed by Task 3.
