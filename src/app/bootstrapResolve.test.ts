import { afterEach, vi } from 'vitest';
import { bootstrap } from '@/app/bootstrap';
import { useAppStore } from '@/app/store';

const DB = 'Table "t" {\n  id int\n}';
const SAMPLE = 'Table "sample" {\n  id int\n}';

// Map a request URL (or its tail) to a fake Response.
function stubFetch(routes: Record<string, { ok: boolean; body?: string }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const hit = Object.entries(routes).find(([k]) => url.endsWith(k));
      const r = hit?.[1] ?? { ok: false };
      return {
        ok: r.ok,
        async text() {
          return r.body ?? '';
        },
        async json() {
          return JSON.parse(r.body ?? 'null');
        },
      } as Response;
    }),
  );
}

beforeEach(() => {
  useAppStore.setState({ model: null, selector: '', databases: null, activeDb: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('bootstrap (multi-database resolution)', () => {
  it('shows the chooser for 2+ databases with no ?db (records dbs, loads nothing)', async () => {
    stubFetch({
      'dbml/manifest.json': { ok: true, body: '{"databases":[{"file":"a.dbml"},{"file":"b.dbml"}]}' },
    });
    await bootstrap('', SAMPLE);
    expect(useAppStore.getState().databases?.map((d) => d.id)).toEqual(['a', 'b']);
    expect(useAppStore.getState().activeDb).toBeNull();
    expect(useAppStore.getState().model).toBeNull();
  });

  it('loads the ?db match directly, skipping the chooser', async () => {
    stubFetch({
      'dbml/manifest.json': { ok: true, body: '{"databases":[{"file":"a.dbml"},{"file":"b.dbml"}]}' },
      'dbml/b.dbml': { ok: true, body: DB },
    });
    await bootstrap('?db=b', SAMPLE);
    expect(useAppStore.getState().activeDb).toBe('b');
    expect(useAppStore.getState().model?.tables.size).toBe(1);
  });

  it('auto-loads the single baked database', async () => {
    stubFetch({
      'dbml/manifest.json': { ok: true, body: '{"databases":[{"file":"only.dbml"}]}' },
      'dbml/only.dbml': { ok: true, body: DB },
    });
    await bootstrap('', SAMPLE);
    expect(useAppStore.getState().activeDb).toBe('only');
    expect(useAppStore.getState().model?.tables.size).toBe(1);
  });

  it('falls back to the sample when no manifest is present', async () => {
    stubFetch({}); // every fetch 404s
    await bootstrap('', SAMPLE);
    expect(useAppStore.getState().databases).toEqual([]);
    expect(useAppStore.getState().activeDb).toBeNull();
    expect(useAppStore.getState().model?.tables.size).toBe(1);
  });
});
