# Multiple baked databases with a chooser

## Summary

Today the Docker image bakes exactly one DBML file (`/dbml/default.dbml`),
auto-loaded on startup. This feature lets one image bake **N** DBML files and
lets the user pick which database to start the analysis on — so a single image
can ship more than one database.

Databases are **separate**: one active `model` at a time, switchable, with no
cross-database edges.

## Decisions

- **Separate, switch between.** One active database at a time. No cross-DB
  references, no merged graph. Switching reloads the whole model.
- **Chooser screen when 2+.** With 2+ baked databases, show a "pick a database"
  screen before any graph loads. With exactly 1, auto-load it (no chooser). With
  0, fall back to the built-in sample (unchanged).
- **Filename-only labels.** The author runs `just build a.dbml b.dbml c.dbml`.
  The bake step auto-generates a manifest from the filenames; the chooser
  prettifies each filename. No extra authoring, no per-database descriptions or
  table counts.
- **Database in the URL.** The active database is encoded as `?db=<id>` next to
  the existing `?s=<selector>`. A shared link reopens that database and
  selection and skips the chooser.

## The manifest

A static nginx server cannot list a directory, so the bake step writes
`/dbml/manifest.json` as the single source of truth for what is available:

```json
{
  "databases": [
    { "id": "warehouse_prod", "label": "warehouse prod", "file": "warehouse_prod.dbml" },
    { "id": "analytics",      "label": "analytics",      "file": "analytics.dbml" }
  ]
}
```

- `id` — filename without extension; used in the URL (`?db=warehouse_prod`).
- `label` — prettified `id` (underscores/dashes → spaces) shown in the chooser.
- `file` — path under `/dbml/` to fetch when the database is selected.

`id` values are unique by construction (files share one staging directory).

## Bake-time changes

### `justfile`

`build` becomes variadic — `build *files`:

- For each file: verify it exists, copy it into `docker/baked/`.
- Generate `docker/baked/manifest.json` from the staged filenames.
- `trap` cleans up the staged `.dbml` copies and `manifest.json` on exit (as the
  current recipe already does for the single file).
- `just build` with no files behaves as today (no baked schema).

### `Dockerfile`

The final layer copies the whole `docker/baked/` directory into `/dbml/`
(instead of one build-arg file), so the `.dbml` files and `manifest.json` land
together. It remains the last layer, so swapping schemas rebuilds only it.

## Runtime data flow

A new `bakedManifest.ts` owns fetching and validating the manifest.
`bootstrap.ts` orchestrates resolution:

1. Fetch `/dbml/manifest.json`.
   - **Absent / 404 / malformed** → existing fallback chain, unchanged: try
     `/dbml/default.dbml`, else the built-in sample. This keeps the published
     image and any old single-file bakes working exactly as today.
   - **1 entry** → fetch its file, `loadDbml`, set `?db` in the URL.
   - **2+ entries** →
     - if `?db=<id>` matches a manifest entry → fetch and load it directly,
       skipping the chooser;
     - otherwise → show the chooser.

After the model loads, the existing selector-from-URL logic applies as today.

## Store and UI

### Store (`store.ts`)

New state:

- `databases: DbEntry[] | null` — manifest entries (null until resolved / when
  none baked).
- `activeDb: string | null` — id of the currently loaded database.

New action:

- `selectDatabase(id)` — fetch the entry's file → `loadDbml(content)` (which
  already resets `selector`, `selectedTable`, `pathMode`, `pathStart`) → set
  `activeDb` and update the URL `?db`.

Chooser visibility is **derived**, not stored:
`databases !== null && databases.length > 1 && activeDb === null`.

### UI

- **`DatabaseChooser`** — a full-pane screen listing the databases as buttons
  (prettified labels). Rendered by `AppShell` when chooser visibility is true.
- **Switching** — the active database name shows in the toolbar; clicking it
  clears `activeDb`, which re-shows the same chooser screen. No separate
  dropdown widget.
- Switching to another database clears the selector (a selection is meaningless
  in a different database) and rewrites the URL to the new `?db` with no `s`.

## Persistence (`persistence.ts`)

Extend to read/write `db` alongside `s`:

- `dbFromSearch(search): string | null`
- `searchWith({ db, selector }): string` — builds the query string with both
  params (omitting empties).

`usePersistence` keeps the URL in sync on both database switch (`activeDb`
change) and selector change.

## Testing

- **`bakedManifest`** — parse/validate: well-formed JSON, malformed JSON, empty
  `databases`, missing fields.
- **`bootstrap`** — resolution matrix: 0 / 1 / 2+ entries, each with and without
  a matching `?db`, plus the 404 → `default.dbml` → sample fallback.
- **`persistence`** — round-trip `db` + `s` (both present, each alone, neither).
- **store `selectDatabase`** — loads the file and resets the selection state.

## Out of scope (YAGNI)

- Cross-database references or a merged multi-database view.
- Per-database descriptions, table counts, or any richer manifest metadata.
- Multiple-file **upload** via the Load button — the existing single-file upload
  flow is untouched. This feature is bake-time only.
