# Mixed-Detail Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `.` collapse modifier to the selector grammar so tables can render as compact cards and groups as super-nodes on one mixed canvas, plus five small companion features (cardinality glyphs, selector history, Cmd-K jump, DBML/PNG export, minimap).

**Architecture:** The selector remains the single source of truth (URL-shareable). `parseSelector` gains a `collapsed` flag per atom; `resolveSelection` returns detail levels (`full` / `collapsed` / `superGroups`) with the precedence rule "exact-name atom beats glob/group/traversal match; expanded beats collapsed at equal specificity"; `selectionToFlow` becomes the single flow builder (absorbing `buildOverview`), anchoring and merging edges per endpoint detail. UI interactions (chevron, group click) work by rewriting the selector string.

**Tech Stack:** TypeScript, React, zustand, @xyflow/react (React Flow), elkjs, CodeMirror 6, vitest, Bun.

**Spec:** `docs/superpowers/specs/2026-07-20-mixed-detail-canvas-design.md`

## Global Constraints

- Run tests with `bunx vitest run <path>` from the repo root; full suite with `bunx vitest run`.
- Commit straight to `main` (project convention), one commit per task minimum.
- Match existing style: CSS variables (`var(--ink)`, `var(--panel)` etc.), `"Spline Sans Mono", monospace` for canvas/HUD text, inline styles + tailwind utility classes as the surrounding file does.
- No em-dashes in any user-facing copy. No emoji as decoration.
- The only new dependency allowed is `html-to-image` (Task 10).
- Empty selector MUST keep meaning "overview" in the URL; the `.g:*` default is applied inside `resolveSelection`, never written into the store/URL.
- Spec deviation (approved rationale): selection-bar chips no longer exist in the codebase, so the "collapse an expanded group back" affordance lives in the canvas HUD (Task 5), not the selection bar.

---

### Task 1: Parser — `.` collapse prefix on atoms

**Files:**
- Modify: `src/selection/parseSelector.ts`
- Test: `src/selection/parseSelector.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Atom` gains `collapsed: boolean`. `parseAtom('.foo')` → `{ op: 'none', hops: 0, piece: 'foo', collapsed: true }`. The `.` prefix is stripped BEFORE the `~`/`+` prefixes, so `.~2foo` parses as collapsed undirected 2-hop.

- [ ] **Step 1: Write the failing tests** (append to the existing describe block in `parseSelector.test.ts`, matching its style):

```ts
describe('collapse modifier', () => {
  it('parses a dotted table atom', () => {
    expect(parseAtom('.d_customer')).toEqual({ op: 'none', hops: 0, piece: 'd_customer', collapsed: true });
  });

  it('parses a dotted group atom', () => {
    expect(parseAtom('.g:*')).toEqual({ op: 'none', hops: 0, piece: 'g:*', collapsed: true });
    expect(parseAtom('.group:sales')).toEqual({ op: 'none', hops: 0, piece: 'group:sales', collapsed: true });
  });

  it('composes with traversal prefixes', () => {
    expect(parseAtom('.~2fact_orders')).toEqual({ op: 'both', hops: 2, piece: 'fact_orders', collapsed: true });
    expect(parseAtom('.fact_orders+')).toEqual({ op: 'out', hops: 1, piece: 'fact_orders', collapsed: true });
  });

  it('plain atoms are not collapsed', () => {
    expect(parseAtom('d_customer').collapsed).toBe(false);
  });

  it('parses dotted atoms inside a selector with intersections', () => {
    const ast = parseSelector('.g:* group:sales a,.b');
    expect(ast.include[0][0]).toMatchObject({ piece: 'g:*', collapsed: true });
    expect(ast.include[1][0]).toMatchObject({ piece: 'group:sales', collapsed: false });
    expect(ast.include[2][1]).toMatchObject({ piece: 'b', collapsed: true });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run src/selection/parseSelector.test.ts`
Expected: FAIL (existing `toEqual` assertions on old atoms may also fail once `collapsed` is added; that is the next step's job).

- [ ] **Step 3: Implement**

```ts
export interface Atom {
  op: Op;
  hops: number;
  piece: string;
  collapsed: boolean;
}

export function parseAtom(raw: string): Atom {
  let collapsed = false;
  if (raw.startsWith('.')) {
    collapsed = true;
    raw = raw.slice(1);
  }

  let m: RegExpExecArray | null;
  if ((m = /^~(\d*)(.+)$/.exec(raw))) {
    return { op: 'both', hops: m[1] ? parseInt(m[1], 10) : 1, piece: m[2], collapsed };
  }
  if ((m = /^(\d*)\+(.+)$/.exec(raw))) {
    return { op: 'in', hops: m[1] ? parseInt(m[1], 10) : 1, piece: m[2], collapsed };
  }
  if ((m = /^(.+?)\+(\d*)$/.exec(raw))) {
    return { op: 'out', hops: m[2] ? parseInt(m[2], 10) : 1, piece: m[1], collapsed };
  }
  return { op: 'none', hops: 0, piece: raw, collapsed };
}
```

`parseSelector` itself is unchanged. Update any pre-existing test that asserts full atom equality to include `collapsed: false`.

- [ ] **Step 4: Run to verify pass**

Run: `bunx vitest run src/selection/parseSelector.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/selection/parseSelector.ts src/selection/parseSelector.test.ts
git commit -m "feat: parse '.' collapse modifier on selector atoms"
```

---

### Task 2: Group-name matching helper

**Files:**
- Modify: `src/selection/matchPiece.ts`
- Test: `src/selection/matchPiece.test.ts`

**Interfaces:**
- Produces: `matchGroups(model: Model, piece: string): Set<string>` — returns GROUP NAMES (not tables) matched by a `group:NAME` (exact or last-segment) or `g:GLOB` piece; empty set for any other piece shape. Task 3 uses this to resolve standalone dotted group atoms into super-nodes.

- [ ] **Step 1: Write the failing test** (append; reuse whatever model fixture the file already builds, or build a minimal one in the new describe):

```ts
describe('matchGroups', () => {
  const model = makeModel(); // reuse the file's existing fixture helper; must contain groups 'sales' and 'ops'

  it('matches an exact group name', () => {
    expect(matchGroups(model, 'group:sales')).toEqual(new Set(['sales']));
  });

  it('matches group globs', () => {
    expect(matchGroups(model, 'g:*')).toEqual(new Set(['sales', 'ops']));
  });

  it('returns empty for table pieces', () => {
    expect(matchGroups(model, 'd_customer')).toEqual(new Set());
  });
});
```

(Adapt fixture names to what `matchPiece.test.ts` actually uses; if its fixture has different group names, use those.)

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run src/selection/matchPiece.test.ts`
Expected: FAIL with "matchGroups is not a function" (add the import first).

- [ ] **Step 3: Implement** (append to `matchPiece.ts`, mirroring the existing group logic):

```ts
export function matchGroups(model: Model, piece: string): Set<string> {
  const result = new Set<string>();
  if (piece.startsWith('group:')) {
    const name = piece.slice('group:'.length);
    for (const group of model.groups.values()) {
      if (group.name === name || group.name.endsWith('.' + name)) result.add(group.name);
    }
  } else if (piece.startsWith('g:')) {
    const re = globToRegExp(piece.slice('g:'.length));
    for (const group of model.groups.values()) {
      if (re.test(group.name)) result.add(group.name);
    }
  }
  return result;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bunx vitest run src/selection/matchPiece.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/selection/matchPiece.ts src/selection/matchPiece.test.ts
git commit -m "feat: matchGroups helper returning group names for group pieces"
```

---

### Task 3: resolveSelection — detail levels and precedence

**Files:**
- Modify: `src/selection/resolveSelection.ts`
- Test: `src/selection/resolveSelection.test.ts`

**Interfaces:**
- Consumes: `Atom.collapsed` (Task 1), `matchGroups` (Task 2).
- Produces: the `Selection` interface becomes:

```ts
export interface Selection {
  nodes: Set<string>;                 // every selected table (full + collapsed + super-group members)
  edges: Ref[];                       // refs with both endpoints in nodes
  full: Set<string>;                  // render with columns
  collapsed: Set<string>;             // render as compact cards
  superGroups: Map<string, string[]>; // group name -> member tables inside the super-node
}
```

Semantics (from the spec):
1. Empty/whitespace input resolves as `.g:*` (the overview).
2. A dotted group atom STANDING ALONE in its comma-group (`.group:X` / `.g:GLOB`) contributes super-nodes. Dotted group atoms inside an intersection are treated as ordinary collapsed table sets.
3. An intersection comma-group is `collapsed` iff EVERY atom in it is dotted; otherwise `full` (expanded wins at equal specificity).
4. Exact-name atoms (op `none`, no `*`, no `group:`/`g:`/`path:` prefix, standing alone in their comma-group) override glob/group/traversal detail for their tables. Among equal specificity, `full` wins over `collapsed`.
5. A table with any table-level detail escapes its super-node; the super-node keeps only remaining members and is dropped when none remain.
6. Exclusions remove tables from everything.

- [ ] **Step 1: Write the failing tests** (append; reuse the file's existing model fixture — it must have at least two groups with tables and a cross-group ref; extend the fixture if needed):

```ts
describe('detail levels', () => {
  it('empty selector resolves as .g:* (all super-groups, no table nodes rendered individually)', () => {
    const sel = resolveSelection(model, '');
    expect(sel.full.size).toBe(0);
    expect(sel.collapsed.size).toBe(0);
    expect([...sel.superGroups.keys()].sort()).toEqual([...model.groups.keys()].sort());
    // nodes still contains the member tables so edges resolve
    expect(sel.nodes.size).toBeGreaterThan(0);
  });

  it('a dotted table atom selects collapsed', () => {
    const sel = resolveSelection(model, '.d_customer');
    expect(sel.collapsed.has('d_customer')).toBe(true);
    expect(sel.full.size).toBe(0);
  });

  it('.g:* group:sales expands sales, keeps other groups as super-nodes', () => {
    const sel = resolveSelection(model, '.g:* group:sales');
    const sales = model.groups.get('sales')!;
    for (const t of sales.tables) expect(sel.full.has(t)).toBe(true);
    expect(sel.superGroups.has('sales')).toBe(false);
    expect(sel.superGroups.size).toBe(model.groups.size - 1);
  });

  it('exact dotted atom beats a group match: group:sales .fact_orders', () => {
    const sel = resolveSelection(model, 'group:sales .fact_orders');
    expect(sel.collapsed.has('fact_orders')).toBe(true);
    expect(sel.full.has('fact_orders')).toBe(false);
  });

  it('expanded wins at equal specificity: g:* .g:* renders tables full', () => {
    const sel = resolveSelection(model, 'g:* .g:*');
    // .g:* standalone is a super-group atom, but every table escapes via g:* full detail
    expect(sel.superGroups.size).toBe(0);
    expect(sel.full.size).toBeGreaterThan(0);
  });

  it('a table selected individually escapes its dotted group', () => {
    const sel = resolveSelection(model, '.g:* fact_orders');
    expect(sel.full.has('fact_orders')).toBe(true);
    const g = model.tables.get('fact_orders')!.group!;
    const remaining = sel.superGroups.get(g);
    expect(remaining).toBeDefined();
    expect(remaining!.includes('fact_orders')).toBe(false);
  });

  it('intersection is collapsed only when all atoms are dotted', () => {
    const collapsed = resolveSelection(model, '.fact_orders,.~1fact_orders');
    expect(collapsed.collapsed.has('fact_orders')).toBe(true);
    const mixed = resolveSelection(model, 'fact_orders,.~1fact_orders');
    expect(mixed.full.has('fact_orders')).toBe(true);
  });

  it('exclusion removes from super-group members', () => {
    const sel = resolveSelection(model, '.g:* !fact_orders');
    const g = model.tables.get('fact_orders')!.group!;
    expect(sel.superGroups.get(g)?.includes('fact_orders') ?? false).toBe(false);
    expect(sel.nodes.has('fact_orders')).toBe(false);
  });
});
```

(Adapt table/group names to the actual fixture. Every existing test must keep passing: `sel.nodes` and `sel.edges` keep their old meaning for plain selectors, and plain selectors put everything in `full`.)

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run src/selection/resolveSelection.test.ts`
Expected: FAIL (missing properties).

- [ ] **Step 3: Implement.** Replace the body of `resolveSelection` (keep `resolveAtom`, `intersect`, `opToDirection` as-is):

```ts
import { matchGroups, matchPiece } from '@/selection/matchPiece';

type Detail = 'full' | 'collapsed';

function isGroupPiece(piece: string): boolean {
  return piece.startsWith('group:') || piece.startsWith('g:');
}

function isExactAtom(atom: Atom): boolean {
  return (
    atom.op === 'none' &&
    !atom.piece.includes('*') &&
    !isGroupPiece(atom.piece) &&
    !atom.piece.startsWith('path:')
  );
}

/** Expanded wins at equal specificity: never downgrade 'full' to 'collapsed'. */
function upsertDetail(map: Map<string, Detail>, name: string, detail: Detail): void {
  if (map.get(name) !== 'full') map.set(name, detail);
}

export function resolveSelection(
  model: Model,
  input: string,
  adjacency: Adjacency = buildAdjacency(model),
): Selection {
  const effective = input.trim() === '' ? '.g:*' : input;
  const ast = parseSelector(effective);

  const generalDetail = new Map<string, Detail>();
  const exactDetail = new Map<string, Detail>();
  const superGroupNames = new Set<string>();

  for (const group of ast.include) {
    // Standalone dotted group atom -> super-node(s).
    if (group.length === 1 && group[0].collapsed && group[0].op === 'none' && isGroupPiece(group[0].piece)) {
      for (const name of matchGroups(model, group[0].piece)) superGroupNames.add(name);
      continue;
    }

    let groupSet: Set<string> | null = null;
    let allCollapsed = true;
    for (const atom of group) {
      if (!atom.collapsed) allCollapsed = false;
      const atomSet = resolveAtom(model, adjacency, atom);
      groupSet = groupSet === null ? atomSet : intersect(groupSet, atomSet);
    }
    if (!groupSet) continue;

    const detail: Detail = allCollapsed ? 'collapsed' : 'full';
    const target = group.length === 1 && isExactAtom(group[0]) ? exactDetail : generalDetail;
    for (const name of groupSet) upsertDetail(target, name, detail);
  }

  // Exact atoms override general matches.
  const tableDetail = new Map<string, Detail>(generalDetail);
  for (const [name, detail] of exactDetail) tableDetail.set(name, detail);

  // Exclusions remove tables everywhere.
  const excluded = new Set<string>();
  for (const atom of ast.exclude) {
    for (const name of resolveAtom(model, adjacency, atom)) excluded.add(name);
  }
  for (const name of excluded) tableDetail.delete(name);

  // Super-groups keep members without table-level detail; drop empty ones.
  const superGroups = new Map<string, string[]>();
  for (const groupName of superGroupNames) {
    const group = model.groups.get(groupName);
    if (!group) continue;
    const members = group.tables.filter((t) => !tableDetail.has(t) && !excluded.has(t));
    if (members.length > 0) superGroups.set(groupName, members);
  }

  const full = new Set<string>();
  const collapsed = new Set<string>();
  for (const [name, detail] of tableDetail) (detail === 'full' ? full : collapsed).add(name);

  const nodes = new Set<string>([...full, ...collapsed]);
  for (const members of superGroups.values()) for (const m of members) nodes.add(m);

  const edges = model.refs.filter((r) => nodes.has(r.fromTable) && nodes.has(r.toTable));
  return { nodes, edges, full, collapsed, superGroups };
}
```

Note: tables not in `model.tables` can appear via group membership lists; the old code tolerated that in `selectionToFlow` (skips missing) — keep that tolerance.

- [ ] **Step 4: Run to verify pass**

Run: `bunx vitest run src/selection/resolveSelection.test.ts`
Expected: PASS, old and new tests.

- [ ] **Step 5: Run the full suite** (other modules consume `Selection`; `selectionToFlow` still only reads `nodes`/`edges` so it must still pass):

Run: `bunx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/selection/resolveSelection.ts src/selection/resolveSelection.test.ts
git commit -m "feat: resolveSelection returns detail levels (full/collapsed/superGroups)"
```

---

### Task 4: selectionToFlow — mixed nodes, edge anchoring and merging; delete buildOverview

**Files:**
- Modify: `src/canvas/selectionToFlow.ts`
- Modify: `src/canvas/GroupNode.tsx` (import type from new location)
- Modify: `src/canvas/Canvas.tsx` (single flow path)
- Delete: `src/canvas/buildOverview.ts`, `src/canvas/buildOverview.test.ts`
- Test: `src/canvas/selectionToFlow.test.ts`

**Interfaces:**
- Consumes: `Selection` with `full`/`collapsed`/`superGroups` (Task 3).
- Produces:

```ts
export const COMPACT_H = 48;
export const GROUP_W = 200;
export const GROUP_H = 64;

export type CompactTableNodeData = Omit<TableNodeData, 'columns' | 'hiddenCount'>;

export interface GroupNodeData {          // moved here from buildOverview.ts, same shape
  name: string;
  label: string;
  tableCount: number;
  refCount: number;
}

export interface FlowNode {
  id: string;
  type: 'table' | 'tableCompact' | 'group';
  position: { x: number; y: number };
  data: TableNodeData | CompactTableNodeData | GroupNodeData;
  width: number;
  height: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;     // set only when the source table renders full
  targetHandle?: string;     // set only when the target table renders full
  data: { count: number; fromColumn?: string; toColumn?: string };
}
```

Rules:
- Full tables: existing node building unchanged (type `'table'`).
- Collapsed tables: type `'tableCompact'`, width `NODE_WIDTH`, height `COMPACT_H`, data = TableNodeData fields minus `columns`/`hiddenCount`.
- Super-groups: type `'group'`, id = group name, `GROUP_W`x`GROUP_H`, `tableCount` = remaining member count, `refCount` = refs with BOTH endpoints among remaining members.
- Edge anchoring per endpoint: full table → its own node id + column handle; collapsed table → its own node id, handle undefined; super-group member → the group node id, handle undefined.
- Drop edges whose two anchored endpoints are the same node (intra-super-group refs).
- Merge edges landing on the same `(sourceNode, sourceHandle, targetNode, targetHandle)` key into one edge with `data.count`. For group-to-group edges, normalize the key and source/target by sorting the two group names, id `` `${a}--${b}` `` (exact parity with old overview ids/undirected merging). Merged edge ids otherwise `` `agg:${key}` ``; unmerged edges keep `ref.id` and carry `fromColumn`/`toColumn` with `count: 1`.

- [ ] **Step 1: Write the failing tests** (append to `selectionToFlow.test.ts`, reusing its fixture helpers; extend fixture with two groups and cross-group refs if it lacks them):

```ts
describe('mixed detail rendering', () => {
  it('collapsed tables render as tableCompact with COMPACT_H', () => {
    const sel = resolveSelection(model, '.d_customer');
    const { nodes } = selectionToFlow(model, sel);
    const n = nodes.find((x) => x.id === 'd_customer')!;
    expect(n.type).toBe('tableCompact');
    expect(n.height).toBe(COMPACT_H);
    expect((n.data as CompactTableNodeData).columnCount).toBeGreaterThan(0);
  });

  it('super-groups render as group nodes and intra-group refs are dropped', () => {
    const sel = resolveSelection(model, '');
    const { nodes, edges } = selectionToFlow(model, sel);
    expect(nodes.every((n) => n.type === 'group')).toBe(true);
    for (const e of edges) expect(e.source).not.toBe(e.target);
  });

  it('empty selector reproduces the old overview graph exactly', () => {
    const sel = resolveSelection(model, '');
    const { nodes, edges } = selectionToFlow(model, sel);
    // group node per group, undirected merged edges with a--b ids and counts
    expect(nodes.map((n) => n.id).sort()).toEqual([...model.groups.keys()].sort());
    for (const e of edges) {
      expect(e.id).toBe([e.source, e.target].sort().join('--'));
      expect(e.data.count).toBeGreaterThan(0);
    }
  });

  it('edges re-anchor onto super-group nodes and merge with counts', () => {
    // sales expanded, rest super-nodes; a sales table with 2 refs into the same
    // collapsed group must yield ONE table->group edge with count 2 when both
    // refs leave from the same source handle state (collapsed source) — use a
    // collapsed sales table to force node-level anchoring.
    const sel = resolveSelection(model, '.g:* .fact_orders');
    const { edges } = selectionToFlow(model, sel);
    const out = edges.filter((e) => e.source === 'fact_orders' || e.target === 'fact_orders');
    expect(out.length).toBeGreaterThan(0);
    for (const e of out) {
      expect(e.sourceHandle).toBeUndefined();
      expect(e.targetHandle).toBeUndefined();
    }
  });

  it('full-to-full edges keep column handles and are not merged', () => {
    const sel = resolveSelection(model, 'g:*');
    const { edges } = selectionToFlow(model, sel);
    for (const e of edges) {
      expect(e.sourceHandle).toBeDefined();
      expect(e.data.count).toBe(1);
    }
  });
});
```

(Adapt names/counts to the real fixture. The exact-parity test is the spec's lock on overview behavior.)

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run src/canvas/selectionToFlow.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement in `selectionToFlow.ts`.** Keep the existing full-table building loop; add around it:

```ts
export function selectionToFlow(model: Model, selection: Selection): { nodes: FlowNode[]; edges: FlowEdge[] } {
  // ... existing fkByTable / referencedByTable maps unchanged ...

  const memberToGroup = new Map<string, string>();
  for (const [groupName, members] of selection.superGroups) {
    for (const m of members) memberToGroup.set(m, groupName);
  }

  const nodes: FlowNode[] = [];

  // Full + collapsed tables (skip super-group members).
  for (const name of selection.nodes) {
    if (memberToGroup.has(name)) continue;
    const table = model.tables.get(name);
    if (!table) continue;
    // ... existing data building for TableNodeData (unchanged) ...
    if (selection.collapsed.has(name)) {
      const { columns: _c, hiddenCount: _h, ...compact } = data;
      nodes.push({ id: name, type: 'tableCompact', position: { x: 0, y: 0 }, data: compact, width: NODE_WIDTH, height: COMPACT_H });
    } else {
      const size = estimateNodeSize(data);
      nodes.push({ id: name, type: 'table', position: { x: 0, y: 0 }, data, ...size });
    }
  }

  // Super-group nodes.
  for (const [groupName, members] of selection.superGroups) {
    const memberSet = new Set(members);
    const refCount = model.refs.filter((r) => memberSet.has(r.fromTable) && memberSet.has(r.toTable)).length;
    nodes.push({
      id: groupName, type: 'group', position: { x: 0, y: 0 }, width: GROUP_W, height: GROUP_H,
      data: { name: groupName, label: groupName.split('.').pop() ?? groupName, tableCount: members.length, refCount },
    });
  }

  // Edges: anchor per endpoint state, merge on identical anchoring.
  const anchor = (table: string): { node: string; column?: string } =>
    memberToGroup.has(table)
      ? { node: memberToGroup.get(table)! }
      : { node: table };

  const merged = new Map<string, FlowEdge>();
  for (const ref of selection.edges) {
    const src = anchor(ref.fromTable);
    const tgt = anchor(ref.toTable);
    if (src.node === tgt.node) continue; // intra-super-group

    const srcFull = selection.full.has(ref.fromTable) && src.node === ref.fromTable;
    const tgtFull = selection.full.has(ref.toTable) && tgt.node === ref.toTable;
    const sourceHandle = srcFull ? ref.fromColumns[0] : undefined;
    const targetHandle = tgtFull ? ref.toColumns[0] : undefined;

    const bothGroups = memberToGroup.has(ref.fromTable) && memberToGroup.has(ref.toTable);
    let source = src.node, target = tgt.node;
    if (bothGroups) [source, target] = [source, target].sort();

    const key = `${source}|${sourceHandle ?? ''}|${target}|${targetHandle ?? ''}`;
    const existing = merged.get(key);
    if (existing) {
      existing.data.count += 1;
      existing.id = bothGroups ? existing.id : `agg:${key}`;
      delete existing.data.fromColumn;
      delete existing.data.toColumn;
    } else {
      merged.set(key, {
        id: bothGroups ? `${source}--${target}` : ref.id,
        source, target, sourceHandle, targetHandle,
        data: { count: 1, fromColumn: ref.fromColumns[0], toColumn: ref.toColumns[0] },
      });
    }
  }

  return { nodes, edges: [...merged.values()] };
}
```

Move `GroupNodeData` into this file; update `GroupNode.tsx` to `import type { GroupNodeData } from '@/canvas/selectionToFlow'`. Delete `buildOverview.ts` and `buildOverview.test.ts`. In `Canvas.tsx`, replace the ternary with the single path:

```ts
const raw = selectionToFlow(model, resolveSelection(model, selector, adjacency));
```

and remove the `buildOverview` import. The `layoutGraph` call and edge mapping already handle optional handles (`'sourceHandle' in e` becomes always true; simplify to `sourceHandle: e.sourceHandle, targetHandle: e.targetHandle`).

- [ ] **Step 4: Run to verify pass, then full suite**

Run: `bunx vitest run src/canvas/selectionToFlow.test.ts` then `bunx vitest run`
Expected: PASS (the smoke test now covers the unified path; any test importing `buildOverview` must be updated or deleted with it).

- [ ] **Step 5: Commit**

```bash
git add -A src/canvas src/selection
git commit -m "feat: unified mixed-detail flow builder; retire buildOverview"
```

---

### Task 5: Components and interactions — compact card, chevron, group expand/collapse

**Files:**
- Create: `src/canvas/TableNodeCompact.tsx`
- Create: `src/app/selectorEdit.ts`
- Test: `src/app/selectorEdit.test.ts`
- Modify: `src/canvas/TableNode.tsx` (chevron), `src/canvas/GroupNode.tsx` (focus button), `src/canvas/Canvas.tsx` (register node type, group click = expand, HUD collapse chips)

**Interfaces:**
- Consumes: `CompactTableNodeData`, `COMPACT_H` (Task 4); zustand store `useAppStore` (`selector`, `setSelector`).
- Produces (`selectorEdit.ts`):

```ts
export function toggleTableCollapsed(selector: string, tableName: string, collapse: boolean): string;
export function expandGroup(selector: string, groupName: string): string;
export function collapseGroup(selector: string, groupName: string): string;
export function expandedGroupTokens(selector: string): { token: string; name: string }[];
```

Behavior:
- `toggleTableCollapsed`: work on the last segment `seg = tableName.split('.').pop()`. Split the selector on whitespace, drop any token equal to `seg`, `.` + `seg`, `tableName`, or `.` + `tableName`, then append `collapse ? '.' + seg : seg`. If the incoming selector is empty/whitespace, use `'.g:*'` as the base first (the table was showing inside the overview-expanded state).
- `expandGroup`: base = `selector.trim() || '.g:*'`; if base already contains token `` `group:${groupName}` `` return base unchanged; else return `` base + ` group:${groupName}` ``.
- `collapseGroup`: map tokens; a token exactly `` `group:${name}` `` or `` `g:${name}` `` becomes `'.' + token`. If no token matched, return the selector unchanged.
- `expandedGroupTokens`: tokens matching `/^(group:|g:)/` (NOT starting with `.`), returning the trailing name.

- [ ] **Step 1: Write the failing tests**

```ts
import { toggleTableCollapsed, expandGroup, collapseGroup, expandedGroupTokens } from '@/app/selectorEdit';

describe('selectorEdit', () => {
  it('collapses a table by appending an exact dotted atom', () => {
    expect(toggleTableCollapsed('group:sales', 'shop.fact_orders', true)).toBe('group:sales .fact_orders');
  });

  it('replaces a prior exact atom for the same table', () => {
    expect(toggleTableCollapsed('group:sales .fact_orders', 'shop.fact_orders', false)).toBe('group:sales fact_orders');
  });

  it('uses the overview base when the selector is empty', () => {
    expect(toggleTableCollapsed('', 'd_customer', true)).toBe('.g:* .d_customer');
  });

  it('expandGroup appends onto the overview base', () => {
    expect(expandGroup('', 'sales')).toBe('.g:* group:sales');
    expect(expandGroup('.g:* group:sales', 'sales')).toBe('.g:* group:sales');
  });

  it('collapseGroup rewrites the token to dotted', () => {
    expect(collapseGroup('.g:* group:sales', 'sales')).toBe('.g:* .group:sales');
  });

  it('expandedGroupTokens lists undotted group tokens', () => {
    expect(expandedGroupTokens('.g:* group:sales g:ops_*')).toEqual([
      { token: 'group:sales', name: 'sales' },
      { token: 'g:ops_*', name: 'ops_*' },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run src/app/selectorEdit.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `selectorEdit.ts`**

```ts
function tokens(selector: string): string[] {
  return selector.trim().split(/\s+/).filter(Boolean);
}

export function toggleTableCollapsed(selector: string, tableName: string, collapse: boolean): string {
  const seg = tableName.split('.').pop() ?? tableName;
  const base = selector.trim() === '' ? '.g:*' : selector.trim();
  const drop = new Set([seg, '.' + seg, tableName, '.' + tableName]);
  const kept = tokens(base).filter((t) => !drop.has(t));
  kept.push(collapse ? '.' + seg : seg);
  return kept.join(' ');
}

export function expandGroup(selector: string, groupName: string): string {
  const base = selector.trim() === '' ? '.g:*' : selector.trim();
  const token = `group:${groupName}`;
  if (tokens(base).includes(token)) return base;
  return `${base} ${token}`;
}

export function collapseGroup(selector: string, groupName: string): string {
  return tokens(selector)
    .map((t) => (t === `group:${groupName}` || t === `g:${groupName}` ? '.' + t : t))
    .join(' ');
}

export function expandedGroupTokens(selector: string): { token: string; name: string }[] {
  return tokens(selector)
    .filter((t) => /^(group:|g:)/.test(t))
    .map((t) => ({ token: t, name: t.replace(/^(group:|g:)/, '') }));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bunx vitest run src/app/selectorEdit.test.ts`
Expected: PASS.

- [ ] **Step 5: Build `TableNodeCompact.tsx`** (header styling copied from `TableNode`, counts inline, generic handles):

```tsx
// src/canvas/TableNodeCompact.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CompactTableNodeData } from '@/canvas/selectionToFlow';
import { useAppStore } from '@/app/store';
import { toggleTableCollapsed } from '@/app/selectorEdit';

export function TableNodeCompact({ data }: NodeProps & { data: CompactTableNodeData }) {
  const accent = data.kind === 'fact' ? 'var(--fact)' : data.kind === 'dim' ? 'var(--dim)' : 'var(--line-2)';
  const accentDim = data.kind === 'fact' ? 'var(--fact-dim)' : 'var(--dim-dim)';
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);

  return (
    <div
      style={{
        width: 248, height: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
        borderRadius: 13, border: '1px solid var(--line-2)', borderTop: `2px solid ${accent}`,
        fontFamily: '"Spline Sans Mono", monospace',
        background: 'linear-gradient(180deg, var(--panel-2), var(--panel))',
        boxShadow: '0 18px 40px -22px rgba(0,0,0,.9), 0 2px 0 rgba(255,255,255,.02) inset',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--dim)', width: 8, height: 8, border: '2px solid var(--panel-2)' }} />
      <span className="grid place-items-center flex-none rounded-[5px] text-[10px] font-bold" style={{ width: 19, height: 19, color: accent, background: accentDim }}>
        {data.kind === 'fact' ? 'F' : data.kind === 'dim' ? 'D' : '·'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">{data.label}</div>
        <div className="text-[10px] text-[var(--ink-3)] truncate">
          {data.schema}, {data.columnCount} cols{data.fkCount > 0 ? `, ${data.fkCount} fk` : ''}
        </div>
      </div>
      <button
        title="Expand columns"
        onClick={(e) => { e.stopPropagation(); setSelector(toggleTableCollapsed(selector, data.name, false)); }}
        style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 12, padding: 2 }}
      >
        ▸
      </button>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--fact)', width: 8, height: 8, border: '2px solid var(--panel-2)' }} />
    </div>
  );
}
```

- [ ] **Step 6: Add the chevron to `TableNode.tsx`.** In the header div (after the `data.kind` span), add:

```tsx
<button
  title="Collapse to compact card"
  onClick={(e) => { e.stopPropagation(); setSelector(toggleTableCollapsed(selector, data.name, true)); }}
  style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 12, padding: 2, flexShrink: 0 }}
>
  ▾
</button>
```

with the same two `useAppStore` selectors added at the top of the component. `e.stopPropagation()` is required so the canvas `onNodeClick` (focus behavior) does not also fire.

- [ ] **Step 7: GroupNode focus button + Canvas wiring.** In `GroupNode.tsx`, add a small button (right-aligned in the title row):

```tsx
<button
  title="Focus this group (replace selector)"
  onClick={(e) => { e.stopPropagation(); useAppStore.getState().setSelector(`group:${data.name}`); }}
  style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 11, padding: 2, float: 'right' }}
>
  ⤢
</button>
```

In `Canvas.tsx`:
1. `const nodeTypes = { table: TableNode, tableCompact: TableNodeCompact, group: GroupNode };`
2. Change the group branch of `onNodeClick` from drill-in to expand-in-place:

```ts
} else if (node.type === 'group') {
  onSelectorChange?.(expandGroup(selector, (node.data as { name: string }).name));
}
```

3. Add HUD chips after `<HopStepper />` for collapsing expanded groups back:

```tsx
{expandedGroupTokens(selector).map(({ token, name }) => (
  <button
    key={token}
    onClick={() => onSelectorChange?.(collapseGroup(selector, name))}
    title={`Collapse ${name} back to a super-node`}
    style={{
      fontFamily: '"Spline Sans Mono", monospace', fontSize: 11, color: 'var(--ink-2)',
      background: 'rgba(13,16,24,.7)', border: '1px solid var(--line)', padding: '5px 9px',
      borderRadius: 7, cursor: 'pointer', backdropFilter: 'blur(6px)',
    }}
  >
    ▾ {name}
  </button>
))}
```

Note: verify in `AppShell.tsx` that `onSelectorChange` is wired to the store's `setSelector` (it drives URL persistence); if Canvas is ever rendered without the prop, fall back to `useAppStore.getState().setSelector`.

- [ ] **Step 8: Verify** — full suite plus a manual run:

Run: `bunx vitest run`
Expected: PASS.

Run: `bun run dev`, open http://localhost:5173 and check: overview renders; clicking a group expands it in place among super-nodes; the HUD chip collapses it back; a table chevron collapses to a compact card and back; the focus button still drills in. Take a screenshot if a browser tool is available.

- [ ] **Step 9: Commit**

```bash
git add -A src/canvas src/app
git commit -m "feat: compact table cards, in-place group expand/collapse, selector-rewriting interactions"
```

---

### Task 6: Selector syntax, completions, and help for `.`

**Files:**
- Modify: `src/app/selectorSyntax.ts`, `src/app/selectorCompletions.ts`, `src/app/HelpModal.tsx`
- Test: `src/app/selectorSyntax.test.ts`, `src/app/selectorCompletions.test.ts`

**Interfaces:** no new exports; behavior changes only.

Known latent bug this task fixes: `tokenizeSelector` hangs on a leading `.` (the char falls through every branch and the invalid-run loop cannot consume it because `.` is in its exclusion class, so `i` never advances). Adding `.` as an operator token fixes both the hang and the new grammar.

- [ ] **Step 1: Write the failing tests**

`selectorSyntax.test.ts`:

```ts
it('tokenizes a leading dot as an operator (no hang)', () => {
  const toks = tokenizeSelector('.g:* .d_customer');
  expect(toks.map((t) => [t.kind, t.text])).toEqual([
    ['operator', '.'], ['keyword', 'g:'], ['glob', '*'], ['whitespace', ' '],
    ['operator', '.'], ['identifier', 'd_customer'],
  ]);
});

it('validates dotted atoms without diagnostics', () => {
  expect(validateSelector(model, '.group:sales .d_customer')).toEqual([]);
});
```

`selectorCompletions.test.ts`:

```ts
it('completes after a leading dot', () => {
  const r = selectorCompletions(model, '.d_cu');
  expect(r.from).toBe(1);
  expect(r.options.some((o) => o.label.startsWith('d_cu'))).toBe(true);
});

it('completes dotted group keywords', () => {
  const r = selectorCompletions(model, '.group:sa');
  expect(r.options.some((o) => o.type === 'group')).toBe(true);
});
```

(Adapt fixture names.)

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run src/app/selectorSyntax.test.ts src/app/selectorCompletions.test.ts`
Expected: FAIL — the tokenizer test may TIME OUT (that is the hang; treat a timeout as the expected failure).

- [ ] **Step 3: Implement.**

`selectorSyntax.ts`:
1. In `tokenizeSelector`, add a `.` branch BEFORE the identifier branch (a `.` reaching dispatch is always a leading/operator dot, since identifiers consume interior dots):

```ts
if (text[i] === '.') {
  tokens.push({ from: i, to: i + 1, kind: 'operator', text: '.' });
  i++;
  continue;
}
```

2. In `extractPiece`, strip a leading `.` first (before `!`):

```ts
if (s.startsWith('.')) {
  s = s.slice(1);
  offset += 1;
}
```

3. In `validatePart`, strip a leading `.` at the top so `.group:x` / `.g:*` validate like their undotted forms:

```ts
if (part.startsWith('.')) {
  part = part.slice(1);
  partStart += 1;
}
```

`selectorCompletions.ts`: at the start of the function body, after computing `token`/`tokenStart`, strip one leading dot:

```ts
let dotOffset = 0;
if (token.startsWith('.')) {
  dotOffset = 1;
}
const inner = token.slice(dotOffset);
const innerStart = tokenStart + dotOffset;
```

and use `inner`/`innerStart` everywhere `token`/`tokenStart` were used below (including the plain-token prefix regex, which stays `/^[!~+0-9]*/` since the dot is already stripped).

`HelpModal.tsx`: add one row to the grammar table (match the existing row markup exactly):

```
.x  /  .group:sales   collapse: compact table card / group super-node
```

and mention that the empty selector is shorthand for `.g:*`.

- [ ] **Step 4: Run to verify pass**

Run: `bunx vitest run src/app`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/selectorSyntax.ts src/app/selectorSyntax.test.ts src/app/selectorCompletions.ts src/app/selectorCompletions.test.ts src/app/HelpModal.tsx
git commit -m "feat: selector syntax/completions/help support for '.' collapse modifier (fixes leading-dot tokenizer hang)"
```

---

### Task 7: Cardinality glyphs on edges

**Files:**
- Modify: `src/model/types.ts`, `src/model/parseDbml.ts`, `src/canvas/selectionToFlow.ts`, `src/canvas/Canvas.tsx`
- Create: `src/canvas/RefEdge.tsx`
- Test: `src/model/parseDbml.test.ts`, `src/canvas/selectionToFlow.test.ts`

**Interfaces:**
- `Ref` gains `fromCardinality: '1' | '*'` and `toCardinality: '1' | '*'` (the raw endpoint relations after the existing many-side-first normalization; a one-to-one ref is `'1'`/`'1'`).
- `FlowEdge.data` gains `fromCardinality?: '1' | '*'` and `toCardinality?: '1' | '*'`, set only on unmerged (`count === 1`) edges.
- New React Flow edge type `ref` rendering: `count > 1` → a centered count chip; otherwise `N`/`1` labels near the source/target ends.

- [ ] **Step 1: Failing test in `parseDbml.test.ts`** (extend an existing DBML fixture string that has a `>` ref):

```ts
it('captures endpoint cardinalities', () => {
  const { refs } = parseDbml(FIXTURE_WITH_MANY_TO_ONE_REF);
  const ref = refs[0];
  expect(ref.fromCardinality).toBe('*');
  expect(ref.toCardinality).toBe('1');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run src/model/parseDbml.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `parseDbml.ts`, inside the ref loop:

```ts
refs.push({
  id: `${from.tableName}.${fromCols.join(',')}->${to.tableName}.${toCols.join(',')}`,
  fromTable: from.tableName,
  fromColumns: fromCols,
  toTable: to.tableName,
  toColumns: toCols,
  fromCardinality: from.relation === '*' ? '*' : '1',
  toCardinality: to.relation === '*' ? '*' : '1',
});
```

Add the two fields to `Ref` in `types.ts`. Fix any test fixtures that construct `Ref` literals (add the two fields; grep for `fromColumns:` to find them). In `selectionToFlow.ts`, when creating an unmerged edge include `fromCardinality: ref.fromCardinality, toCardinality: ref.toCardinality` in `data`, and delete them alongside `fromColumn`/`toColumn` when an edge becomes merged.

- [ ] **Step 4: Create `RefEdge.tsx`**

```tsx
// src/canvas/RefEdge.tsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

const labelStyle: React.CSSProperties = {
  position: 'absolute', fontFamily: '"Spline Sans Mono", monospace', fontSize: 9,
  color: 'var(--ink-3)', background: 'rgba(13,16,24,.75)', border: '1px solid var(--line)',
  borderRadius: 4, padding: '0 3px', pointerEvents: 'none',
};

export function RefEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, markerEnd } = props;
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const count = (data as { count?: number })?.count ?? 1;
  const fromCard = (data as { fromCardinality?: string })?.fromCardinality;
  const toCard = (data as { toCardinality?: string })?.toCardinality;

  return (
    <>
      <BaseEdge path={path} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        {count > 1 && (
          <div style={{ ...labelStyle, transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}>
            {count}
          </div>
        )}
        {count === 1 && fromCard && (
          <div style={{ ...labelStyle, transform: `translate(-50%,-50%) translate(${sourceX + (targetX > sourceX ? 14 : -14)}px,${sourceY - 10}px)` }}>
            {fromCard === '*' ? 'N' : '1'}
          </div>
        )}
        {count === 1 && toCard && (
          <div style={{ ...labelStyle, transform: `translate(-50%,-50%) translate(${targetX + (targetX > sourceX ? -14 : 14)}px,${targetY - 10}px)` }}>
            {toCard === '*' ? 'N' : '1'}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
```

In `Canvas.tsx`: `const edgeTypes = { ref: RefEdge };` (module scope, like `nodeTypes`), pass `edgeTypes={edgeTypes}` to `<ReactFlow>`, and in the edge mapping add `type: 'ref', data: e.data`.

- [ ] **Step 5: Verify**

Run: `bunx vitest run`
Expected: PASS.

Run: `bun run dev` and confirm 1/N labels on table edges and count chips on aggregated edges.

- [ ] **Step 6: Commit**

```bash
git add -A src/model src/canvas
git commit -m "feat: cardinality glyphs and aggregate counts on edges"
```

---

### Task 8: Selector history dropdown

**Files:**
- Create: `src/app/selectorHistory.ts`
- Test: `src/app/selectorHistory.test.ts`
- Modify: `src/app/SelectionBar.tsx`, `src/app/AppShell.tsx` (or wherever the selector effect lands most naturally; prefer `SelectionBar`)

**Interfaces:**

```ts
export const HISTORY_KEY = 'dbml-flow:selector-history';
export function loadHistory(storage?: Storage): string[];
export function pushHistory(selector: string, storage?: Storage): string[];  // returns new list
```

Rules: non-empty trimmed selectors only; most recent first; dedupe (move an existing entry to front); cap at 15; `storage` defaults to `window.localStorage` (parameterized for tests); tolerate corrupt JSON by resetting to `[]`.

- [ ] **Step 1: Failing tests**

```ts
import { loadHistory, pushHistory, HISTORY_KEY } from '@/app/selectorHistory';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  } as Storage;
}

describe('selectorHistory', () => {
  it('pushes, dedupes to front, caps at 15', () => {
    const s = memStorage();
    for (let i = 0; i < 20; i++) pushHistory(`sel_${i}`, s);
    pushHistory('sel_10', s);
    const list = loadHistory(s);
    expect(list[0]).toBe('sel_10');
    expect(list.length).toBe(15);
  });

  it('ignores empty selectors and survives corrupt storage', () => {
    const s = memStorage();
    pushHistory('   ', s);
    expect(loadHistory(s)).toEqual([]);
    s.setItem(HISTORY_KEY, '{not json');
    expect(loadHistory(s)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run src/app/selectorHistory.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export const HISTORY_KEY = 'dbml-flow:selector-history';
const CAP = 15;

export function loadHistory(storage: Storage = window.localStorage): string[] {
  try {
    const raw = storage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function pushHistory(selector: string, storage: Storage = window.localStorage): string[] {
  const trimmed = selector.trim();
  if (!trimmed) return loadHistory(storage);
  const list = [trimmed, ...loadHistory(storage).filter((s) => s !== trimmed)].slice(0, CAP);
  storage.setItem(HISTORY_KEY, JSON.stringify(list));
  return list;
}
```

- [ ] **Step 4: Wire into the UI.** In `SelectionBar.tsx` add a history button between the selector box and "Find path": a `useState`-toggled popover listing `loadHistory()` entries; clicking an entry calls `setSelector(entry)` and closes. Record history with a debounced effect (3 seconds after the selector stops changing, push it):

```tsx
const selector = useAppStore((s) => s.selector);
const setSelector = useAppStore((s) => s.setSelector);
const [historyOpen, setHistoryOpen] = useState(false);

useEffect(() => {
  if (!selector.trim()) return;
  const t = setTimeout(() => pushHistory(selector), 3000);
  return () => clearTimeout(t);
}, [selector]);
```

Popover styling: absolute-positioned panel under the button, `background: 'var(--bg-2)'`, `border: '1px solid var(--line)'`, `borderRadius: 8`, entries in Spline Sans Mono 12px with `truncate`; button label "Recent", same style as the "Find path" button (copy its style object, non-active variant).

- [ ] **Step 5: Verify**

Run: `bunx vitest run`
Expected: PASS. Then `bun run dev`: type a few selectors, wait 3s each, open Recent, click one.

- [ ] **Step 6: Commit**

```bash
git add src/app/selectorHistory.ts src/app/selectorHistory.test.ts src/app/SelectionBar.tsx
git commit -m "feat: recent-selector history dropdown (localStorage, cap 15)"
```

---

### Task 9: Cmd-K quick-jump

**Files:**
- Create: `src/app/QuickJump.tsx`
- Modify: `src/app/selectorCompletions.ts` (export `matchSegs`), `src/app/AppShell.tsx` (mount `<QuickJump />`)
- Test: `src/app/selectorCompletions.test.ts` (matchSegs export)

**Interfaces:**
- Consumes: `matchSegs(segs: string[], query: string): string[]` — currently module-private in `selectorCompletions.ts`; export it unchanged.
- Produces: `<QuickJump />`, self-contained modal. Cmd-K/Ctrl-K opens; typing filters table last-segments (prefix matches ranked first); ArrowUp/Down moves the active row; Enter sets the selector to the chosen segment (replace); Shift-Enter appends it as a union (`selector + ' ' + seg`); Escape closes.

- [ ] **Step 1: Failing test** — assert the export:

```ts
import { matchSegs } from '@/app/selectorCompletions';

it('matchSegs is exported and ranks prefix matches first', () => {
  expect(matchSegs(['ab', 'ba', 'b'], 'b')).toEqual(['b', 'ba', 'ab']);
});
```

- [ ] **Step 2: Run to verify failure**, then export the function (add `export` keyword only).

Run: `bunx vitest run src/app/selectorCompletions.test.ts`

- [ ] **Step 3: Implement `QuickJump.tsx`**

```tsx
// src/app/QuickJump.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/app/store';
import { matchSegs } from '@/app/selectorCompletions';

export function QuickJump() {
  const model = useAppStore((s) => s.model);
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const segs = useMemo(
    () => (model ? [...new Set([...model.tables.keys()].map((n) => n.split('.').pop()!))].sort() : []),
    [model],
  );
  const results = useMemo(() => matchSegs(segs, query).slice(0, 12), [segs, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        setQuery('');
        setActive(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  if (!open || !model) return null;

  const pick = (seg: string, union: boolean) => {
    setSelector(union && selector.trim() ? `${selector.trim()} ${seg}` : seg);
    setOpen(false);
  };

  return (
    <div
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', justifyContent: 'center', paddingTop: '18vh' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, height: 'fit-content', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 24px 60px rgba(0,0,0,.6)', overflow: 'hidden' }}
      >
        <input
          ref={inputRef}
          value={query}
          placeholder="Jump to table (Enter replaces, Shift-Enter adds)"
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            else if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            else if (e.key === 'Enter' && results[active]) pick(results[active], e.shiftKey);
          }}
          style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontFamily: '"Spline Sans Mono", monospace', fontSize: 13, borderBottom: '1px solid var(--line)' }}
        />
        <div>
          {results.map((seg, i) => (
            <div
              key={seg}
              onMouseEnter={() => setActive(i)}
              onClick={(e) => pick(seg, e.shiftKey)}
              style={{
                padding: '6px 14px', cursor: 'pointer', fontFamily: '"Spline Sans Mono", monospace', fontSize: 12,
                color: i === active ? 'var(--accent)' : 'var(--ink-2)',
                background: i === active ? 'rgba(139,156,255,.12)' : 'transparent',
              }}
            >
              {seg}
            </div>
          ))}
          {results.length === 0 && (
            <div style={{ padding: '10px 14px', fontFamily: '"Spline Sans Mono", monospace', fontSize: 12, color: 'var(--ink-3)' }}>No matches</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

Mount `<QuickJump />` once in `AppShell.tsx` (sibling of the canvas; it renders null when closed).

- [ ] **Step 4: Verify**

Run: `bunx vitest run`
Expected: PASS. Then `bun run dev`: Cmd-K, type, Enter and Shift-Enter both work, Escape closes.

- [ ] **Step 5: Commit**

```bash
git add src/app/QuickJump.tsx src/app/selectorCompletions.ts src/app/selectorCompletions.test.ts src/app/AppShell.tsx
git commit -m "feat: Cmd-K quick-jump to a table"
```

---

### Task 10: Copy DBML and PNG export

**Files:**
- Create: `src/app/exportDbml.ts`
- Test: `src/app/exportDbml.test.ts`
- Modify: `src/canvas/Canvas.tsx` (HUD buttons), `package.json` (add `html-to-image`)

**Interfaces:**

```ts
export function selectionToDbml(model: Model, selection: Selection): string;
```

Output shape (only tables in `selection.nodes` that exist in `model.tables`, and refs from `selection.edges`):

```
Table shop.fact_orders {
  order_id int [pk]
  customer_id int
}

Ref: shop.fact_orders.customer_id > shop.d_customer.customer_id
```

Rules: one `[pk]` attribute for primary keys, no notes, blank line between blocks, refs use `>` (many side first, which `Ref` already guarantees), multi-column refs render `(a, b)` tuples.

- [ ] **Step 1: Failing test**

```ts
import { selectionToDbml } from '@/app/exportDbml';
import { resolveSelection } from '@/selection/resolveSelection';

it('serializes selected tables and refs back to DBML', () => {
  const sel = resolveSelection(model, 'fact_orders ~1fact_orders');
  const out = selectionToDbml(model, sel);
  expect(out).toContain('Table fact_orders {');
  expect(out).toMatch(/\[pk\]/);
  expect(out).toMatch(/^Ref: .+ > .+$/m);
});

it('round-trips through the parser', () => {
  const sel = resolveSelection(model, 'g:*');
  const { tables } = parseDbml(selectionToDbml(model, sel));
  expect(tables.length).toBe(sel.nodes.size);
});
```

(The round-trip test is the real guard; adapt names to the fixture. If fixture types contain spaces (`varchar(10)` is fine; `timestamp with time zone` needs quoting), quote types containing spaces with double quotes.)

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run src/app/exportDbml.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import type { Model } from '@/model/types';
import type { Selection } from '@/selection/resolveSelection';

function colType(type: string): string {
  return /\s/.test(type) ? `"${type}"` : type;
}

function colList(table: string, cols: string[]): string {
  return cols.length === 1 ? `${table}.${cols[0]}` : `${table}.(${cols.join(', ')})`;
}

export function selectionToDbml(model: Model, selection: Selection): string {
  const blocks: string[] = [];
  for (const name of selection.nodes) {
    const table = model.tables.get(name);
    if (!table) continue;
    const lines = table.columns.map(
      (c) => `  ${c.name} ${colType(c.type)}${c.isPrimaryKey ? ' [pk]' : ''}`,
    );
    blocks.push(`Table ${name} {\n${lines.join('\n')}\n}`);
  }
  for (const ref of selection.edges) {
    blocks.push(`Ref: ${colList(ref.fromTable, ref.fromColumns)} > ${colList(ref.toTable, ref.toColumns)}`);
  }
  return blocks.join('\n\n') + '\n';
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bunx vitest run src/app/exportDbml.test.ts`
Expected: PASS (if the round-trip fails on table-name quoting for dotted names, wrap dotted names as `Table "a"."b"` — check what `parseDbml` accepts and adjust).

- [ ] **Step 5: PNG export + HUD buttons.**

```bash
bun add html-to-image
```

In `Canvas.tsx`, add a right-aligned HUD cluster (mirror the left HUD styling, `position: absolute; right: 16; top: 14; zIndex: 6`) with two buttons:

- "Copy DBML": `navigator.clipboard.writeText(selectionToDbml(model, resolveSelection(model, selector, adjacency)))`, then flip its label to "Copied" for 1.5s via `useState` + `setTimeout`.
- "PNG": standard React Flow capture —

```ts
import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, useReactFlow } from '@xyflow/react';

const { getNodes } = useReactFlow();
const exportPng = async () => {
  const bounds = getNodesBounds(getNodes());
  const width = Math.min(bounds.width + 80, 4096);
  const height = Math.min(bounds.height + 80, 4096);
  const viewport = getViewportForBounds(bounds, width, height, 0.2, 2, 0.1);
  const el = document.querySelector('.react-flow__viewport') as HTMLElement;
  const dataUrl = await toPng(el, {
    width, height,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` },
    backgroundColor: '#0d1018',
  });
  const a = document.createElement('a');
  a.download = 'dbml-flow.png';
  a.href = dataUrl;
  a.click();
};
```

`useReactFlow` must be called inside the `ReactFlowProvider`, which `Canvas` already is.

- [ ] **Step 6: Verify**

Run: `bunx vitest run`
Expected: PASS. Then `bun run dev`: Copy DBML pastes valid DBML; PNG downloads a readable image of the current view.

- [ ] **Step 7: Commit**

```bash
git add -A src/app src/canvas package.json bun.lock
git commit -m "feat: copy selection as DBML and export canvas as PNG"
```

---

### Task 11: Minimap

**Files:**
- Modify: `src/canvas/Canvas.tsx`

**Interfaces:** none new. Render React Flow's `<MiniMap>` inside `<ReactFlow>` when `nodes.length >= 10`.

- [ ] **Step 1: Implement**

```tsx
import { MiniMap } from '@xyflow/react';

{nodes.length >= 10 && (
  <MiniMap
    pannable
    zoomable
    style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8 }}
    maskColor="rgba(13,16,24,.75)"
    nodeColor={(n) => (n.type === 'group' ? 'var(--panel-2)' : 'var(--line-2)')}
    nodeStrokeColor="var(--line)"
  />
)}
```

- [ ] **Step 2: Verify** — `bunx vitest run` passes (existing smoke test covers render); `bun run dev` shows the minimap on large selections only.

- [ ] **Step 3: Commit**

```bash
git add src/canvas/Canvas.tsx
git commit -m "feat: theme-styled minimap on large graphs"
```

---

### Task 12: Docs and final verification

**Files:**
- Modify: `README.md` (features list: `.` modifier with 2-3 example selectors, Cmd-K, export, history, minimap; update the selector grammar table with a `.x` / `.group:x` row)

- [ ] **Step 1: Update README** — add the grammar row and short feature bullets, matching the existing table and bullet style. No em-dashes.

- [ ] **Step 2: Full verification**

```bash
bunx vitest run          # all tests pass
bun run build            # production build succeeds
```

Manual sweep in `bun run dev`: overview → expand group → collapse table → HUD chip collapse-back → URL reload reproduces the view → Cmd-K → Copy DBML → PNG → history dropdown.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document '.' collapse modifier and new canvas features"
```

---

### Task 13: Conventional-commit release automation (added post-planning at user request)

**Files:**
- Create: `.cz.toml`, `.pre-commit-config.yaml`, `.github/workflows/release.yml`, `.github/workflows/commit-lint.yml`
- Modify: `.github/workflows/docker.yml` (extract the build job into a reusable `workflow_call` form OR leave as-is; see below)

**Context:** `docker.yml` ALREADY builds `:latest` on main pushes and semver tags on `v*` tag pushes (docker/metadata-action). This task adds the automatic tag cutting from conventional commits, modeled on nfi-schuifmaat (auto-bump on main push) with the GitHub-Actions mechanics from mendel/studio (commitizen `version_provider = "scm"`, atomic push, GHCR). Critical constraint from studio: tags pushed with the default `GITHUB_TOKEN` do NOT trigger other workflows, so `docker.yml`'s `tags: ['v*']` trigger will not fire for tags the release workflow pushes — the release workflow must build the semver image itself in the same run.

**Interfaces:**
- `.cz.toml` (commitizen): `name = "cz_conventional_commits"`, `version_scheme = "semver"`, `version_provider = "scm"` (git tags are the source of truth; package.json stays at 0.0.0), `tag_format = "v$version"`, `annotated_tag = true`, `update_changelog_on_bump = true`, `changelog_incremental = true`, `major_version_zero = true`, `bump_message = "chore(release): $current_version -> $new_version [skip ci]"`.
- `.pre-commit-config.yaml`: official commitizen hook at the `commit-msg` stage (repo `https://github.com/commitizen-tools/commitizen`, rev `v4.16.4`, hook id `commitizen`, `stages: [commit-msg]`), plus `pre-commit-hooks` basics (check-yaml, end-of-file-fixer, trailing-whitespace, check-merge-conflict).
- `.github/workflows/commit-lint.yml`: on push to main + PRs; `pipx install commitizen`; `cz check --rev-range` over `last v* tag..HEAD` (push) or `base..head` (PR) — copy the range logic from studio's commit-lint.yml as reported.
- `.github/workflows/release.yml`: on `push: branches: [main]`, `permissions: contents: write, packages: write`, `concurrency: release` (no cancel). Steps: checkout `fetch-depth: 0`; git identity github-actions[bot]; `pipx install commitizen`; run `cz bump --yes --changelog`, treating exit codes 3/21 (no releasable commits) as a clean no-op (`released=false`); on success capture `TAG=$(git describe --tags --abbrev=0)`; `git push --atomic origin HEAD:main "refs/tags/${TAG}"` (explicit atomic push, never `--follow-tags`); then, gated on `released == true`, build and push the semver Docker image in the same run: checkout `ref: ${TAG}`, buildx, GHCR login with `GITHUB_TOKEN`, metadata-action with `type=semver` patterns pinned to the tag, build-push with gha cache — mirroring docker.yml's existing steps. `[skip ci]` in the bump message stops the bump commit from re-triggering workflows.
- `docker.yml` keeps its main-push `:latest` build unchanged. Its `tags: ['v*']` trigger stays for manually pushed tags; add a comment that automated tags are built by release.yml (token-pushed tags cannot trigger this workflow).

**Verification:** `bunx action-validator` is NOT in the repo; validate YAML by `bunx yaml-lint` or careful review, plus `pre-commit run --all-files` if pre-commit is installed locally (skip gracefully if not). Real verification happens on the next push to origin main: commit-lint and release workflows must go green, a `feat:`/`fix:` commit must cut a tag and publish both `:latest` (docker.yml) and `vX.Y.Z` (release.yml) images. The implementer cannot verify the remote side; report it as unverifiable and list what to watch on the Actions tab.

**Note:** local git history contains non-conventional commits from before this task; the commit-lint push range starts at the last `v*` tag, so create an initial tag `v0.1.0` on the release commit of this task (manually, pushed by the user or noted as a follow-up) OR let the first `cz bump` derive from the full history and accept a larger changelog. Prefer: note in the report that the first automated release will sweep all history into the changelog; that is acceptable.

- [ ] Step 1: Write `.cz.toml`, `.pre-commit-config.yaml`, `commit-lint.yml`, `release.yml`; adjust `docker.yml` comment.
- [ ] Step 2: Validate YAML locally; run `pre-commit run --all-files` if available.
- [ ] Step 3: Commit with a conventional message: `ci: conventional-commit release automation (auto tag bump, semver docker images)`.

---

### Task 14: Path-picking UX — start-table feedback (added post-planning at user request)

**Files:**
- Modify: `src/app/LeftRail.tsx`, `src/canvas/Canvas.tsx`
- Test: none mandated (pure render); full suite + visual check

**Context:** "Find path" mode (store: `pathMode`, `pathStart`, `pickPathTable`) currently gives no feedback about which start table was picked: the HUD pill only flips from "Pick start table" to "Pick target table". Requirements:
1. In `LeftRail.tsx`, when `pathMode` is on and `pathStart` matches a listed table (compare full name; the rail lists tables — read the file to see its row structure), render a small "start" badge on that row, styled like existing rail badges (CSS vars, Spline Sans Mono, accent color `var(--accent)`).
2. In `Canvas.tsx`, the existing path-mode HUD pill must include the picked start's last segment: when `pathStart` is set render `start: <seg>, pick target table`, else keep `Pick start table`. No em-dashes.

- [ ] Step 1: Read both files, implement the two changes following their existing patterns.
- [ ] Step 2: `bunx vitest run` + `bunx tsc --noEmit -p tsconfig.app.json` clean; visual check in the dev server (enter path mode, click a table, see rail badge + HUD text).
- [ ] Step 3: Commit `feat: show picked start table in rail and canvas HUD during path mode`.

### Task 15: Selector clear button (added post-planning at user request)

**Files:**
- Modify: `src/app/SelectionBar.tsx`
- Test: none mandated (pure render); full suite + visual check

**Context:** Add a small (x) button inside the selector area (the rounded box wrapping `<SelectorInput />`), right-aligned, that immediately calls `setSelector('')` on click. The SelectorInput two-way sync already clears the editor when the store selector changes. Requirements: render the button only when the selector is non-empty; unobtrusive styling (`var(--ink-3)` glyph, hover to `var(--ink-2)`, no border/background, cursor pointer, flexShrink 0); title "Clear selector"; the glyph is a plain multiplication sign or 'x' character, no emoji. Clearing returns the canvas to the overview (empty selector = `.g:*` default).

- [ ] Step 1: Implement in SelectionBar.tsx.
- [ ] Step 2: `bunx vitest run` + `bunx tsc --noEmit -p tsconfig.app.json` clean; visual check (type selector, click x, editor empties, overview returns).
- [ ] Step 3: Commit `feat: clear button on the selector input`.

### Task 16: Cmd-K selects the 1-hop neighborhood (added post-planning at user request)

**Files:** Modify `src/app/QuickJump.tsx`.

**Context:** Picking a table in the Cmd-K modal currently sets the selector to the bare segment. It should set `~1<seg>` (the table plus its undirected 1-hop neighbors), matching the click-to-focus idiom. Apply to both Enter (replace: selector becomes `~1seg`) and Shift-Enter (union: append `~1seg`). Update the input placeholder if it names the behavior.

- [ ] Step 1: Change `pick` to use `` `~1${seg}` ``; `bunx vitest run` + tsc clean; visual check.
- [ ] Step 2: Commit `feat: cmd-k jumps to the 1-hop neighborhood of a table`.
