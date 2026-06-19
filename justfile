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

# Build the Docker image. Optionally bake a DBML auto-loaded on startup:
#   just build                       # no baked schema (app shows the sample)
#   just build output.grouped.dbml   # bake this file in (last layer only rebuilds)
build file="":
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -n "{{file}}" ]; then
        if [ ! -f "{{file}}" ]; then echo "no such file: {{file}}" >&2; exit 1; fi
        echo "Baking {{file}} → /dbml/default.dbml (last image layer)…"
        cp "{{file}}" docker/baked/default.dbml
        trap 'rm -f docker/baked/default.dbml' EXIT
        docker build --build-arg BAKED_DBML=docker/baked/default.dbml -t {{image}} .
    else
        docker build -t {{image}} .
    fi

# Build (optionally baking FILE), then run the container on :{{port}}
run file="": (build file)
    docker run --rm -p {{port}}:80 {{image}}
