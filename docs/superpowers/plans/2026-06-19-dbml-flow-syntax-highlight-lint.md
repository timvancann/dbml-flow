# DBML Flow — Selector Syntax Highlighting & Linting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** In the CodeMirror selector input, **color the DSL** (operators vs object names vs keywords vs numbers) and **surface diagnostics** — errors for invalid syntax (e.g. a stray `-`), warnings for unresolved table/group references.

**Architecture:** One pure module — `tokenizeSelector(text)` (span classification) and `validateSelector(model, text)` (diagnostics) — drives both a decoration-based highlighter and a `@codemirror/lint` linter inside `SelectorInput.tsx`.

**Tech Stack:** React + TS, CodeMirror 6 (`@codemirror/view`, `@codemirror/state`, `@codemirror/lint`), Vitest, Playwright. Consumes `@/model/*`, `@/selection/matchPiece`.

## Global Constraints
- `tokenizeSelector` + `validateSelector` are **pure, React-free, unit-tested**. CodeMirror integration is confined to `SelectorInput.tsx`.
- Reuse `matchPiece` for reference resolution; reuse the existing operator grammar (`~`/`+`/`N`, `!`, `--exclude`, `group:`/`g:`/`path:`, `*`, `,`).
- Severity split: invalid syntax → `error`; unresolved reference / no-match → `warning`.
- Dark theme colors via CSS vars. Work on `main`. Run `bun run test` AND `bun run build` before each commit. Conventional commits.

---

### Task 1: `tokenizeSelector` + `validateSelector` (pure)

**Files:**
- Create: `src/app/selectorSyntax.ts`
- Test: `src/app/selectorSyntax.test.ts`

**Interfaces:**
- Produces:
  - `type TokenKind = 'keyword' | 'operator' | 'number' | 'glob' | 'identifier' | 'invalid' | 'whitespace'`
  - `interface Token { from: number; to: number; kind: TokenKind; text: string }`
  - `interface Diagnostic { from: number; to: number; severity: 'error' | 'warning'; message: string }`
  - `tokenizeSelector(text: string): Token[]`
  - `validateSelector(model: Model, text: string): Diagnostic[]`

**Tokenizer rules** (single left-to-right scan, contiguous spans):
- whitespace run → `whitespace`.
- literal `--exclude` → `keyword`. Literal prefixes `group:`, `g:`, `path:` (including the colon) → `keyword`.
- `!` `~` `+` `,` `>` → `operator` (each its own 1-char token, EXCEPT a digit run immediately following `~`/`+` or immediately preceding `+` is a `number`).
- a digit run NOT part of an identifier → `number`.
- identifier: starts with `[A-Za-z_]`, continues `[A-Za-z0-9_.]` → `identifier` (so `f_order2`, `model.shop.f_order` are one identifier).
- `*` → `glob`.
- any other character (e.g. `-` alone, `&`, `|`, `(`, `)`, `@`) → `invalid` (one token per run of such chars).

**Validator rules** (use `tokenizeSelector` + a light position-aware parse):
- Every `invalid` token → `error` `Unexpected "<text>"`.
- For each whitespace-separated chunk, determine the "piece" and its span (strip leading `!`, `~N`, `N+`, trailing `+N`; handle `--exclude <next>` as marking the next chunk a piece). Then:
  - plain name (no `*`, no `group:`/`g:`/`path:` prefix): if `matchPiece(model, name).size === 0` → `warning` `Unknown table "<name>"` over the name span.
  - `group:NAME`: if no group resolves (`matchPiece(model, 'group:'+NAME).size === 0`) → `warning` `Unknown group "<NAME>"`.
  - `g:PATTERN` or a name containing `*`: if `matchPiece` is empty → `warning` `No tables match "<...>"`.
  - `path:a>b`: missing `>` or empty `a`/`b` → `warning` `Path needs two tables: path:a>b`; else if `a` or `b` resolves empty → `warning` `Unknown table in path: "<x>"`.
- Empty / whitespace-only input → no diagnostics. Return sorted by `from`.

- [ ] **Step 1 — Write the failing test** (`selectorSyntax.test.ts`), loading synthetic `grouped.dbml`:

```ts
import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { tokenizeSelector, validateSelector } from '@/app/selectorSyntax';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const kinds = (t: string) => tokenizeSelector(t).filter((x) => x.kind !== 'whitespace').map((x) => x.kind);
const errs = (t: string) => validateSelector(model, t);

describe('tokenizeSelector', () => {
  it('classifies operators, numbers, identifiers', () => {
    expect(kinds('2+d_customer')).toEqual(['number', 'operator', 'identifier']);
    expect(kinds('~d_customer')).toEqual(['operator', 'identifier']);
  });
  it('classifies keywords and globs', () => {
    expect(kinds('group:sales')).toEqual(['keyword', 'identifier']);
    expect(kinds('g:*sales')).toEqual(['keyword', 'glob', 'identifier']);
    expect(kinds('path:f_order>d_warehouse')).toEqual(['keyword', 'identifier', 'operator', 'identifier']);
  });
  it('flags invalid characters', () => {
    expect(kinds('-d_customer')).toContain('invalid');
  });
});

describe('validateSelector', () => {
  it('no diagnostics for valid input', () => {
    expect(errs('group:sales f_order+ ~2d_customer')).toEqual([]);
    expect(errs('path:f_order>d_warehouse')).toEqual([]);
    expect(errs('')).toEqual([]);
  });
  it('errors on an invalid operator/char', () => {
    const d = errs('-d_customer');
    expect(d.some((x) => x.severity === 'error')).toBe(true);
  });
  it('warns on an unknown table', () => {
    const d = errs('not_a_table');
    expect(d.some((x) => x.severity === 'warning' && /Unknown table/.test(x.message))).toBe(true);
  });
  it('warns on an unknown group', () => {
    const d = errs('group:nope');
    expect(d.some((x) => x.severity === 'warning' && /Unknown group/.test(x.message))).toBe(true);
  });
  it('warns on a malformed path', () => {
    expect(errs('path:f_order').some((x) => /Path needs/.test(x.message))).toBe(true);
  });
});
```

- [ ] **Step 2 — Run → FAIL.**  - [ ] **Step 3 — Implement.**  - [ ] **Step 4 — Run → PASS** (then `bun run test` + `bun run build`).

- [ ] **Step 5 — Commit:** `feat: pure selector tokenizer + validator (syntax + reference diagnostics)`

---

### Task 2: Highlighting + lint in the CodeMirror input

**Files:**
- Modify: `src/app/SelectorInput.tsx`
- Modify: `src/index.css` (token color classes)
- Test (visual): Playwright screenshot

**Interfaces:**
- Consumes: `tokenizeSelector`, `validateSelector` (Task 1); `@codemirror/lint` `linter` + `lintGutter` (optional); `@codemirror/view` `Decoration`, `ViewPlugin`.
- Produces, inside `SelectorInput`:
  - **Highlighting** — a `ViewPlugin` that recomputes a `DecorationSet` from `tokenizeSelector(doc)` on every doc change: `Decoration.mark({ class })` per non-whitespace token, class by kind (`cm-sel-operator`, `cm-sel-keyword`, `cm-sel-number`, `cm-sel-glob`, `cm-sel-identifier`, `cm-sel-invalid`).
  - **Lint** — `linter((view) => validateSelector(model, view.state.doc.toString()).map((d) => ({ from: d.from, to: d.to, severity: d.severity, message: d.message })))` added to the extensions (debounce default is fine). Diagnostics underline the span + show the message on hover.
- `src/index.css` color classes (dark theme):
  - `.cm-sel-operator { color: var(--accent); }`
  - `.cm-sel-keyword { color: var(--dim); }`
  - `.cm-sel-number { color: var(--pk); }`
  - `.cm-sel-glob { color: var(--fact); }`
  - `.cm-sel-identifier { color: var(--ink); }`
  - `.cm-sel-invalid { color: #ff6b6b; text-decoration: wavy underline; }`
  (Tune to taste, but operators, objects/identifiers, and keywords must be visibly distinct.)

- [ ] **Step 1 — Install:** `bun add @codemirror/lint`

- [ ] **Step 2 — Add the highlight ViewPlugin + lint extension** to the editor built in `SelectorInput.tsx` (alongside the existing autocompletion + single-line + sync extensions). Rebuild on model change as today. Add the CSS classes to `src/index.css`.

- [ ] **Step 3 — Screenshot-verify:** run dev (background); Playwright: type `group:sales f_order+ ~2d_customer` and confirm operators/keywords/numbers/identifiers render in distinct colors (screenshot). Then type `-d_customer` and confirm the `-` shows an error (red wavy underline / lint message). Then type `not_a_table` and confirm a warning. Then `group:nope` → warning. Screenshot the colored input + a diagnostic. Stop server.

- [ ] **Step 4 — `bun run test` (Task 1 count) AND `bun run build` (clean), commit:** `feat: selector syntax highlighting + lint diagnostics in the input`

---

## Self-Review
- Operators/objects/keywords/numbers colored distinctly; invalid syntax → error, unknown references → warning → Tasks 1+2. Pure tokenizer/validator unit-tested; editor integration screenshot-verified. Logic reuses `matchPiece`; CodeMirror confined to `SelectorInput.tsx`. Selector remains the single source of truth (highlighting/lint are read-only views over the doc).
