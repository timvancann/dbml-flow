# DBML Flow — Delivery (Docker + baked DBML) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Ship the static SPA as a Docker image that optionally **bakes in a `.dbml` auto-loaded on startup**, where the baked file is the **absolute last image layer** (so swapping it never recomputes the build).

**Architecture:** On startup the app tries to `fetch` a runtime baked file (`<base>dbml/default.dbml`); if present it loads it, else it falls back to the built-in synthetic sample. Docker is multi-stage (bun build → nginx serve); the build stage copies only build inputs (NOT the baked dir, so build cache is stable), and the final instruction copies the optional baked file.

**Tech Stack:** Bun, Vite, nginx (serve), Docker. Consumes `@/app/store` (`loadDbmlSafe`), `@/app/persistence`.

## Global Constraints
- Baked file is **optional**: no file → app shows the synthetic sample (current default). The fetch must fail gracefully (404, network error, or an SPA-fallback HTML response must all be treated as "no baked file").
- **Layer discipline:** the baked-file `COPY` is the LAST Dockerfile instruction; no earlier layer (deps install, vite build, dist copy, nginx conf) may depend on the baked file's contents.
- Preserve URL `?s=` selector hydration on startup (don't regress the shareable-link behavior).
- Work on `main`. Run `bun run test` AND `bun run build` before each commit. Conventional commits.

---

### Task 1: Optional baked-DBML on startup

**Files:**
- Create: `src/app/bootstrap.ts`
- Create: `src/app/bootstrap.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `loadDbmlSafe` + `setSelector` via `useAppStore`; `selectorFromSearch` (`@/app/persistence`).
- Produces:
  - `looksLikeDbml(text: string): boolean` — pure guard: true for non-empty text that does NOT start (after trimStart) with `<` (i.e. not an SPA-fallback HTML page) and contains `Table ` or `Ref:` or `TableGroup `. (Conservative: reject HTML, accept plausible DBML.)
  - `BAKED_DBML_URL` — `` `${import.meta.env.BASE_URL}dbml/default.dbml` ``.
  - `fetchBakedDbml(): Promise<string | null>` — `fetch(BAKED_DBML_URL, {cache:'no-store'})`; return the text iff `res.ok && looksLikeDbml(text)`, else null; never throws.
  - `bootstrap(search: string, fallback: string): Promise<void>` — `const baked = await fetchBakedDbml(); const content = baked ?? fallback; useAppStore.getState().loadDbmlSafe(content); const sel = selectorFromSearch(search); if (sel) useAppStore.getState().setSelector(sel);`

- [ ] **Step 1 — TDD `looksLikeDbml`** (`bootstrap.test.ts`):

```ts
import { looksLikeDbml } from '@/app/bootstrap';
describe('looksLikeDbml', () => {
  it('accepts plausible dbml', () => {
    expect(looksLikeDbml('Table "x" {\n}')).toBe(true);
    expect(looksLikeDbml('//c\nRef: "a"."x" > "b"."y"')).toBe(true);
  });
  it('rejects empty and HTML (SPA fallback)', () => {
    expect(looksLikeDbml('')).toBe(false);
    expect(looksLikeDbml('  ')).toBe(false);
    expect(looksLikeDbml('<!doctype html><html>...')).toBe(false);
  });
});
```

- [ ] **Step 2 — Run → FAIL** (`bunx vitest run src/app/bootstrap.test.ts`)

- [ ] **Step 3 — Implement `bootstrap.ts`** per the Interfaces above.

- [ ] **Step 4 — Run → PASS**

- [ ] **Step 5 — Wire `App.tsx`** to call bootstrap (replacing the synchronous `initStore` call):

```tsx
import { useEffect } from 'react';
import rawDbml from '@/model/__fixtures__/grouped.dbml?raw';
import { usePersistence } from '@/app/usePersistence';
import { bootstrap } from '@/app/bootstrap';
import { AppShell } from '@/app/AppShell';

export default function App() {
  usePersistence();
  useEffect(() => {
    void bootstrap(window.location.search, rawDbml);
  }, []);
  return <AppShell />;
}
```

(Leave `initStore.ts` in place — bootstrap supersedes its use in App; the initStore regression test still guards the ordering logic that bootstrap mirrors. Optionally have bootstrap reuse initStore's capture-before-load ordering — but bootstrap reads `search` before the async load, so the order is already correct.)

- [ ] **Step 6 — Verify:** `bun run test` (+2 bootstrap tests) AND `bun run build` clean. Quick dev check optional (no baked file in dev → app shows synthetic sample exactly as before; URL `?s=` still works).

- [ ] **Step 7 — Commit:** `feat: optionally load a baked DBML on startup, fallback to sample`

---

### Task 2: Dockerfile + nginx + baked-file last layer

**Files:**
- Create: `Dockerfile`
- Create: `docker/nginx.conf`
- Create: `docker/baked/.gitkeep`
- Create: `.dockerignore`
- Modify: `README.md` (add a short "Run with Docker" section) — create `README.md` if absent.

**Interfaces / required content:**

- [ ] **Step 1 — `.dockerignore`** (keep the build context small + stable; do NOT ignore `docker/baked`):

```
node_modules
dist
.git
.superpowers
coverage
output*.dbml
*.local
.playwright-mcp
```

- [ ] **Step 2 — `docker/nginx.conf`** — SPA fallback, but `/dbml/` returns 404 when the baked file is absent (so the app's fetch guard sees a real 404, not index.html):

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Baked DBML (optional): real 404 when absent, never SPA-fallback.
  location /dbml/ {
    try_files $uri =404;
  }

  # SPA fallback for everything else.
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 3 — `Dockerfile`** — multi-stage; build stage copies only build inputs (NOT `docker/baked`); baked `COPY` is the final instruction:

```dockerfile
# ---- build ----
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts components.json index.html ./
COPY src ./src
COPY public ./public
RUN bun run build

# ---- serve ----
FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# ABSOLUTE LAST LAYER — optional baked DBML. Drop a file at docker/baked/default.dbml
# to bake it in; swapping it only rebuilds this one layer.
COPY docker/baked/ /usr/share/nginx/html/dbml/
```

(If any `tsconfig.*.json` filename differs, adjust the COPY to the actual files — verify against the repo before building. The `.gitkeep` in `docker/baked/` ensures the directory exists so the final COPY succeeds with no baked file.)

- [ ] **Step 4 — `docker/baked/.gitkeep`** — empty file so the dir is tracked and the final COPY always works.

- [ ] **Step 5 — Build & verify (Docker daemon is available):**

```bash
docker build -t dbml-flow:test .
# run without a baked file → synthetic sample; confirm it serves
docker run -d --rm -p 8088:80 --name dbmlflow-test dbml-flow:test
sleep 2
curl -sf http://localhost:8088/ | grep -qi 'dbml' && echo "serves index OK"
curl -s -o /dev/null -w '%{http_code}' http://localhost:8088/dbml/default.dbml   # expect 404 (no baked file)
docker rm -f dbmlflow-test
```

Then verify the **last-layer** discipline: drop a small `.dbml` into `docker/baked/default.dbml`, rebuild, and confirm Docker reuses the cached build/install/dist layers and only re-runs the final `COPY docker/baked/` layer (look for `CACHED` on the install + build steps in the build output). Confirm `curl http://localhost:8088/dbml/default.dbml` then returns the file (200). Remove the test baked file afterward (leave only `.gitkeep`). Record the build output evidence (CACHED lines) in the report.

- [ ] **Step 6 — `README.md`** — short "Run with Docker" section: `docker build -t dbml-flow .`, `docker run -p 8080:80 dbml-flow`; and "to bake a default schema, put it at `docker/baked/default.dbml` before building (it auto-loads on startup; it's the last image layer so rebuilds are fast)."

- [ ] **Step 7 — Commit:** `feat: Dockerfile serving the SPA with an optional last-layer baked DBML`

---

## Self-Review
- Optional baked DBML auto-loaded on startup, graceful fallback to the synthetic sample → Task 1. Baked file is the absolute last Docker layer, build cache stable on swap → Task 2 (verified via CACHED build output). URL `?s=` hydration preserved (bootstrap reads search before load). nginx `/dbml/` returns real 404 so the fetch guard works. No real data in the image unless the operator deliberately bakes it.
