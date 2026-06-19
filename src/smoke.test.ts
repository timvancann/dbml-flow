// src/smoke.test.ts
import { readFileSync } from 'node:fs';

describe('scaffold smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });

  it('can read both fixtures with expected size', () => {
    const raw = readFileSync('src/model/__fixtures__/raw.dbml', 'utf8');
    const grouped = readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8');
    expect(raw).toContain('//--configured at schema:');
    expect(raw).not.toContain('TableGroup');
    expect(grouped).toContain('TableGroup');
  });
});
