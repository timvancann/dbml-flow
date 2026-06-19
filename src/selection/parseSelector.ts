export type Op = 'none' | 'in' | 'out' | 'both';

export interface Atom {
  op: Op;
  hops: number;
  piece: string;
}

export interface SelectorAst {
  include: Atom[][];
  exclude: Atom[];
}

export function parseAtom(raw: string): Atom {
  let m: RegExpExecArray | null;

  // Undirected prefix: ~ or ~N
  if ((m = /^~(\d*)(.+)$/.exec(raw))) {
    return { op: 'both', hops: m[1] ? parseInt(m[1], 10) : 1, piece: m[2] };
  }
  // Toward-facts prefix: + or N+
  if ((m = /^(\d*)\+(.+)$/.exec(raw))) {
    return { op: 'in', hops: m[1] ? parseInt(m[1], 10) : 1, piece: m[2] };
  }
  // Toward-dims suffix: piece+ or piece+N
  if ((m = /^(.+?)\+(\d*)$/.exec(raw))) {
    return { op: 'out', hops: m[2] ? parseInt(m[2], 10) : 1, piece: m[1] };
  }
  return { op: 'none', hops: 0, piece: raw };
}

export function parseSelector(input: string): SelectorAst {
  const tokens = input.trim().split(/\s+/).filter((t) => t.length > 0);
  const include: Atom[][] = [];
  const exclude: Atom[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '--exclude') {
      const next = tokens[i + 1];
      if (next) {
        for (const part of next.split(',')) exclude.push(parseAtom(part));
        i++;
      }
      continue;
    }

    if (token.startsWith('!')) {
      const body = token.slice(1);
      for (const part of body.split(',')) exclude.push(parseAtom(part));
      continue;
    }

    include.push(token.split(',').map(parseAtom));
  }

  return { include, exclude };
}
