import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { matchPiece, matchGroups } from '@/selection/matchPiece';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const FULL = 'model.shop.f_order';

describe('matchPiece', () => {
  it('matches an exact full table name', () => {
    expect([...matchPiece(model, FULL)]).toEqual([FULL]);
  });

  it('matches by last segment (convenience)', () => {
    expect([...matchPiece(model, 'f_order')]).toEqual([FULL]);
  });

  it('matches table names by glob', () => {
    const result = matchPiece(model, '*.f_*');
    expect(result.has('model.shop.f_order')).toBe(true);
    expect(result.has('model.shop.f_shipment')).toBe(true);
    expect(result.has('model.shop.d_customer')).toBe(false);
    expect(result.size).toBe(4);
  });

  it('matches a group by suffix name (group:)', () => {
    const result = matchPiece(model, 'group:sales');
    expect(result.has(FULL)).toBe(true);
    expect(result.has('model.shop.f_shipment')).toBe(true);
    expect(result.size).toBe(3);
  });

  it('matches groups by glob (g:)', () => {
    const result = matchPiece(model, 'g:*sales');
    expect(result.has(FULL)).toBe(true);
    expect(result.size).toBe(3);
  });

  it('returns empty set for an unknown piece', () => {
    expect(matchPiece(model, 'does_not_exist').size).toBe(0);
  });
});

describe('matchGroups', () => {
  it('matches an exact group name', () => {
    expect(matchGroups(model, 'group:shop.sales')).toEqual(
      new Set(['shop.sales'])
    );
  });

  it('matches group by last segment', () => {
    expect(matchGroups(model, 'group:sales')).toEqual(
      new Set(['shop.sales'])
    );
  });

  it('matches group globs', () => {
    expect(matchGroups(model, 'g:*')).toEqual(
      new Set(['shop.sales', 'shop.inventory', 'shop.people'])
    );
  });

  it('returns empty for table pieces', () => {
    expect(matchGroups(model, 'd_customer')).toEqual(new Set());
  });
});
