import { resolveBootstrap } from '@/app/resolveBootstrap';
import type { DbEntry } from '@/app/bakedManifest';

const a: DbEntry = { id: 'a', label: 'a', file: 'a.dbml' };
const b: DbEntry = { id: 'b', label: 'b', file: 'b.dbml' };

describe('resolveBootstrap', () => {
  it('falls back when nothing is baked', () => {
    expect(resolveBootstrap([], null)).toEqual({ kind: 'fallback' });
  });

  it('loads the only database directly', () => {
    expect(resolveBootstrap([a], null)).toEqual({ kind: 'load', entry: a });
    // a stale ?db is ignored when there is only one
    expect(resolveBootstrap([a], 'nope')).toEqual({ kind: 'load', entry: a });
  });

  it('shows the chooser with 2+ databases and no matching ?db', () => {
    expect(resolveBootstrap([a, b], null)).toEqual({ kind: 'chooser' });
    expect(resolveBootstrap([a, b], 'unknown')).toEqual({ kind: 'chooser' });
  });

  it('loads the matching ?db directly, skipping the chooser', () => {
    expect(resolveBootstrap([a, b], 'b')).toEqual({ kind: 'load', entry: b });
  });
});
