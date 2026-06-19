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
