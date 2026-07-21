import type { LineageEdge, Model } from '@/model/types';

interface DbtNodeMeta {
  name?: string;
  schema?: string;
  alias?: string;
}

export interface ParsedLineage {
  edges: LineageEdge[];
  matchedTables: Set<string>;
  unmatchedNodes: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asMetaRecord(v: unknown): Record<string, DbtNodeMeta> {
  return isRecord(v) ? (v as Record<string, DbtNodeMeta>) : {};
}

function asParentMap(v: unknown): Record<string, string[]> {
  if (!isRecord(v)) return {};
  const out: Record<string, string[]> = {};
  for (const [id, parents] of Object.entries(v)) {
    if (Array.isArray(parents)) out[id] = parents.filter((p): p is string => typeof p === 'string');
  }
  return out;
}

// Joins a dbt manifest against the loaded DBML model. Primary join: node id ==
// dbml table name exactly. Fallback (for robustness against differently-shaped
// manifests): schema.name, then bare name, matched uniquely against table names.
export function parseDbtManifest(json: unknown, model: Model): ParsedLineage {
  const manifest = isRecord(json) ? json : {};
  const parentMap = asParentMap(manifest.parent_map);
  const nodeMeta = { ...asMetaRecord(manifest.nodes), ...asMetaRecord(manifest.sources) };

  const byLastSegment = new Map<string, string[]>();
  const bySchemaName = new Map<string, string[]>();
  for (const tableName of model.tables.keys()) {
    const parts = tableName.split('.');
    const last = parts[parts.length - 1];
    const schemaName = parts.slice(-2).join('.');
    (byLastSegment.get(last) ?? byLastSegment.set(last, []).get(last)!).push(tableName);
    (bySchemaName.get(schemaName) ?? bySchemaName.set(schemaName, []).get(schemaName)!).push(tableName);
  }

  const resolved = new Map<string, string>();
  const unresolved = new Set<string>();

  function resolve(id: string): string | null {
    if (resolved.has(id)) return resolved.get(id)!;
    if (unresolved.has(id)) return null;

    if (model.tables.has(id)) {
      resolved.set(id, id);
      return id;
    }

    const meta = nodeMeta[id];
    const name = meta?.alias ?? meta?.name;
    if (meta?.schema && name) {
      const candidates = bySchemaName.get(`${meta.schema}.${name}`);
      if (candidates?.length === 1) {
        resolved.set(id, candidates[0]);
        return candidates[0];
      }
    }
    if (name) {
      const candidates = byLastSegment.get(name);
      if (candidates?.length === 1) {
        resolved.set(id, candidates[0]);
        return candidates[0];
      }
    }

    unresolved.add(id);
    return null;
  }

  const edges: LineageEdge[] = [];
  const seen = new Set<string>();
  for (const [id, parents] of Object.entries(parentMap)) {
    const toTable = resolve(id);
    for (const parentId of parents) {
      const fromTable = resolve(parentId);
      if (!toTable || !fromTable) continue;
      const key = `${fromTable}->${toTable}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ fromTable, toTable });
    }
  }

  return {
    edges,
    matchedTables: new Set(resolved.values()),
    unmatchedNodes: [...unresolved].sort(),
  };
}
