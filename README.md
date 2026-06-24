<div align="center">

![DBML Flow](docs/assets/wordmark.png)

### [▶ Live demo](https://timvancann.github.io/dbml-flow/)

</div>

A next-gen, **read-only** visualizer for the [DBML](https://dbml.dbdiagram.io/) standard,
built for exploring large, generated data-warehouse schemas (e.g.
[dbterd](https://github.com/datnguye/dbterd) output) with speed and clarity.

The point isn't to draw every table at once — it's **fast, surgical navigation of huge
foreign-key graphs**: "what tables and relationships make up this data mart, and how are
they connected?"

## Features

- **Schema overview** — a model opens as group super-nodes (with table/ref counts), not a
  hairball. Click a group to drill into its tables.
- **Selector grammar** — the canvas only ever renders a selected subgraph, driven by one
  dbt-style selector string (shareable via URL). It's a small, composable language for
  **selecting** tables and groups, **hiding/excluding** the noise, **traversing**
  relationships (directional or undirected, by hop distance), and **finding the route**
  between two tables. Combine operators freely — union, intersect, exclude, expand:

  | Syntax | Meaning |
  |---|---|
  | `d_customer` | one table (full name or last-segment) |
  | `a b` | union (whitespace) |
  | `a,b` | intersection (no spaces) |
  | `!x` / `--exclude x` | exclude |
  | `~a` / `~2a` | undirected neighbors within 1 / 2 hops |
  | `+a` / `a+` | directional: toward-facts / toward-dimensions |
  | `group:sales` / `g:sales_*` | a group / group glob |
  | `*order*` | table-name glob |
  | `path:a>b` | shortest FK path between two tables |

- **Click-to-focus + hop stepper** — click any table to see it plus its in/out neighbors;
  step the hop distance up/down live.
- **Path finding** — "Find path", pick two tables, and the shortest reference path renders.
- **Inspector** — the selected table's columns and foreign keys in collapsible lists;
  click a ref to extend the selection.
- **Fact/dimension coding** — facts amber, dimensions cyan, FK ports and PK badges, with an
  elk crossing-minimized layout.
- **Bring your own schema** — upload a `.dbml` file in-app, or bake one or more into the
  Docker image (below); with several baked, the app opens a picker to choose a database. The
  current database and selector persist in the URL, so a view is just a link you can share.

The bundled demo data is a small synthetic `shop` schema. No real data ships in the repo.

## Quick start

Uses [Bun](https://bun.sh) and (optionally) [`just`](https://github.com/casey/just).

```bash
bun install
just dev          # or: bun run dev   → http://localhost:5173
```

## Tasks (`just`)

```bash
just dev                          # boot the Vite dev server
just build                        # build the Docker image (no baked schema)
just build schema.dbml            # bake one schema that auto-loads on startup
just build a.dbml b.dbml          # bake several; the app shows a picker on startup
just run                          # build, then run the container on :8080
just run schema.dbml              # build with that schema baked in, then run
```

## Run with Docker

A prebuilt image is published to GitHub Container Registry, so you can run the app — and
point it at your own schema — without cloning the repo or building anything.

### Use the published image (no clone, no build)

Mount your `.dbml` over the served path; it auto-loads on startup. Nothing is rebuilt — it's
a plain `docker run`:

```bash
docker run -p 8080:80 \
  -v "$(pwd)/your-schema.dbml:/usr/share/nginx/html/dbml/default.dbml:ro" \
  ghcr.io/timvancann/dbml-flow:latest
# → http://localhost:8080
```

With no mount, the image serves the built-in synthetic sample.

### Extend the image (bake your schema into your own image)

To ship an immutable image (e.g. for your own deploy), extend the published one with a
one-line `Dockerfile` — a single `COPY` layer, no app rebuild:

```dockerfile
FROM ghcr.io/timvancann/dbml-flow:latest
COPY your-schema.dbml /usr/share/nginx/html/dbml/default.dbml
```

```bash
docker build -t my-dbml-flow . && docker run -p 8080:80 my-dbml-flow
```

### Build it yourself from source

```bash
just run                 # → http://localhost:8080  (built-in sample)
# or manually:
docker build -t dbml-flow .
docker run -p 8080:80 dbml-flow
```

### Bake one or more schemas (optional)

To auto-load your own schema on startup, pass it to `just build`/`just run`:

```bash
just run output.grouped.dbml
```

Pass **several** files to ship more than one database in a single image. With 2+ baked,
the app opens a picker so you choose which database to start on (and switch later); with
exactly one, it loads straight in:

```bash
just run output.grouped.dbml examples/pokemon.dbml
```

Under the hood this stages the files into `docker/baked/`, generates a `manifest.json`
describing them, and copies that directory in as the **absolute last image layer** — so
swapping schemas only rebuilds that one layer (`bun install` and the Vite build stay
cached). With no baked file, there's no manifest, so the app serves the synthetic sample
(the served `/dbml/manifest.json` simply 404s and the app falls back). The chosen database
is encoded in the URL (`?db=…`) alongside the selector, so a shared link reopens the same
database and view.

## Tech stack

Bun + Vite + React + TypeScript · [`@xyflow/react`](https://reactflow.dev) + elkjs (canvas
& layout) · Zustand (state) · [`@dbml/core`](https://www.npmjs.com/package/@dbml/core)
(parsing) · Tailwind + shadcn/ui · Vitest + Playwright (tests) · nginx (container).

## Development

```bash
bun run test      # unit tests (Vitest)
bun run build     # type-check (tsc) + production build (Vite)
```

## Credits & inspiration

DBML Flow stands on the shoulders of some great tools — its niche is the gap between
them: **exploring** a generated schema, almost like a data catalog, but from a single
static DBML file with no database connection and no backend.

- **[Azimutt](https://azimutt.app/)** — the big inspiration for *don't draw the whole
  schema; build focused views of large databases*. DBML Flow is the lightweight take:
  DBML in, exploration out — no database connections, no accounts, no server.
- **[dbterd](https://github.com/datnguye/dbterd)** — generates DBML straight from a dbt
  catalog, which is what makes DBML Flow useful for analytics engineers in the first place.
- **[dbdiagram](https://dbdiagram.io/), [dbdocs](https://dbdocs.io/),
  [DrawSQL](https://drawsql.app/), [drawDB](https://drawdb.app/),
  [ChartDB](https://chartdb.io/)** — excellent for *designing and generating* schemas.
  DBML Flow deliberately goes the other way: you generate once, then explore.

## License

[MIT](LICENSE) © Tim van Cann
