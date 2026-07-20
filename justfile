# DBML Flow — task runner (https://github.com/casey/just)
# Run `just` to list recipes.

set shell := ["bash", "-cu"]

image := "dbml-flow"
port := "8080"

# List available recipes
default:
    @just --list

# Boot the Vite dev server
dev:
    bun run dev

# Install pre-commit hooks (pre-commit + commit-msg, for commitizen)
hooks:
    pre-commit install --hook-type pre-commit --hook-type commit-msg

# Build the Docker image. Optionally bake one or more DBML files:
#   just build                              # no baked schema (app shows the sample)
#   just build warehouse.dbml               # one db → auto-loads on startup
#   just build warehouse.dbml pokemon.dbml  # 2+ dbs → app shows a chooser
build *files:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{files}}" ]; then
        docker build -t {{image}} .
        exit 0
    fi
    rm -f docker/baked/*.dbml docker/baked/manifest.json
    trap 'rm -f docker/baked/*.dbml docker/baked/manifest.json' EXIT
    entries=()
    for f in {{files}}; do
        if [ ! -f "$f" ]; then echo "no such file: $f" >&2; exit 1; fi
        base="$(basename "$f")"
        cp "$f" "docker/baked/$base"
        entries+=("{\"file\":\"$base\"}")
    done
    printf '{"databases":[%s]}\n' "$(IFS=,; echo "${entries[*]}")" > docker/baked/manifest.json
    echo "Baking ${#entries[@]} database(s) → /dbml/ (last image layer)…"
    docker build -t {{image}} .

# Build (optionally baking FILES), then run the container on :{{port}}
run *files: (build files)
    docker run --rm -p {{port}}:80 {{image}}
