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
# ABSOLUTE LAST LAYER — optional baked DBML database(s).
# Default: docker/baked holds only .gitkeep, so /dbml/ has no manifest.json (404) and the
# app shows the built-in sample. `just build a.dbml b.dbml` stages the files plus a generated
# manifest.json into docker/baked/, which land in /dbml/ and drive auto-load (one file) or the
# chooser (2+). Because this is the final layer, swapping schemas rebuilds only this one layer.
COPY docker/baked/ /usr/share/nginx/html/dbml/
