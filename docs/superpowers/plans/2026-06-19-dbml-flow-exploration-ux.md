# DBML Flow — Exploration UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the exploration affordances users asked for: a `path:A>B` shortest-path operator, a de-duplicated chips-as-builder selection bar, click-to-focus with a hop stepper, and a path-finding mode — all routed through the existing selector-string spine.

**Architecture:** One new engine primitive (`shortestPath` BFS in `src/model/graph.ts`) wired into the selection resolver as a `path:` piece. Everything else is front-end in `src/app/` over the existing Zustand store; the selector string remains the single source of truth (focus = `~N table`, path = `path:A>B`).

**Tech Stack:** React + TS, Zustand, React Flow, Vitest, Playwright. Consumes `@/model/*`, `@/selection/*`, `@/canvas/*`, `@/app/*`.

## Global Constraints

- **Selector string stays the single source of truth.** Focus and path produce/edit selector strings; no parallel selection state. Path-mode's *in-progress pick* (start table chosen, target pending) is transient UI state and may live in the store, but the committed result is a `path:A>B` selector.
- **`path:A>B` semantics:** undirected shortest path (fewest FK hops, either direction) between the tables matched by `A` and `B` (each resolved via `matchPiece`, first match). Resolves to the path's node set; if no path exists or an endpoint is unknown, resolves to empty. Edges use the standard "both endpoints selected" filter.
- **Focus semantics:** clicking a table (canvas node / rail row / inspector title) sets the selector to `~1 <last-segment>` (undirected, 1 hop, both directions). The hop stepper is shown only when the current selector is a single lone `~N <table>` atom; +/- rewrites `N` (min 1).
- **Framework boundary:** `src/model/graph.ts` stays React-free. UI lives in `*.tsx`.
- **Reuse:** path matching uses `matchPiece`; do not re-implement name resolution. Chips use `parseSelector`.
- **Design contract:** dark blueprint; reuse existing CSS vars; inline `style={{fontFamily}}` for the mockup fonts (Tailwind escaped-quote font classes don't compile in this bundler).
- **Work on `main`.** TDD for logic (Tasks 1–2); Playwright screenshot verification for visual tasks (3–5). Conventional commits; run `bun run test` AND `bun run build` before each commit (vitest does not typecheck).

---

### Task 1: `shortestPath` BFS in the graph

**Files:**
- Modify: `src/model/graph.ts`
- Test: `src/model/graph.test.ts` (extend)

**Interfaces:**
- Consumes: `Adjacency` (existing).
- Produces: `shortestPath(adjacency: Adjacency, from: string, to: string): string[] | null` — undirected BFS over `out` ∪ `in`. Returns the node sequence inclusive of both endpoints (`[from]` if `from === to` and it exists), or `null` if either endpoint is absent from the graph or no path exists.

- [ ] **Step 1: Write the failing test** (append to `src/model/graph.test.ts`)

```ts
import { shortestPath } from '@/model/graph';
// (reuse the existing `adj` built in this file: f->d1, f->d2, d1->d3)

describe('shortestPath', () => {
  it('finds a directed-forward path undirectionally', () => {
    expect(shortestPath(adj, 'f', 'd3')).toEqual(['f', 'd1', 'd3']);
  });
  it('finds a path against edge direction (undirected)', () => {
    expect(shortestPath(adj, 'd3', 'f')).toEqual(['d3', 'd1', 'f']);
  });
  it('returns [from] when from === to', () => {
    expect(shortestPath(adj, 'f', 'f')).toEqual(['f']);
  });
  it('returns null when unreachable or unknown', () => {
    expect(shortestPath(adj, 'd2', 'ghost')).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL** (`bunx vitest run src/model/graph.test.ts` — `shortestPath` not exported)

- [ ] **Step 3: Implement** (append to `src/model/graph.ts`)

```ts
export function shortestPath(adjacency: Adjacency, from: string, to: string): string[] | null {
  const exists = (n: string) => adjacency.out.has(n) || adjacency.in.has(n);
  if (!exists(from) || !exists(to)) return null;
  if (from === to) return [from];

  const prev = new Map<string, string>();
  const visited = new Set<string>([from]);
  let frontier = [from];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const node of frontier) {
      const neighborsOf = [
        ...(adjacency.out.get(node) ?? []),
        ...(adjacency.in.get(node) ?? []),
      ];
      for (const adj of neighborsOf) {
        if (visited.has(adj)) continue;
        visited.add(adj);
        prev.set(adj, node);
        if (adj === to) {
          const path = [to];
          let cur = to;
          while (cur !== from) {
            cur = prev.get(cur)!;
            path.unshift(cur);
          }
          return path;
        }
        next.push(adj);
      }
    }
    frontier = next;
  }
  return null;
}
```

- [ ] **Step 4: Run → PASS** (`bunx vitest run src/model/graph.test.ts`)

- [ ] **Step 5: Commit**

```bash
git add src/model/graph.ts src/model/graph.test.ts
git commit -m "feat: undirected shortest-path BFS over the FK graph"
```

---

### Task 2: `path:A>B` operator in the resolver

**Files:**
- Modify: `src/selection/resolveSelection.ts`
- Test: `src/selection/resolveSelection.test.ts` (extend)
- Modify: `SPEC.md` (add `path:` to the DSL table)

**Interfaces:**
- Consumes: `shortestPath` (Task 1), `matchPiece`, existing `resolveAtom` structure.
- Produces: `resolveAtom` handles a piece of the form `path:<a>><b>`: resolve `<a>`/`<b>` via `matchPiece` (first match of each), compute `shortestPath`, return the path's node set (empty `Set` if unknown endpoint or no path). `parseSelector` already tokenizes `path:a>b` as a single `op:'none'` atom (no whitespace, no `+`/`~`/`,`), so no parser change is required — verify this in a test.

- [ ] **Step 1: Write the failing test** (append to `resolveSelection.test.ts`)

```ts
describe('path: operator', () => {
  it('resolves the shortest FK path between two tables (undirected)', () => {
    // f_order -> d_product <- f_stock -> d_warehouse
    const { nodes } = resolveSelection(model, 'path:f_order>d_warehouse');
    expect([...nodes].sort()).toEqual([
      'model.shop.d_product',
      'model.shop.d_warehouse',
      'model.shop.f_order',
      'model.shop.f_stock',
    ]);
  });
  it('resolves empty for an unknown endpoint', () => {
    expect(resolveSelection(model, 'path:f_order>does_not_exist').nodes.size).toBe(0);
  });
  it('parseSelector keeps path:a>b as a single none-atom', () => {
    // guards that '>' does not get mis-tokenized
    const { nodes } = resolveSelection(model, 'path:d_warehouse>f_order');
    expect(nodes.has('model.shop.d_warehouse')).toBe(true);
    expect(nodes.has('model.shop.f_order')).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement** — in `resolveSelection.ts`, add a `path:` branch at the top of `resolveAtom`:

```ts
import { buildAdjacency, neighbors, shortestPath, type Adjacency, type Direction } from '@/model/graph';
// ...
function resolveAtom(model: Model, adjacency: Adjacency, atom: Atom): Set<string> {
  if (atom.op === 'none' && atom.piece.startsWith('path:')) {
    const [aRaw, bRaw] = atom.piece.slice('path:'.length).split('>');
    if (!aRaw || !bRaw) return new Set();
    const from = [...matchPiece(model, aRaw)][0];
    const to = [...matchPiece(model, bRaw)][0];
    if (!from || !to) return new Set();
    const path = shortestPath(adjacency, from, to);
    return new Set(path ?? []);
  }
  const base = matchPiece(model, atom.piece);
  // ...unchanged...
}
```

- [ ] **Step 4: Run → PASS**, then `bun run test`

- [ ] **Step 5: Add `path:` to the `SPEC.md` Selection DSL table**

Add a row: `| `path:a>b` | shortest FK path (either direction) between tables a and b |`

- [ ] **Step 6: Commit**

```bash
git add src/selection/resolveSelection.ts src/selection/resolveSelection.test.ts SPEC.md
git commit -m "feat: path:A>B shortest-path selector operator"
```

---

### Task 3: Selection bar — chips as builder, DSL in a popover

**Files:**
- Modify: `src/app/SelectionBar.tsx`
- Test (visual): Playwright screenshot

**Interfaces:**
- Consumes: `useAppStore` (selector/setSelector/saveMart), `parseSelector`.
- Produces: a bar that shows ONLY chips (no duplicated raw-text echo). Each chip is one token from the source selector string (split on whitespace, preserving `!`-excludes), rendered with kind color (group=cyan, fact=amber via `classifyTable`, op/path=accent) and a `×` that removes that token and rewrites the selector. An "edit" affordance (a small `{ }` button or clicking empty bar space) toggles a raw-DSL `<input>` (the power-user editor) bound to the selector; toggling off returns to chips. Keep "Save data mart".

- [ ] **Step 1: Rewrite `SelectionBar.tsx`** so the default view renders chips from the selector's whitespace tokens (NOT both chips and the echoed string). Implement token removal by splitting the selector on whitespace, dropping the clicked token, re-joining. Add an `editing` local state that swaps the chip row for a text `<input value={selector}>` and back. Chip color: if token starts with `group:`/`g:` → group; `path:` → accent; else `classifyTable('x.'+token.replace(/^[!~+0-9]+|\+\d*$/g,''))` fact→amber else neutral. (Keep it simple; a helper `chipKind(token)` is fine.)

```tsx
// Sketch of the core — full implementation matches the mockup .topbar/.chip styling.
const tokens = selector.trim() ? selector.trim().split(/\s+/) : [];
const removeToken = (i: number) => setSelector(tokens.filter((_, j) => j !== i).join(' '));
```

- [ ] **Step 2: Screenshot-verify** — run dev; navigate to `/?s=group%3Ashop.sales%20f_order%2B`; confirm the bar shows two distinct chips (a cyan `group:shop.sales`, an amber `f_order+`) and NO duplicated trailing text; click a chip `×` and confirm it's removed + canvas updates; toggle the edit affordance and confirm the raw input appears. Screenshot. Stop server.

- [ ] **Step 3: `bun run test && bun run build`, then commit**

```bash
git add src/app/SelectionBar.tsx
git commit -m "fix: selection bar shows chips only (no duplicated DSL echo), with edit popover"
```

---

### Task 4: Click-to-focus + hop stepper

**Files:**
- Modify: `src/app/AppShell.tsx`, `src/app/LeftRail.tsx`, `src/app/Inspector.tsx`, `src/canvas/Canvas.tsx`
- Create: `src/app/HopStepper.tsx`
- Create: `src/app/focus.ts` (pure helpers) + Test: `src/app/focus.test.ts`

**Interfaces:**
- Produces (pure, `focus.ts`):
  - `focusSelector(tableLastSegment: string, hops = 1): string` → `` `~${hops} ${seg}` `` (note: per the DSL, attached form is `~Nseg`; emit `~${hops}${seg}` with no space). **Correction:** operators attach with no whitespace, so return `` `~${hops}${seg}` ``.
  - `parseFocus(selector: string): { table: string; hops: number } | null` — returns the focused table+hops iff the selector is exactly one `~N<table>` atom (no spaces, no other tokens), else null.
- Produces (UI): clicking a table (canvas node, rail row, inspector title) calls `setSelector(focusSelector(seg))` (focus replaces selection). `HopStepper` renders only when `parseFocus(selector)` is non-null; −/+ buttons call `setSelector(focusSelector(table, max(1, hops±1)))`. Mount the stepper in the canvas HUD or top bar.

  > Note: this CHANGES the rail/inspector click behavior from "append to union" to "focus". That is the intended UX per the user. Keep a modifier (e.g. shift-click) for union-append if trivial; otherwise focus-only is acceptable.

- [ ] **Step 1: TDD `focus.ts`**

```ts
// src/app/focus.test.ts
import { focusSelector, parseFocus } from '@/app/focus';
describe('focus helpers', () => {
  it('builds an attached undirected focus selector', () => {
    expect(focusSelector('f_order')).toBe('~1f_order');
    expect(focusSelector('f_order', 3)).toBe('~3f_order');
  });
  it('parses a lone focus selector', () => {
    expect(parseFocus('~2d_customer')).toEqual({ table: 'd_customer', hops: 2 });
    expect(parseFocus('~d_customer')).toEqual({ table: 'd_customer', hops: 1 });
  });
  it('returns null when not a lone focus atom', () => {
    expect(parseFocus('~1a b')).toBeNull();
    expect(parseFocus('group:sales')).toBeNull();
    expect(parseFocus('')).toBeNull();
  });
});
```

```ts
// src/app/focus.ts
export function focusSelector(seg: string, hops = 1): string {
  return `~${hops}${seg}`;
}
const FOCUS_RE = /^~(\d*)([^\s~+,!]+)$/;
export function parseFocus(selector: string): { table: string; hops: number } | null {
  const s = selector.trim();
  if (/\s/.test(s)) return null;
  const m = FOCUS_RE.exec(s);
  if (!m) return null;
  return { table: m[2], hops: m[1] ? parseInt(m[1], 10) : 1 };
}
```

- [ ] **Step 2: Run focus tests → PASS**

- [ ] **Step 3: Write `HopStepper.tsx`** (reads `parseFocus(selector)`, renders `− N hops +`, rewrites via `focusSelector`). Mount in the canvas HUD area (via AppShell or Canvas). Wire clicks: in `Canvas.tsx` table-node click → `onTableFocus?.(seg)`; in `LeftRail.tsx` row click → focus; in `Inspector.tsx` title → focus. AppShell passes `setSelector(focusSelector(seg))` as the focus handler. (Inspector ref-row clicks keep their existing append-to-union behavior.)

- [ ] **Step 4: Screenshot-verify** — run dev; click a table in the rail → canvas shows it + 1-hop neighbors (both directions); the hop stepper appears showing "1"; click + → shows 2-hop neighborhood (more nodes). Screenshot both. Stop server.

- [ ] **Step 5: `bun run test && bun run build`, commit**

```bash
git add src/app/focus.ts src/app/focus.test.ts src/app/HopStepper.tsx src/app/AppShell.tsx src/app/LeftRail.tsx src/app/Inspector.tsx src/canvas/Canvas.tsx
git commit -m "feat: click-to-focus a table with an in/out hop-distance stepper"
```

---

### Task 5: Path mode (pick A → B)

**Files:**
- Modify: `src/app/store.ts` (transient path-pick state), `src/app/AppShell.tsx`, `src/app/SelectionBar.tsx` (or a small toolbar button), `src/canvas/Canvas.tsx`
- Test: `src/app/store.test.ts` (extend for the new actions)

**Interfaces:**
- Produces (store): `pathMode: boolean`, `pathStart: string | null`, `setPathMode(on: boolean)`, `pickPathTable(name: string)`. `pickPathTable`: if `!pathStart` set it; else set selector to `` `path:${pathStartSeg}>${seg}` ``, then reset `pathStart=null` and `pathMode=false`. (Seg = last dot-segment.)
- Produces (UI): a "Find path" toggle button in the top bar. When `pathMode` is on, the canvas shows a hint ("pick start table" → "pick target") and table-node clicks call `pickPathTable` instead of focusing. On completion the canvas renders the `path:` selection.

- [ ] **Step 1: TDD the store actions** (append to `store.test.ts`)

```ts
it('path mode: first pick sets start, second pick builds path selector', () => {
  const s = useAppStore.getState();
  s.setPathMode(true);
  s.pickPathTable('model.shop.f_order');
  expect(useAppStore.getState().pathStart).toBe('model.shop.f_order');
  expect(useAppStore.getState().selector).toBe('');
  s.pickPathTable('model.shop.d_warehouse');
  expect(useAppStore.getState().selector).toBe('path:f_order>d_warehouse');
  expect(useAppStore.getState().pathMode).toBe(false);
  expect(useAppStore.getState().pathStart).toBeNull();
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement** the store fields/actions (seg via `name.split('.').pop()`), reset in `beforeEach` of the test, and the `loadDbml` reset should also clear `pathMode`/`pathStart`.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Wire UI** — "Find path" toggle in the top bar (SelectionBar or AppShell); in `Canvas.tsx`, when `pathMode`, node click → `pickPathTable(node.data.name)` (else focus). Show a small HUD hint of the current path-pick state.

- [ ] **Step 6: Screenshot-verify** — run dev; click "Find path"; click `f_order` then `d_warehouse`; confirm the canvas renders the path (f_order → d_product → f_stock → d_warehouse) and the selector/URL is `path:f_order>d_warehouse`. Screenshot. Stop server.

- [ ] **Step 7: `bun run test && bun run build`, commit**

```bash
git add src/app/store.ts src/app/store.test.ts src/app/AppShell.tsx src/app/SelectionBar.tsx src/canvas/Canvas.tsx
git commit -m "feat: path mode — pick two tables to render the shortest ref path"
```

---

## Self-Review

**Coverage of the user's four items:**
1. Selection-bar duplication → Task 3 (chips only + edit popover). ✓
2. Select a table → all refs in/out (distance 1) → Task 4 (click-to-focus `~1`). ✓
3. Increase visual distance (N away) → Task 4 (hop stepper). ✓
4. Path between two tables → Tasks 1+2 (engine + `path:`), Task 5 (UI). ✓

**Single-source-of-truth:** focus = `~N table`, path = `path:A>B` — both are selector strings; path-pick start is the only transient UI state and resets on completion/load. ✓

**Placeholder scan:** logic tasks (1,2,4-helpers,5-store) have complete TDD code; visual steps have explicit Playwright gates. The `focus.ts` Step note corrects the attached-operator form (`~Nseg`, no space) — that is the intended final code, not a placeholder.

**Type consistency:** `shortestPath` (Task 1) consumed by Task 2's resolver. `focusSelector`/`parseFocus` (Task 4) consumed by HopStepper + click handlers. Store path fields (Task 5) consumed by Canvas/AppShell. All reuse `matchPiece`/`parseSelector`/`classifyTable` unchanged.
