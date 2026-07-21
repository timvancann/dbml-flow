#!/usr/bin/env bash
# Stage the demo databases (shop, pokemon) into TARGET_DIR, along with the
# manifest and shop's dbt lineage manifest. Used by both `bun run dev`
# (predev, staging into public/dbml) and the Pages deploy workflow (staging
# into dist/dbml) so dev and prod serve identical demo content.
set -euo pipefail

TARGET_DIR="$1"

mkdir -p "$TARGET_DIR"
cp examples/shop.dbml "$TARGET_DIR/shop.dbml"
cp examples/pokemon.dbml "$TARGET_DIR/pokemon.dbml"
cp examples/shop.dbt-manifest.json "$TARGET_DIR/shop.dbml.dbt-manifest.json"
printf '{"databases":[{"file":"shop.dbml"},{"file":"pokemon.dbml"}]}\n' > "$TARGET_DIR/manifest.json"
