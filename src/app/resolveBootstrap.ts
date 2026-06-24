import type { DbEntry } from '@/app/bakedManifest';

export type BootstrapDecision =
  | { kind: 'fallback' }
  | { kind: 'load'; entry: DbEntry }
  | { kind: 'chooser' };

// Decide what to do on startup given the baked databases and the URL's ?db.
//   none      -> fallback (default.dbml / built-in sample)
//   exactly 1 -> load it
//   2+        -> load the ?db match if any, otherwise show the chooser
export function resolveBootstrap(databases: DbEntry[], dbParam: string | null): BootstrapDecision {
  if (databases.length === 0) return { kind: 'fallback' };
  if (databases.length === 1) return { kind: 'load', entry: databases[0] };

  const match = dbParam ? databases.find((d) => d.id === dbParam) : undefined;
  return match ? { kind: 'load', entry: match } : { kind: 'chooser' };
}
