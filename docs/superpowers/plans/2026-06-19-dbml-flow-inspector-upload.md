# DBML Flow — Inspector Detail & File Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** (1) Inspector shows full, collapsible Columns and Foreign-keys lists; (2) users can upload a `.dbml` file to view their own (prod) data.

**Architecture:** Front-end only over the existing store. Inspector reads the selected table's columns/refs from the Plan 1 `Model`. Upload reads a file via `FileReader` and calls `loadDbml`, surfacing parse errors.

**Tech Stack:** React + TS, Zustand, Vitest, Playwright. Consumes `@/model/*`, `@/canvas/classifyTable`, `@/app/store`.

## Global Constraints
- Reuse the `Model` (`model.tables`, `model.refs`) and `classifyTable`; do not re-parse.
- Inline `style={{fontFamily}}` for the mockup fonts (Tailwind escaped-quote font classes don't compile here). Dark theme, existing CSS vars.
- `loadModel`/`loadDbml` can throw `DbmlParseError`; uploads MUST catch it and show a readable error without crashing.
- Work on `main`. Screenshot-verify visual tasks. Run `bun run test` AND `bun run build` before each commit (vitest doesn't typecheck). Conventional commits.

---

### Task 1: Inspector — collapsible Columns & Foreign-keys lists

**Files:**
- Modify: `src/app/Inspector.tsx`
- Test (visual): Playwright screenshot

**Interfaces:**
- Consumes: `useAppStore` (model, selectedTable, selector, setSelector), `classifyTable`.
- Produces: the inspector keeps its eyebrow/title/schema and the summary rows, and adds two **collapsible sections** below them:
  - **Columns (N)** — collapsible (default collapsed for large tables, or always collapsible via `<details>` or a useState toggle). Lists every column of `model.tables.get(selectedTable)`: name (mono), type (dim color), and a marker for PK (gold ⚷) and FK (amber ⌖). FK detection: column name ∈ any `model.refs` `fromColumns` where `fromTable === selectedTable`.
  - **Foreign keys (N)** — collapsible. One row per `model.refs` entry with `fromTable === selectedTable`: `fk_column → target_table_last_segment` (clickable → append target last-segment to selector, reuse the existing `add` behavior). When there are zero FKs, hide the section or show "none".
  - The existing "References (toward dims)" / "Referenced by (toward facts)" lists may be kept or folded into the new Foreign-keys section — implementer's choice, but do not lose the inbound "Referenced by" list (it's useful and distinct from outbound FKs).

- [ ] **Step 1** — Implement the two collapsible sections in `Inspector.tsx`. Use a small `Collapsible` (a `useState(open)` + a clickable header showing `▸/▾ Label (count)`), or native `<details>` styled to the theme. Keep it framework-light. Columns section open state defaults: open if ≤ 12 columns, else collapsed.

- [ ] **Step 2 — Screenshot-verify:** run dev (background); Playwright: navigate to a table view (`/?s=group%3Ashop.sales`), click a table node (e.g. `.react-flow__node[data-id="model.shop.f_order"]`) to populate the inspector; confirm the **Columns (12)** section lists all 12 f_order columns with type + FK markers on sk_customer/sk_product/sk_employee, and a **Foreign keys (3)** section lists the 3 FK→target rows; toggle a section collapsed/expanded. Screenshot. Stop server.

- [ ] **Step 3** — `bun run test && bun run build`, commit: `feat: inspector shows collapsible full column and foreign-key lists`.

---

### Task 2: Upload a `.dbml` file

**Files:**
- Create: `src/app/LoadButton.tsx`
- Modify: `src/app/SelectionBar.tsx` (or `AppShell.tsx`) to mount the load control; `src/app/store.ts` to add an error field if needed.
- Test: `src/app/store.test.ts` (extend for a safe-load action) and Playwright screenshot.

**Interfaces:**
- Produces:
  - Store: a `loadError: string | null` field + change `loadDbml` to a safe variant OR add `loadDbmlSafe(content): void` that try/catches `loadModel`, sets `model` + clears error on success, or sets `loadError` (the `DbmlParseError.message`) on failure without changing the model. (Keep existing `loadDbml` for the default fixture load, or route both through the safe path.)
  - `LoadButton.tsx`: a top-bar button "Load .dbml" that opens a hidden `<input type="file" accept=".dbml,.txt">`; on change, `FileReader.readAsText` → `loadDbmlSafe(text)`. Also support drag-and-drop onto the canvas/app (optional but nice). On error, show the `loadError` message (a small toast/banner in the bar) and keep the current model.

- [ ] **Step 1 — TDD the safe-load store action** (extend `store.test.ts`): `loadDbmlSafe(validGroupedDbml)` sets `model` (8 tables) and `loadError === null`; `loadDbmlSafe('Table { broken')` leaves `model` unchanged (or null on first load) and sets `loadError` to a non-empty string. Implement in `store.ts`.

- [ ] **Step 2** — Write `LoadButton.tsx` (hidden file input + FileReader). Mount it in the top bar (near "Save data mart"). Wire `loadError` display (small inline message).

- [ ] **Step 3 — Screenshot-verify:** run dev (background); Playwright: use the file input to upload `src/model/__fixtures__/grouped.dbml` (or set the input's files) and confirm the canvas re-renders the uploaded model's overview; then upload a deliberately malformed file and confirm an error message shows and the previous model stays. (If driving the native file dialog via Playwright is hard, use `browser_file_upload` / set input files via evaluate.) Screenshot. Stop server.

- [ ] **Step 3b — Manual note:** the real prod `output.grouped.dbml` (gitignored, repo root) is the intended prod test file — note in the report that it loads (64 tables / 80 refs / 10 groups).

- [ ] **Step 4** — `bun run test && bun run build`, commit: `feat: upload a .dbml file to view your own data (with parse-error handling)`.

---

## Self-Review
- #1 all columns collapsible → Task 1. #2 all FKs collapsible → Task 1. #3 upload → Task 2 (+ real prod file regenerated locally, gitignored).
- Reuses Model/classifyTable; upload handles `DbmlParseError`. Single-source-of-truth unaffected (upload swaps the model; selector resets via load).
