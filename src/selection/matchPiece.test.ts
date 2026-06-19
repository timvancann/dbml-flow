import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { matchPiece } from '@/selection/matchPiece';

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
