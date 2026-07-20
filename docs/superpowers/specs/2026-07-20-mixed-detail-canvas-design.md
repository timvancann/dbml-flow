# Mixed-detail canvas: `.` collapse modifier, in-place group expansion, and small usability features

Date: 2026-07-20
Status: approved

## Problem

The canvas is all-or-nothing: either the group overview (super-nodes, only when the
selector is empty) or a selection of fully detailed table nodes. Two things are
impossible today:

1. Collapsing a table's attributes to view it as a single compact node while keeping
   other tables detailed.
2. Expanding one group in place, so its tables are visible alongside the other groups'
   super-nodes and the cross-group edges.

Both are the same underlying capability: a canvas where each unit (table or group)
carries a detail level, expressed in the selector so every view stays a shareable URL.

## Design

### 1. Grammar: the `.` collapse modifier

`parseAtom` gains a leading-`.` check (before the existing `~`/`+` prefixes), setting
`collapsed: true` on the atom. It composes with all existing forms:

| Selector | Meaning |
|---|---|
| `.d_customer` | select the table, render as a compact header-only card |
| `.g:*` | all groups as super-nodes (this IS the overview) |
| `.~2 fact_orders` | tables within 2 undirected hops, rendered compact |
| `.g:* group:sales` | mixed view: sales expanded to tables, other groups as super-nodes |

Semantics per atom type:

- Dotted table / glob / traversal atom: every table the atom matches renders as a
  compact card.
- Dotted group atom (`.group:X` / `.g:X`, globs allowed): the group renders as one
  super-node (the existing `GroupNode`) instead of its member tables.

**Precedence rule** (load-bearing):

1. An exact-name atom overrides any glob / group / traversal match for that table.
2. Among matches of equal specificity, expanded wins over collapsed.

Consequences:

- `.g:* group:sales` — group-level tie, expanded wins for sales' tables.
- `group:sales .fact_orders` — exact dotted atom beats the group match; that one table
  renders compact inside an otherwise expanded group.
- A table selected individually while its group is dotted **escapes the super-node**;
  the super-node's table count adjusts to the remaining members.
- `!` / `--exclude` are unchanged and still remove tables outright.

**Overview unification:** an empty selector defaults to `.g:*` (resolved in
`initStore` / `resolveSelection`), reproducing today's overview. `buildOverview` as a
special path goes away.

Ungrouped tables keep whatever treatment the current overview gives them; `.g:*` must
reproduce the current overview graph exactly (locked by a smoke test).

### 2. Resolution and rendering

`resolveSelection` returns detail levels alongside the selected set:

```ts
interface ResolvedSelection {
  full: Set<string>;        // table names rendered with columns
  collapsed: Set<string>;   // table names rendered as compact cards
  superGroups: Set<string>; // group names rendered as super-nodes
}
```

`selectionToFlow` absorbs `buildOverview`'s aggregation logic and becomes the single
flow builder:

- **Compact table card**: the existing `TableNode` header (accent bar, F/D badge,
  name, schema) merged with the counts footer (`N cols, N fk, N pk`), roughly 48px
  tall. One target handle on the left, one source handle on the right.
- **Edge anchoring by endpoint state**: column handle if the endpoint table is full,
  node handle if compact, the group node if the table sits inside a super-node.
- **Edge merging**: refs that land on the same (node, node) pair after anchoring merge
  into one edge carrying a count label (same behavior the overview has today).
- **Layout**: elk already handles heterogeneous node sizes; only the per-node measured
  heights change (compact card and super-node heights).

### 3. Interaction

- **Chevron on every table header** toggles that table's detail level by appending an
  exact atom (`.name` to collapse, `name` to expand) to the selector, removing any
  prior exact atom for the same table first. The selector remains the single source of
  truth; hand-typed selectors and UI clicks are the same mechanism.
- **Clicking a super-node expands the group in place** (appends `group:X`). The
  current drill-into-group behavior (replace the selector) moves to a small focus
  button on the super-node, so both gestures survive.
- **Collapsing an expanded group back**: the selection bar chip for `group:X` gets a
  collapse action that rewrites the token to `.group:X` (removing it entirely stays
  the chip's existing remove behavior).

### 4. Companion features

Independent of the grammar work; each lands as its own commit, any order.

- **Cmd-K quick-jump**: modal fuzzy finder over table names (vocabulary from
  `selectorCompletions.ts`). Enter replaces the selector with the chosen table;
  Shift-Enter unions it onto the current selector.
- **Copy DBML / PNG export**: toolbar actions. Copy DBML serializes the currently
  selected tables plus the refs among them back to a DBML snippet on the clipboard.
  Export PNG uses the standard React Flow html-to-image viewport capture.
- **Cardinality glyphs**: thread each ref's relation (`<`, `>`, `-`) from `parseDbml`
  through the model types, render small `1` / `N` labels at the ends of
  table-to-table edges. Aggregated (merged) edges keep their count label instead.
- **Selector history**: last 15 distinct non-empty selectors in localStorage,
  surfaced as a dropdown on the selector input.
- **Minimap**: React Flow's `<MiniMap>`, styled to the theme, hidden when the
  rendered graph is small (under ~10 nodes).

### 5. Testing

Extend the sibling test file of each touched module:

- `parseSelector`: `.` prefix on plain names, globs, `g:`, and traversal atoms;
  interaction with `!`/`--exclude` and comma intersections.
- `resolveSelection`: the precedence table — exact-beats-glob, expanded-beats-collapsed
  at equal specificity, escape-from-super-node with adjusted counts.
- `selectionToFlow`: anchor selection per endpoint state, edge merging with counts,
  compact-card sizing inputs to layout.
- Smoke: empty selector produces the same graph as today's overview.

Companion features get unit tests where there is logic (DBML serialization,
history dedupe/cap, cardinality threading); pure-render additions (minimap) are
covered by the existing smoke test.

## Out of scope

- Hover highlighting of neighbors (considered, dropped for now).
- Semantic zoom (automatic detail by zoom level).
- Editing or persisting anything outside the URL and localStorage history.
