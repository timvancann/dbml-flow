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
# ABSOLUTE LAST LAYER — optional baked DBML, selected by a build arg.
# Default copies only docker/baked/.gitkeep (so /dbml/default.dbml is 404 → app uses the
# built-in sample). `just build <file>` stages the file as docker/baked/default.dbml and
# points BAKED_DBML at it, so it lands as /dbml/default.dbml and auto-loads on startup.
# Because this is the final layer, swapping the baked file only rebuilds this one layer.
ARG BAKED_DBML=docker/baked/.gitkeep
COPY ${BAKED_DBML} /usr/share/nginx/html/dbml/
