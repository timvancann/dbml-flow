# DBML Flow — Interactive Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the Plan 3 canvas in the full four-region app shell — a Zustand store, URL + localStorage persistence, a searchable/virtualized left rail, a synced selection bar (chips ⇄ DSL), and a table inspector — so a user can explore the loaded model by clicking, searching, and typing selectors.

**Architecture:** A new `src/app/` layer. A single Zustand store holds `model`, `selector`, `selectedTable`, and `savedMarts`. Pure persistence functions (URL search ⇄ selector, localStorage marts) are unit-tested; a thin `usePersistence` hook wires them to the store. The shell (`AppShell`) composes the existing `CanvasApp` (Plan 3) with the rail, selection bar, and inspector, all reading/writing the store. Visual components are verified by Playwright screenshot against the real `grouped.dbml`.

**Tech Stack:** React + TypeScript, Zustand, `@tanstack/react-virtual`, Tailwind v4 + shadcn (installed), Vitest, Playwright. Consumes `@/model/*`, `@/selection/*`, `@/canvas/*`.

## Global Constraints

- **Pin new deps:** `zustand` and `@tanstack/react-virtual` (latest stable at install; record exact versions in the commit).
- **Single source of truth:** the `selector` string in the Zustand store. Canvas, selection bar, rail clicks, inspector links, and URL all read/write that one string. No parallel selection state.
- **Store-pure / side-effect-free:** `src/app/store.ts` and `src/app/persistence.ts` hold no React and no direct `window`/`localStorage` access in their pure functions — persistence functions receive `search: string` / `storage: Storage` as arguments so they are unit-testable. Only the `usePersistence` hook touches `window`.
- **Design contract:** the rail, selection bar, and inspector match `docs/design/canvas-mockup-v1.html` (dark blueprint, amber facts / cyan dims, monospace data). Reuse the CSS variables already in `src/index.css`.
- **Saved data mart = named selector string.** localStorage key `dbmlflow.marts`, value `SavedMart[]` (`{ name, selector }`).
- **URL param:** selector lives in `?s=<selector>` (URL-encoded). Empty selector → no `s` param.
- **Fact/dim glyphs in the rail** use `classifyTable` (Plan 3) — soft hint only.
- **Reuse, do not duplicate:** the rail/inspector read columns/refs/groups from the Plan 1 `Model`; the selection bar parses/!builds the DSL via Plan 2 (`parseSelector` for chip display). Do not re-implement parsing.
- **Work directly on `main`.** TDD for logic (tasks 1–2); Playwright screenshot verification for visual tasks (3–6). Conventional commits.
- **Fixture:** the app already loads `src/model/__fixtures__/grouped.dbml` via `?raw` (Plan 3 `App.tsx`); the shell keeps that default load (file loading is Plan 5).

---

### Task 1: App store (Zustand)

**Files:**
- Create: `src/app/store.ts`
- Test: `src/app/store.test.ts`

**Interfaces:**
- Produces:
  - `interface SavedMart { name: string; selector: string }`
  - `interface AppState { model: Model | null; selector: string; selectedTable: string | null; savedMarts: SavedMart[]; setSelector(s: string): void; setSelectedTable(t: string | null): void; setModel(m: Model): void; loadDbml(content: string): void; saveMart(name: string): void; removeMart(name: string): void; setSavedMarts(m: SavedMart[]): void }`
  - `const useAppStore` (Zustand store hook). `loadDbml` calls `loadModel` and sets `model` (and resets `selector`/`selectedTable`). `saveMart(name)` upserts `{ name, selector }` using the current selector. For testing, expose the vanilla store via `useAppStore.getState()`/`setState()`.

- [ ] **Step 1: Install zustand and write the failing test**

```bash
bun add zustand
```

```ts
// src/app/store.test.ts
import { readFileSync } from 'node:fs';
import { useAppStore } from '@/app/store';

const dbml = readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8');

beforeEach(() => {
  useAppStore.setState({ model: null, selector: '', selectedTable: null, savedMarts: [] });
});

describe('useAppStore', () => {
  it('loads a model from DBML and indexes it', () => {
    useAppStore.getState().loadDbml(dbml);
    expect(useAppStore.getState().model?.tables.size).toBe(64);
  });

  it('loadDbml resets selector and selectedTable', () => {
    useAppStore.setState({ selector: 'x', selectedTable: 'y' });
    useAppStore.getState().loadDbml(dbml);
    expect(useAppStore.getState().selector).toBe('');
    expect(useAppStore.getState().selectedTable).toBeNull();
  });

  it('sets the selector', () => {
    useAppStore.getState().setSelector('group:sales');
    expect(useAppStore.getState().selector).toBe('group:sales');
  });

  it('saveMart upserts the current selector under a name', () => {
    useAppStore.getState().setSelector('f_x+');
    useAppStore.getState().saveMart('My Mart');
    expect(useAppStore.getState().savedMarts).toEqual([{ name: 'My Mart', selector: 'f_x+' }]);
    useAppStore.getState().setSelector('g:sales_*');
    useAppStore.getState().saveMart('My Mart'); // upsert, not duplicate
    expect(useAppStore.getState().savedMarts).toEqual([{ name: 'My Mart', selector: 'g:sales_*' }]);
  });

  it('removeMart deletes by name', () => {
    useAppStore.getState().setSelector('a');
    useAppStore.getState().saveMart('A');
    useAppStore.getState().removeMart('A');
    expect(useAppStore.getState().savedMarts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/app/store.test.ts`
Expected: FAIL — cannot find module `@/app/store`.

- [ ] **Step 3: Write the store**

```ts
// src/app/store.ts
import { create } from 'zustand';
import { loadModel } from '@/model/loadModel';
import type { Model } from '@/model/types';

export interface SavedMart {
  name: string;
  selector: string;
}

export interface AppState {
  model: Model | null;
  selector: string;
  selectedTable: string | null;
  savedMarts: SavedMart[];
  setSelector: (s: string) => void;
  setSelectedTable: (t: string | null) => void;
  setModel: (m: Model) => void;
  loadDbml: (content: string) => void;
  saveMart: (name: string) => void;
  removeMart: (name: string) => void;
  setSavedMarts: (m: SavedMart[]) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  model: null,
  selector: '',
  selectedTable: null,
  savedMarts: [],
  setSelector: (selector) => set({ selector }),
  setSelectedTable: (selectedTable) => set({ selectedTable }),
  setModel: (model) => set({ model }),
  loadDbml: (content) => set({ model: loadModel(content), selector: '', selectedTable: null }),
  saveMart: (name) =>
    set((state) => {
      const selector = state.selector;
      const others = state.savedMarts.filter((m) => m.name !== name);
      return { savedMarts: [...others, { name, selector }] };
    }),
  removeMart: (name) =>
    set((state) => ({ savedMarts: state.savedMarts.filter((m) => m.name !== name) })),
  setSavedMarts: (savedMarts) => set({ savedMarts }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/app/store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/store.ts src/app/store.test.ts package.json bun.lock
git commit -m "feat: zustand app store for model, selector, and saved marts"
```

---

### Task 2: URL + localStorage persistence

**Files:**
- Create: `src/app/persistence.ts`
- Create: `src/app/usePersistence.ts`
- Test: `src/app/persistence.test.ts`

**Interfaces:**
- Consumes: `SavedMart` (Task 1).
- Produces (pure, in `persistence.ts`):
  - `selectorFromSearch(search: string): string` — reads `s` param.
  - `searchWithSelector(selector: string): string` — returns `''` for empty, else `?s=<encoded>`.
  - `loadMarts(storage: Storage): SavedMart[]` — parses key `dbmlflow.marts`, returns `[]` on missing/invalid.
  - `saveMarts(storage: Storage, marts: SavedMart[]): void`.
- Produces (hook, in `usePersistence.ts`): `usePersistence(): void` — on mount, hydrates selector from `window.location.search` and marts from `localStorage` into the store; subscribes to store changes to write selector to URL (`history.replaceState`) and marts to localStorage. No render output.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/persistence.test.ts
import { selectorFromSearch, searchWithSelector, loadMarts, saveMarts } from '@/app/persistence';

class FakeStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe('persistence', () => {
  it('reads selector from a search string', () => {
    expect(selectorFromSearch('?s=group%3Asales')).toBe('group:sales');
    expect(selectorFromSearch('')).toBe('');
  });

  it('encodes selector into a search string, empty -> ""', () => {
    expect(searchWithSelector('f_x+')).toBe('?s=f_x%2B');
    expect(searchWithSelector('')).toBe('');
  });

  it('round-trips selector through search', () => {
    const s = 'group:sales,*product* !f_stock';
    expect(selectorFromSearch(searchWithSelector(s))).toBe(s);
  });

  it('loads marts, tolerating missing/invalid storage', () => {
    const store = new FakeStorage();
    expect(loadMarts(store)).toEqual([]);
    store.setItem('dbmlflow.marts', 'not json');
    expect(loadMarts(store)).toEqual([]);
  });

  it('saves and reloads marts', () => {
    const store = new FakeStorage();
    const marts = [{ name: 'A', selector: 'a' }];
    saveMarts(store, marts);
    expect(loadMarts(store)).toEqual(marts);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/app/persistence.test.ts`
Expected: FAIL — cannot find module `@/app/persistence`.

- [ ] **Step 3: Write the pure persistence functions**

```ts
// src/app/persistence.ts
import type { SavedMart } from '@/app/store';

const MARTS_KEY = 'dbmlflow.marts';

export function selectorFromSearch(search: string): string {
  return new URLSearchParams(search).get('s') ?? '';
}

export function searchWithSelector(selector: string): string {
  if (!selector) return '';
  const params = new URLSearchParams();
  params.set('s', selector);
  return `?${params.toString()}`;
}

export function loadMarts(storage: Storage): SavedMart[] {
  try {
    const raw = storage.getItem(MARTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMarts(storage: Storage, marts: SavedMart[]): void {
  storage.setItem(MARTS_KEY, JSON.stringify(marts));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/app/persistence.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the wiring hook (no test — thin window glue)**

```ts
// src/app/usePersistence.ts
import { useEffect } from 'react';
import { useAppStore } from '@/app/store';
import { loadMarts, saveMarts, searchWithSelector, selectorFromSearch } from '@/app/persistence';

export function usePersistence(): void {
  useEffect(() => {
    const initialSelector = selectorFromSearch(window.location.search);
    if (initialSelector) useAppStore.getState().setSelector(initialSelector);
    useAppStore.getState().setSavedMarts(loadMarts(window.localStorage));

    let prevSelector = useAppStore.getState().selector;
    let prevMarts = useAppStore.getState().savedMarts;
    const unsub = useAppStore.subscribe((state) => {
      if (state.selector !== prevSelector) {
        prevSelector = state.selector;
        const search = searchWithSelector(state.selector);
        window.history.replaceState(null, '', `${window.location.pathname}${search}`);
      }
      if (state.savedMarts !== prevMarts) {
        prevMarts = state.savedMarts;
        saveMarts(window.localStorage, state.savedMarts);
      }
    });
    return unsub;
  }, []);
}
```

- [ ] **Step 6: Run the full suite, then commit**

Run: `bun run test`
Expected: PASS (all prior + Tasks 1–2).

```bash
git add src/app/persistence.ts src/app/usePersistence.ts src/app/persistence.test.ts
git commit -m "feat: URL and localStorage persistence for selector and saved marts"
```

---

### Task 3: App shell layout

**Files:**
- Create: `src/app/AppShell.tsx`
- Modify: `src/App.tsx`
- Test (visual): Playwright screenshot

**Interfaces:**
- Consumes: `useAppStore` (Task 1), `usePersistence` (Task 2), `CanvasApp` (Plan 3).
- Produces: `AppShell()` — a CSS-grid layout (`grid-template-columns: 264px 1fr 290px; grid-template-rows: 52px 1fr`) with four regions: top bar (placeholder slot for Task 4), left rail (placeholder for Task 5), center `CanvasApp` (wired to store `model`+`selector`, `onSelectorChange` → `setSelector`, `onNodeClick` table → `setSelectedTable`), right inspector (placeholder for Task 6). `App.tsx` loads the fixture into the store on mount, calls `usePersistence()`, renders `AppShell`. Regions use the mockup's panel/line tokens.

- [ ] **Step 1: Write `AppShell.tsx`** (placeholders for rail/bar/inspector, real canvas)

```tsx
// src/app/AppShell.tsx
import { useAppStore } from '@/app/store';
import { CanvasApp } from '@/canvas/Canvas';

export function AppShell() {
  const model = useAppStore((s) => s.model);
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);

  return (
    <div
      className="h-screen w-screen grid bg-[var(--bg)] text-[var(--ink)]"
      style={{ gridTemplateColumns: '264px 1fr 290px', gridTemplateRows: '52px 1fr' }}
    >
      <header className="col-span-3 flex items-center px-4 border-b border-[var(--line)] bg-[var(--panel-2)]" data-slot="selection-bar">
        <span className="font-semibold tracking-tight">dbml flow</span>
      </header>
      <aside className="border-r border-[var(--line)] bg-[var(--panel)] overflow-hidden" data-slot="rail" />
      <main className="min-w-0">
        {model && <CanvasApp model={model} selector={selector} onSelectorChange={setSelector} />}
      </main>
      <aside className="border-l border-[var(--line)] bg-[var(--panel)] overflow-auto" data-slot="inspector" />
    </div>
  );
}
```

- [ ] **Step 2: Wire `App.tsx`**

```tsx
// src/App.tsx
import { useEffect } from 'react';
import rawDbml from '@/model/__fixtures__/grouped.dbml?raw';
import { useAppStore } from '@/app/store';
import { usePersistence } from '@/app/usePersistence';
import { AppShell } from '@/app/AppShell';

export default function App() {
  usePersistence();
  useEffect(() => {
    if (!useAppStore.getState().model) useAppStore.getState().loadDbml(rawDbml);
  }, []);
  return <AppShell />;
}
```

- [ ] **Step 3: Screenshot-verify the shell**

```bash
bun run dev &   # http://localhost:5173
```
Verify with Playwright MCP (load tools via ToolSearch `select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_take_screenshot`): the four-region grid renders — top bar across the top, empty left/right panels, the canvas overview in the center. Screenshot, confirm layout, stop server.

- [ ] **Step 4: Run build, then commit**

Run: `bun run test && bun run build`
Expected: tests pass; build clean.

```bash
git add src/app/AppShell.tsx src/App.tsx
git commit -m "feat: four-region app shell wiring canvas to the store"
```

---

### Task 4: Selection bar (synced chips ⇄ DSL)

**Files:**
- Create: `src/app/SelectionBar.tsx`
- Modify: `src/app/AppShell.tsx` (mount in the top-bar slot)
- Test (visual): Playwright screenshot

**Interfaces:**
- Consumes: `useAppStore` (selector, setSelector, saveMart), `parseSelector` (Plan 2, for chip rendering).
- Produces: `SelectionBar()` — a text input bound to the store `selector` (typing updates the store live), with chips rendered from `parseSelector(selector)` above/inline (each include group → its atoms; excludes shown with `!`), and a "Save data mart" button that prompts for a name and calls `saveMart`. Matches the mockup's `.topbar`/`.selector`/`.chip` styling (fact chips amber, op chips accent, group chips cyan).

- [ ] **Step 1: Write `SelectionBar.tsx`**

```tsx
// src/app/SelectionBar.tsx
import { useAppStore } from '@/app/store';
import { parseSelector } from '@/selection/parseSelector';

export function SelectionBar() {
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);
  const saveMart = useAppStore((s) => s.saveMart);
  const ast = parseSelector(selector);

  return (
    <div className="flex items-center gap-3 w-full">
      <span className="font-[\"Instrument_Serif\",serif] text-[20px]">dbml <em className="text-[var(--dim)]">flow</em></span>
      <div className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg)]">
        {ast.include.flat().map((atom, i) => (
          <span key={`i${i}`} className="text-[12.5px] px-2 h-[22px] inline-flex items-center rounded-md border border-[var(--line-2)] text-[var(--ink-2)]">
            {atom.piece.startsWith('group:') || atom.piece.startsWith('g:') ? atom.piece : atom.piece}
          </span>
        ))}
        {ast.exclude.map((atom, i) => (
          <span key={`e${i}`} className="text-[12.5px] px-2 h-[22px] inline-flex items-center rounded-md border border-[var(--line-2)] text-[var(--ink-3)]">!{atom.piece}</span>
        ))}
        <input
          value={selector}
          onChange={(e) => setSelector(e.target.value)}
          placeholder="selector — e.g. group:sales f_order+"
          className="ml-auto bg-transparent outline-none text-[12px] font-[\"Spline_Sans_Mono\",monospace] text-[var(--ink-2)] flex-1 min-w-[160px]"
        />
      </div>
      <button
        className="text-[12.5px] text-[var(--ink-2)] border border-[var(--line-2)] bg-[var(--panel-2)] px-2.5 py-1.5 rounded-lg"
        onClick={() => {
          const name = window.prompt('Save current selection as data mart:');
          if (name) saveMart(name);
        }}
      >
        ＋ Save data mart
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Mount in `AppShell.tsx`**

Replace the header's inner content with `<SelectionBar />`:

```tsx
import { SelectionBar } from '@/app/SelectionBar';
// ...
<header className="col-span-3 flex items-center px-4 border-b border-[var(--line)] bg-[var(--panel-2)]">
  <SelectionBar />
</header>
```

- [ ] **Step 3: Screenshot-verify**

Run dev server; with Playwright, type a selector (e.g. set `?s=group:sales` by navigating to `http://localhost:5173/?s=group%3Asales`) and confirm: the input shows the selector, a chip renders, and the canvas updates to that group's tables. Screenshot. Also click "Save data mart", accept the prompt, reload, and confirm the URL `?s=` persists. Stop server.

- [ ] **Step 4: Build, commit**

Run: `bun run test && bun run build`

```bash
git add src/app/SelectionBar.tsx src/app/AppShell.tsx
git commit -m "feat: selection bar with synced DSL input and chips"
```

---

### Task 5: Left rail (searchable, virtualized table list)

**Files:**
- Create: `src/app/LeftRail.tsx`
- Modify: `src/app/AppShell.tsx` (mount in the rail slot)
- Test (visual): Playwright screenshot

**Interfaces:**
- Consumes: `useAppStore` (model, selector, setSelector, savedMarts), `classifyTable` (Plan 3), `@tanstack/react-virtual`.
- Produces: `LeftRail()` — a search input filtering tables by name; a virtualized flat list of tables (grouped visually by `model.groups`, each row shows a fact/dim glyph from `classifyTable` and the table's last-segment name); clicking a row appends its last-segment name to the selector (space-joined union); a "Saved marts" section listing `savedMarts` (click → `setSelector(mart.selector)`). Matches the mockup's `.rail` styling.

- [ ] **Step 1: Install react-virtual**

```bash
bun add @tanstack/react-virtual
```

- [ ] **Step 2: Write `LeftRail.tsx`**

```tsx
// src/app/LeftRail.tsx
import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '@/app/store';
import { classifyTable } from '@/canvas/classifyTable';

export function LeftRail() {
  const model = useAppStore((s) => s.model);
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);
  const savedMarts = useAppStore((s) => s.savedMarts);
  const [query, setQuery] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  const tables = useMemo(() => {
    if (!model) return [];
    const all = [...model.tables.keys()].sort();
    const q = query.toLowerCase();
    return all.filter((name) => name.toLowerCase().includes(q));
  }, [model, query]);

  const virtualizer = useVirtualizer({
    count: tables.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 12,
  });

  const addToSelector = (name: string) => {
    const seg = name.split('.').pop() ?? name;
    setSelector(selector ? `${selector} ${seg}` : seg);
  };

  return (
    <div className="flex flex-col h-full">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${model?.tables.size ?? 0} tables…`}
        className="m-3 h-[34px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[13px] text-[var(--ink-2)] outline-none"
      />
      {savedMarts.length > 0 && (
        <div className="px-3 pb-2">
          <div className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mb-1">Saved marts</div>
          {savedMarts.map((m) => (
            <button key={m.name} onClick={() => setSelector(m.selector)} className="block w-full text-left text-[12.5px] text-[var(--dim)] py-1 truncate">★ {m.name}</button>
          ))}
        </div>
      )}
      <div ref={parentRef} className="flex-1 overflow-auto px-2 pb-3">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const name = tables[vi.index];
            const kind = classifyTable(name);
            return (
              <button
                key={name}
                onClick={() => addToSelector(name)}
                className="absolute top-0 left-0 w-full flex items-center gap-2 px-2 rounded-md text-[12.5px] font-[\"Spline_Sans_Mono\",monospace] text-[var(--ink-2)] hover:bg-[var(--panel-2)]"
                style={{ height: 28, transform: `translateY(${vi.start}px)` }}
              >
                <span
                  className="grid place-items-center w-[15px] h-[15px] rounded text-[9px] font-bold"
                  style={{
                    color: kind === 'fact' ? 'var(--fact)' : kind === 'dim' ? 'var(--dim)' : 'var(--ink-3)',
                    background: kind === 'fact' ? 'var(--fact-dim)' : kind === 'dim' ? 'var(--dim-dim)' : 'transparent',
                  }}
                >
                  {kind === 'fact' ? 'f' : kind === 'dim' ? 'd' : '·'}
                </span>
                <span className="truncate">{name.split('.').pop()}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Mount in `AppShell.tsx`**

```tsx
import { LeftRail } from '@/app/LeftRail';
// replace the rail <aside/> body:
<aside className="border-r border-[var(--line)] bg-[var(--panel)] overflow-hidden"><LeftRail /></aside>
```

- [ ] **Step 4: Screenshot-verify**

Run dev server; with Playwright: confirm the rail lists tables with fact/dim glyphs; type in search and confirm filtering; click a table row and confirm the selector + canvas update. Screenshot. Stop server.

- [ ] **Step 5: Build, commit**

Run: `bun run test && bun run build`

```bash
git add src/app/LeftRail.tsx src/app/AppShell.tsx package.json bun.lock
git commit -m "feat: searchable virtualized left rail with fact/dim hints and saved marts"
```

---

### Task 6: Inspector (table detail + clickable refs)

**Files:**
- Create: `src/app/Inspector.tsx`
- Modify: `src/app/AppShell.tsx` (mount in the inspector slot)
- Test (visual): Playwright screenshot

**Interfaces:**
- Consumes: `useAppStore` (model, selectedTable, selector, setSelector), `classifyTable` (Plan 3).
- Produces: `Inspector()` — when `selectedTable` is set, shows its kind eyebrow, name, schema, counts (columns, FK, PK), and two ref lists: **outbound** (refs where `fromTable === selectedTable`, "→ target") and **inbound** (refs where `toTable === selectedTable`, "← source"). Each ref row is clickable → appends the other table's last-segment to the selector. Empty state ("Select a table") when none selected. Matches the mockup's `.inspector` styling.

- [ ] **Step 1: Write `Inspector.tsx`**

```tsx
// src/app/Inspector.tsx
import { useAppStore } from '@/app/store';
import { classifyTable } from '@/canvas/classifyTable';

const seg = (name: string) => name.split('.').pop() ?? name;

export function Inspector() {
  const model = useAppStore((s) => s.model);
  const selectedTable = useAppStore((s) => s.selectedTable);
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);

  if (!model || !selectedTable) {
    return <div className="p-4 text-[12.5px] text-[var(--ink-3)]">Select a table to inspect.</div>;
  }
  const table = model.tables.get(selectedTable);
  if (!table) return <div className="p-4 text-[12.5px] text-[var(--ink-3)]">Unknown table.</div>;

  const kind = classifyTable(selectedTable);
  const outbound = model.refs.filter((r) => r.fromTable === selectedTable);
  const inbound = model.refs.filter((r) => r.toTable === selectedTable);
  const add = (name: string) => setSelector(selector ? `${selector} ${seg(name)}` : seg(name));

  return (
    <div className="p-4">
      <div className="text-[10px] uppercase tracking-widest text-[var(--ink-3)]">{kind} table</div>
      <div className="font-[\"Spline_Sans_Mono\",monospace] text-[14px] text-[var(--ink)] mt-1.5">{seg(selectedTable)}</div>
      <div className="text-[11.5px] text-[var(--ink-3)] mb-3.5">{table.group ?? 'ungrouped'}</div>

      <Row k="Columns" v={String(table.columns.length)} />
      <Row k="Foreign keys" v={String(outbound.length)} />
      <Row k="Primary key" v={table.columns.some((c) => c.isPrimaryKey) ? '✓' : '—'} />

      {outbound.length > 0 && <RefList title="References (toward dims)" arrow="→" refs={outbound.map((r) => r.toTable)} onClick={add} />}
      {inbound.length > 0 && <RefList title="Referenced by (toward facts)" arrow="←" refs={inbound.map((r) => r.fromTable)} onClick={add} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-[var(--line)] text-[12.5px]">
      <span className="text-[var(--ink-3)]">{k}</span>
      <span className="text-[var(--ink-2)] font-[\"Spline_Sans_Mono\",monospace]">{v}</span>
    </div>
  );
}

function RefList({ title, arrow, refs, onClick }: { title: string; arrow: string; refs: string[]; onClick: (n: string) => void }) {
  return (
    <div className="mt-3.5">
      <h4 className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mb-2">{title}</h4>
      {refs.map((name, i) => (
        <button key={`${name}-${i}`} onClick={() => onClick(name)} className="flex items-center gap-2 w-full text-left font-[\"Spline_Sans_Mono\",monospace] text-[12px] text-[var(--ink-2)] py-1.5 px-2 rounded-md hover:bg-[var(--panel-2)]">
          <span className="text-[var(--fact)]">{arrow}</span>
          <span className="truncate">{name.split('.').pop()}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Mount in `AppShell.tsx`**

```tsx
import { Inspector } from '@/app/Inspector';
// replace the inspector <aside/> body:
<aside className="border-l border-[var(--line)] bg-[var(--panel)] overflow-auto"><Inspector /></aside>
```

- [ ] **Step 3: Wire node-click → setSelectedTable**

In `AppShell.tsx`, pass an `onTableClick` through to the canvas. `CanvasApp`/`Canvas` already has `onNodeClick`; extend its props with `onTableSelect?(name)` and call it when a clicked node `type === 'table'`. Update `Canvas.tsx` `onNodeClick`:

```tsx
onNodeClick={(_, node) => {
  if (node.type === 'group') onSelectorChange?.(`group:${(node.data as { name: string }).name}`);
  else if (node.type === 'table') onTableSelect?.((node.data as { name: string }).name);
}}
```

Add `onTableSelect?: (name: string) => void` to `Canvas`/`CanvasApp` props, and in `AppShell` pass `onTableSelect={useAppStore.getState().setSelectedTable}` (or via a selector hook).

- [ ] **Step 4: Screenshot-verify**

Run dev server; navigate to a table view (`?s=group%3Ashop.inventory` or click a group), click a table node, and confirm the inspector shows its details + ref lists. Click an inbound/outbound ref and confirm the selector extends. Screenshot. Stop server.

- [ ] **Step 5: Run full suite + build, commit**

Run: `bun run test && bun run build`
Expected: all tests pass; build clean.

```bash
git add src/app/Inspector.tsx src/app/AppShell.tsx src/canvas/Canvas.tsx
git commit -m "feat: table inspector with clickable inbound/outbound refs"
```

---

## Self-Review

**Spec coverage (shell slice):**
- Four-region layout (top bar, left rail, canvas, inspector) → Task 3. ✓
- Synced selection bar (DSL input + chips + save mart) → Task 4. ✓
- Searchable, virtualized left rail with fact/dim hints + saved marts → Task 5. ✓
- Inspector (columns/refs, clickable refs extend selection) → Task 6. ✓
- Selector as single source of truth across rail/bar/inspector/canvas/URL → Tasks 1, 3–6. ✓
- URL (`?s=`) shareable + localStorage saved marts → Task 2. ✓
- Node click selects table for inspector → Task 6 step 3. ✓
- Reuse Plan 1/2/3 (no re-parsing/re-classifying) → Global Constraints. ✓
- Deferred to Plan 5 (not gaps): file loading (upload/paste/drag), baked-in DBML, node-count guardrail, Docker, `index.html` title, cosmetic mockup deltas.

**Placeholder scan:** No TBD/TODO. Logic tasks (1–2) have complete TDD code; visual tasks (3–6) have complete component code + Playwright screenshot gates.

**Type consistency:** `SavedMart`/`AppState`/`useAppStore` (Task 1) consumed by Tasks 2–6. Persistence functions (Task 2) consumed by `usePersistence`. `CanvasApp` prop extension (`onTableSelect`) added in Task 6 is consistent with the Plan 3 `Canvas` signature. `classifyTable` (Plan 3) reused in Tasks 5–6. `parseSelector` (Plan 2) reused in Task 4.
