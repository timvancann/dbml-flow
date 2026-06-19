# DBML Flow — Autocomplete Selector + Help Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Replace the chips selector with a single **CodeMirror 6 autocompleting input** (Dagster-style: suggests table/group names and operators as you type), and add a **"?" Help modal** documenting the DSL.

**Architecture:** The autocomplete is a **pure completion function** (`selectorCompletions(model, textBeforeCursor)`) wrapped by a thin CodeMirror editor component. The Help modal is static content built from the DSL reference.

**Tech Stack:** React + TS, Zustand, CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/autocomplete`, `@codemirror/commands`), Vitest, Playwright. Consumes `@/model/*`, `@/app/store`.

## Global Constraints
- The completion logic lives in a **pure, React-free, unit-tested** module; CodeMirror only wires it in.
- Selector string stays the single source of truth: the editor reads/writes `store.selector`; external changes (rail/canvas/URL) sync into the editor without feedback loops.
- Single-line input (no newlines). Inline `style={{fontFamily}}` for mono. Dark theme / existing CSS vars.
- Reuse `model.tables`/`model.groups` for suggestions; reuse the DSL semantics from SPEC.md for the help content. Work on `main`. Run `bun run test` AND `bun run build` before each commit. Conventional commits.

---

### Task 1: `selectorCompletions` — pure autocomplete logic

**Files:**
- Create: `src/app/selectorCompletions.ts`
- Test: `src/app/selectorCompletions.test.ts`

**Interfaces:**
- Consumes: `Model`.
- Produces:
  - `interface SelectorOption { label: string; detail?: string; type?: string }`
  - `interface SelectorCompletion { from: number; options: SelectorOption[] }`
  - `selectorCompletions(model: Model, textBefore: string): SelectorCompletion` — completions for the token at the end of `textBefore`. `from` is the absolute index where the inserted text begins (so CodeMirror replaces `textBefore.slice(from)`).

**Algorithm:** Let `tokenStart` = index after the last whitespace in `textBefore` (0 if none); `token` = `textBefore.slice(tokenStart)`. Build, from the model: `tableSegs` = sorted unique last-dot-segments of `model.tables` keys; `groupSegs` = sorted unique last-dot-segments of `model.groups` names.
- If `token` starts with `group:` → `rest = token.slice(6)`; `from = tokenStart + 6`; options = `groupSegs` whose value startsWith `rest` (type `'group'`).
- Else if `token` starts with `g:` → `rest = token.slice(2)`; `from = tokenStart + 2`; options = `groupSegs` startsWith `rest`.
- Else if `token` starts with `path:` → `body = token.slice(5)`; if `body` contains `>`: `[a, b] = body.split('>')`; `from = tokenStart + 5 + a.length + 1`; options = `tableSegs` startsWith `b`. Else: `from = tokenStart + 5`; options = `tableSegs` startsWith `body`.
- Else (plain token, may have a leading operator run of `[!~+0-9]`): `prefixLen` = length of the leading `[!~+0-9]*` run of `token`; `bare = token.slice(prefixLen)`; `from = tokenStart` and options are **full-token** replacements:
  - keyword prefixes `'group:'`, `'g:'`, `'path:'` whose value startsWith `token` (type `'keyword'`), AND
  - for each `tableSeg` startsWith `bare`: label = `token.slice(0, prefixLen) + tableSeg` (preserve the operator prefix; type `'table'`).
- Cap options to ~50 (sorted) for sanity. Empty token → tables + keyword prefixes.

- [ ] **Step 1 — Write the failing test** (`selectorCompletions.test.ts`), loading the synthetic `grouped.dbml` via `loadModel`:

```ts
import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { selectorCompletions } from '@/app/selectorCompletions';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const labels = (text: string) => selectorCompletions(model, text).options.map((o) => o.label);

describe('selectorCompletions', () => {
  it('suggests table last-segments for a bare token', () => {
    const r = selectorCompletions(model, 'd_cust');
    expect(r.from).toBe(0);
    expect(r.options.map((o) => o.label)).toContain('d_customer');
  });
  it('preserves a leading operator on table suggestions', () => {
    expect(labels('~d_cu')).toContain('~d_customer');
    expect(labels('+f_or')).toContain('+f_order');
  });
  it('suggests group segments after group:', () => {
    const r = selectorCompletions(model, 'group:sal');
    expect(r.from).toBe('group:'.length);
    expect(r.options.map((o) => o.label)).toContain('sales');
  });
  it('suggests the second table after path:a>', () => {
    const r = selectorCompletions(model, 'path:f_order>d_war');
    expect(r.from).toBe('path:f_order>'.length);
    expect(r.options.map((o) => o.label)).toContain('d_warehouse');
  });
  it('suggests keyword prefixes for a fresh token', () => {
    expect(labels('gr')).toContain('group:');
    expect(labels('pa')).toContain('path:');
  });
  it('completions are scoped to the last whitespace token', () => {
    const r = selectorCompletions(model, 'group:sales d_cust');
    expect(r.from).toBe('group:sales '.length);
    expect(r.options.map((o) => o.label)).toContain('d_customer');
  });
});
```

- [ ] **Step 2 — Run → FAIL.**  - [ ] **Step 3 — Implement** per the algorithm.  - [ ] **Step 4 — Run → PASS.**

- [ ] **Step 5 — Commit:** `feat: pure selector autocomplete completion logic`

---

### Task 2: CodeMirror autocomplete selector input (replaces chips)

**Files:**
- Create: `src/app/SelectorInput.tsx`
- Modify: `src/app/SelectionBar.tsx`
- Test (visual): Playwright screenshot

**Interfaces:**
- Consumes: `useAppStore` (selector, setSelector), `selectorCompletions` (Task 1), CodeMirror 6.
- Produces: `SelectorInput` — a single-line CodeMirror editor bound to `store.selector`:
  - `autocompletion({ override: [ (ctx) => { const text = ctx.state.sliceDoc(0, ctx.pos); const r = selectorCompletions(model, text); return r.options.length ? { from: r.from, options: r.options.map(o => ({ label: o.label, type: o.type, detail: o.detail })) } : null; } ], activateOnTyping: true })`.
  - Single-line: include a filter that rejects newline insertions (e.g. `EditorState.transactionFilter` dropping changes containing `\n`), and a keymap where Enter runs `acceptCompletion` (do not insert a newline).
  - Two-way sync: an `EditorView.updateListener` that, on `update.docChanged` from user input, calls `setSelector(view.state.doc.toString())`; and a `useEffect` on `selector` that dispatches a replace transaction **only if** `view.state.doc.toString() !== selector` (prevents loops) so rail/canvas/URL changes reflect in the editor.
  - Themed to the dark bar (transparent background, mono font, `--ink-2` text). Placeholder "selector — e.g. group:sales f_order+ or path:a>b".

- `SelectionBar.tsx`: REMOVE the chips rendering and the `{}` edit toggle; the bar becomes wordmark · `<SelectorInput/>` (flex-1) · "Find path" · "?" Help button (Task 3) · "Load .dbml". (The chips/`parseSelector` display is replaced by the live editor.)

- [ ] **Step 1 — Install:** `bun add @codemirror/state @codemirror/view @codemirror/autocomplete @codemirror/commands`

- [ ] **Step 2 — Write `SelectorInput.tsx`** (CM6 single-line editor + completion override + two-way sync as above). The model comes from `useAppStore((s) => s.model)`; rebuild the completion source when the model changes.

- [ ] **Step 3 — Rewire `SelectionBar.tsx`** to use `<SelectorInput/>` in place of the chips+input block. Keep "Find path" + "Load .dbml"; leave a slot for the "?" Help button (Task 3 fills it).

- [ ] **Step 4 — Screenshot-verify:** run dev (background); Playwright: focus the selector input, type `group:` and confirm an autocomplete dropdown lists group segments (e.g. `sales`, `inventory`, `people`); accept one and confirm the canvas updates; clear and type `d_` and confirm table suggestions; type `path:f_order>` and confirm second-endpoint table suggestions. Also confirm clicking a table in the rail/canvas updates the input text (two-way sync). Screenshot. Stop server.

- [ ] **Step 5 — `bun run test && bun run build`, commit:** `feat: Dagster-style autocompleting selector input (CodeMirror) replacing chips`

---

### Task 3: "?" Help modal

**Files:**
- Create: `src/app/HelpModal.tsx`
- Modify: `src/app/SelectionBar.tsx` (mount the "?" button + modal)
- Test (visual): Playwright screenshot

**Interfaces:**
- Produces: `HelpModal` — a "?" button in the top bar (in the old Save slot) that opens a modal/dialog (a simple themed overlay or shadcn `Dialog`) containing:
  - **Selector syntax** — the DSL table (union/intersection/exclude, `~N`/`+`/`N+` traversal, `group:`/`g:`, `*` glob, `path:a>b`) with one-line meanings, copied from SPEC.md.
  - **Exploring** — "click a table to focus it + its neighbors; use the hop stepper to widen; click ‘Find path’ then two tables for the shortest reference path."
  - A few concrete examples (`group:sales`, `f_order+`, `~2d_customer`, `path:f_order>d_warehouse`).
  - Close on backdrop click / Esc / a close button.

- [ ] **Step 1 — Write `HelpModal.tsx`** (button + modal, themed dark, mono for syntax). Mount in `SelectionBar.tsx` in the help slot.

- [ ] **Step 2 — Screenshot-verify:** run dev; Playwright: click "?", confirm the modal shows the syntax table + examples; close it (backdrop/Esc/button). Screenshot. Stop server.

- [ ] **Step 3 — `bun run test && bun run build`, commit:** `feat: help modal documenting the selector DSL and exploration`

---

## Self-Review
- Single autocomplete input replacing chips → Tasks 1+2. "?" Help modal → Task 3. Pure completion logic unit-tested (Task 1); editor + modal screenshot-verified. Selector remains the single source of truth with loop-safe two-way sync. CodeMirror is isolated to `SelectorInput.tsx`.
