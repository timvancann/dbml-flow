# dbml-flow

A DBML schema visualizer built with Bun + Vite + React.

## Run with Docker

**Build the image:**
```bash
docker build -t dbml-flow .
```

**Run the container:**
```bash
docker run -p 8080:80 dbml-flow
```

Then open [http://localhost:8080](http://localhost:8080). The app loads with a built-in synthetic sample schema.

**Bake a default schema (optional):**

To auto-load your own schema on startup, place a `.dbml` file at `docker/baked/default.dbml` before building:

```bash
cp your-schema.dbml docker/baked/default.dbml
docker build -t dbml-flow .
```

The baked file is the **last image layer**, so swapping it only rebuilds that one layer — install and build steps stay cached. Remove `docker/baked/default.dbml` to revert to the synthetic sample.

## Development

```bash
bun install
bun run dev
```

## Build

```bash
bun run build
```
