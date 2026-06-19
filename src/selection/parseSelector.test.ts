import { parseAtom, parseSelector } from '@/selection/parseSelector';

describe('parseAtom', () => {
  it('parses a bare piece as op none', () => {
    expect(parseAtom('d_x')).toEqual({ op: 'none', hops: 0, piece: 'd_x' });
  });
  it('parses prefix + as in, 1 hop', () => {
    expect(parseAtom('+d_x')).toEqual({ op: 'in', hops: 1, piece: 'd_x' });
  });
  it('parses N+ as in, N hops', () => {
    expect(parseAtom('2+d_x')).toEqual({ op: 'in', hops: 2, piece: 'd_x' });
  });
  it('parses suffix + as out, 1 hop', () => {
    expect(parseAtom('d_x+')).toEqual({ op: 'out', hops: 1, piece: 'd_x' });
  });
  it('parses +N suffix as out, N hops', () => {
    expect(parseAtom('d_x+3')).toEqual({ op: 'out', hops: 3, piece: 'd_x' });
  });
  it('parses ~ as both, 1 hop and ~N as both N', () => {
    expect(parseAtom('~d_x')).toEqual({ op: 'both', hops: 1, piece: 'd_x' });
    expect(parseAtom('~2d_x')).toEqual({ op: 'both', hops: 2, piece: 'd_x' });
  });
  it('keeps group: and glob pieces intact under operators', () => {
    expect(parseAtom('+group:sales')).toEqual({ op: 'in', hops: 1, piece: 'group:sales' });
    expect(parseAtom('g:*sales')).toEqual({ op: 'none', hops: 0, piece: 'g:*sales' });
  });
});

describe('parseSelector', () => {
  it('unions whitespace-separated terms', () => {
    expect(parseSelector('a b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a' }], [{ op: 'none', hops: 0, piece: 'b' }]],
      exclude: [],
    });
  });
  it('intersects comma-separated atoms within a term', () => {
    expect(parseSelector('a,b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a' }, { op: 'none', hops: 0, piece: 'b' }]],
      exclude: [],
    });
  });
  it('collects ! prefix as exclude', () => {
    expect(parseSelector('a !b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a' }]],
      exclude: [{ op: 'none', hops: 0, piece: 'b' }],
    });
  });
  it('collects --exclude <next> as exclude', () => {
    expect(parseSelector('a --exclude b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a' }]],
      exclude: [{ op: 'none', hops: 0, piece: 'b' }],
    });
  });
  it('returns empty AST for empty/whitespace input', () => {
    expect(parseSelector('   ')).toEqual({ include: [], exclude: [] });
  });
});
