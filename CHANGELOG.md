## v0.1.0 (2026-07-20)

### Feat

- cmd-k jumps to the 1-hop neighborhood of a table
- clear button on the selector input
- show picked start table in rail and canvas HUD during path mode
- theme-styled minimap on large graphs
- copy selection as DBML and export canvas as PNG
- Cmd-K quick-jump to a table
- recent-selector history dropdown (localStorage, cap 15)
- cardinality glyphs and aggregate counts on edges
- selector syntax/completions/help support for '.' collapse modifier (fixes leading-dot tokenizer hang)
- compact table cards, in-place group expand/collapse, selector-rewriting interactions
- unified mixed-detail flow builder; retire buildOverview
- resolveSelection returns detail levels (full/collapsed/superGroups)
- matchGroups helper returning group names for group pieces
- parse '.' collapse modifier on selector atoms
- load shop + pokemon on the live demo; docs + pointer cursor
- bake multiple databases with a chooser
- GitHub Pages deploy workflow + README wordmark hero & demo link
- substring (contains) autocomplete matching, prefix-ranked, no operator-prefix needed
- selector syntax highlighting + lint diagnostics in the input
- pure selector tokenizer + validator (syntax + reference diagnostics)
- help modal documenting the selector DSL and exploration
- Dagster-style autocompleting selector input (CodeMirror) replacing chips
- pure selector autocomplete completion logic
- justfile (dev/build/run) + Dockerfile BAKED_DBML arg for optional schema baking
- Dockerfile serving the SPA with an optional last-layer baked DBML
- optionally load a baked DBML on startup, fallback to sample

### Fix

- compact table nodes now clickable; drop cardinality on group-anchored edges
- clear PNG error state on successful retry
- surface copy/export failures on the HUD buttons
- expandGroup drops the collapsed dotted token on re-expand
- keep self-referencing FK edges, strengthen overview-parity test
- scope autocomplete to the atom after a comma

### Refactor

- remove saved data marts (view-only; URL sharing stays)
