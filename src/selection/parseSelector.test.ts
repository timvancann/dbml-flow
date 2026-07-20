import { parseAtom, parseSelector } from '@/selection/parseSelector';

describe('parseAtom', () => {
  it('parses a bare piece as op none', () => {
    expect(parseAtom('d_x')).toEqual({ op: 'none', hops: 0, piece: 'd_x', collapsed: false });
  });
  it('parses prefix + as in, 1 hop', () => {
    expect(parseAtom('+d_x')).toEqual({ op: 'in', hops: 1, piece: 'd_x', collapsed: false });
  });
  it('parses N+ as in, N hops', () => {
    expect(parseAtom('2+d_x')).toEqual({ op: 'in', hops: 2, piece: 'd_x', collapsed: false });
  });
  it('parses suffix + as out, 1 hop', () => {
    expect(parseAtom('d_x+')).toEqual({ op: 'out', hops: 1, piece: 'd_x', collapsed: false });
  });
  it('parses +N suffix as out, N hops', () => {
    expect(parseAtom('d_x+3')).toEqual({ op: 'out', hops: 3, piece: 'd_x', collapsed: false });
  });
  it('parses ~ as both, 1 hop and ~N as both N', () => {
    expect(parseAtom('~d_x')).toEqual({ op: 'both', hops: 1, piece: 'd_x', collapsed: false });
    expect(parseAtom('~2d_x')).toEqual({ op: 'both', hops: 2, piece: 'd_x', collapsed: false });
  });
  it('keeps group: and glob pieces intact under operators', () => {
    expect(parseAtom('+group:sales')).toEqual({ op: 'in', hops: 1, piece: 'group:sales', collapsed: false });
    expect(parseAtom('g:*sales')).toEqual({ op: 'none', hops: 0, piece: 'g:*sales', collapsed: false });
  });
});

describe('collapse modifier', () => {
  it('parses a dotted table atom', () => {
    expect(parseAtom('.d_customer')).toEqual({ op: 'none', hops: 0, piece: 'd_customer', collapsed: true });
  });

  it('parses a dotted group atom', () => {
    expect(parseAtom('.g:*')).toEqual({ op: 'none', hops: 0, piece: 'g:*', collapsed: true });
    expect(parseAtom('.group:sales')).toEqual({ op: 'none', hops: 0, piece: 'group:sales', collapsed: true });
  });

  it('composes with traversal prefixes', () => {
    expect(parseAtom('.~2fact_orders')).toEqual({ op: 'both', hops: 2, piece: 'fact_orders', collapsed: true });
    expect(parseAtom('.fact_orders+')).toEqual({ op: 'out', hops: 1, piece: 'fact_orders', collapsed: true });
  });

  it('plain atoms are not collapsed', () => {
    expect(parseAtom('d_customer').collapsed).toBe(false);
  });

  it('parses dotted atoms inside a selector with intersections', () => {
    const ast = parseSelector('.g:* group:sales a,.b');
    expect(ast.include[0][0]).toMatchObject({ piece: 'g:*', collapsed: true });
    expect(ast.include[1][0]).toMatchObject({ piece: 'group:sales', collapsed: false });
    expect(ast.include[2][1]).toMatchObject({ piece: 'b', collapsed: true });
  });
});

describe('parseSelector', () => {
  it('unions whitespace-separated terms', () => {
    expect(parseSelector('a b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a', collapsed: false }], [{ op: 'none', hops: 0, piece: 'b', collapsed: false }]],
      exclude: [],
    });
  });
  it('intersects comma-separated atoms within a term', () => {
    expect(parseSelector('a,b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a', collapsed: false }, { op: 'none', hops: 0, piece: 'b', collapsed: false }]],
      exclude: [],
    });
  });
  it('collects ! prefix as exclude', () => {
    expect(parseSelector('a !b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a', collapsed: false }]],
      exclude: [{ op: 'none', hops: 0, piece: 'b', collapsed: false }],
    });
  });
  it('collects --exclude <next> as exclude', () => {
    expect(parseSelector('a --exclude b')).toEqual({
      include: [[{ op: 'none', hops: 0, piece: 'a', collapsed: false }]],
      exclude: [{ op: 'none', hops: 0, piece: 'b', collapsed: false }],
    });
  });
  it('returns empty AST for empty/whitespace input', () => {
    expect(parseSelector('   ')).toEqual({ include: [], exclude: [] });
  });
});

describe('parseAtom', () => {
  it('parses a bare piece as op none', () => {
    expect(parseAtom('d_x')).toEqual({ op: 'none', hops: 0, piece: 'd_x', collapsed: false });
  });
  it('parses prefix + as in, 1 hop', () => {
    expect(parseAtom('+d_x')).toEqual({ op: 'in', hops: 1, piece: 'd_x', collapsed: false });
  });
  it('parses N+ as in, N hops', () => {
    expect(parseAtom('2+d_x')).toEqual({ op: 'in', hops: 2, piece: 'd_x', collapsed: false });
  });
  it('parses suffix + as out, 1 hop', () => {
    expect(parseAtom('d_x+')).toEqual({ op: 'out', hops: 1, piece: 'd_x', collapsed: false });
  });
  it('parses +N suffix as out, N hops', () => {
    expect(parseAtom('d_x+3')).toEqual({ op: 'out', hops: 3, piece: 'd_x', collapsed: false });
  });
  it('parses ~ as both, 1 hop and ~N as both N', () => {
    expect(parseAtom('~d_x')).toEqual({ op: 'both', hops: 1, piece: 'd_x', collapsed: false });
    expect(parseAtom('~2d_x')).toEqual({ op: 'both', hops: 2, piece: 'd_x', collapsed: false });
  });
  it('keeps group: and glob pieces intact under operators', () => {
    expect(parseAtom('+group:sales')).toEqual({ op: 'in', hops: 1, piece: 'group:sales', collapsed: false });
    expect(parseAtom('g:*sales')).toEqual({ op: 'none', hops: 0, piece: 'g:*sales', collapsed: false });
  });
});
