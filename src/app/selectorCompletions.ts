import type { Model } from '@/model/types';

export interface SelectorOption {
  label: string;
  detail?: string;
  type?: string;
}

export interface SelectorCompletion {
  from: number;
  options: SelectorOption[];
}

function lastSeg(name: string): string {
  return name.split('.').pop()!;
}

function sorted(segs: string[]): string[] {
  return [...new Set(segs)].sort();
}

// Case-insensitive substring match ("not totally fuzzy"): keep segments that
// CONTAIN the query, with prefix matches ranked first. Alphabetical order is
// preserved within each rank regardless of input order.
export function matchSegs(segs: string[], query: string): string[] {
  if (!query) return segs;
  const q = query.toLowerCase();
  const sortedSegs = [...segs].sort();
  const starts: string[] = [];
  const contains: string[] = [];
  for (const s of sortedSegs) {
    const i = s.toLowerCase().indexOf(q);
    if (i === 0) starts.push(s);
    else if (i > 0) contains.push(s);
  }
  return [...starts, ...contains];
}

export function selectorCompletions(model: Model, textBefore: string): SelectorCompletion {
  // Whitespace separates tokens; commas separate atoms within a token (see
  // parseSelector). Either boundary starts a fresh segment to complete.
  const lastBoundary = Math.max(
    textBefore.lastIndexOf(' '),
    textBefore.lastIndexOf('\t'),
    textBefore.lastIndexOf('\n'),
    textBefore.lastIndexOf(','),
  );
  const tokenStart = lastBoundary === -1 ? 0 : lastBoundary + 1;
  const token = textBefore.slice(tokenStart);

  let dotOffset = 0;
  if (token.startsWith('.')) {
    dotOffset = 1;
  }
  const inner = token.slice(dotOffset);
  const innerStart = tokenStart + dotOffset;

  const tableSegs = sorted([...model.tables.keys()].map(lastSeg));
  const groupSegs = sorted([...model.groups.values()].map((g) => lastSeg(g.name)));

  const keywords = ['group:', 'g:', 'path:'];

  if (inner.startsWith('group:')) {
    const rest = inner.slice(6);
    const from = innerStart + 6;
    const options = matchSegs(groupSegs, rest)
      .slice(0, 50)
      .map((label) => ({ label, type: 'group' }));
    return { from, options };
  }

  if (inner.startsWith('g:')) {
    const rest = inner.slice(2);
    const from = innerStart + 2;
    const options = matchSegs(groupSegs, rest)
      .slice(0, 50)
      .map((label) => ({ label, type: 'group' }));
    return { from, options };
  }

  if (inner.startsWith('path:')) {
    const body = inner.slice(5);
    if (body.includes('>')) {
      const gtIdx = body.indexOf('>');
      const a = body.slice(0, gtIdx);
      const b = body.slice(gtIdx + 1);
      const from = innerStart + 5 + a.length + 1;
      const options = matchSegs(tableSegs, b)
        .slice(0, 50)
        .map((label) => ({ label, type: 'table' }));
      return { from, options };
    } else {
      const from = innerStart + 5;
      const options = matchSegs(tableSegs, body)
        .slice(0, 50)
        .map((label) => ({ label, type: 'table' }));
      return { from, options };
    }
  }

  // plain token
  const prefixMatch = inner.match(/^[!~+0-9]*/);
  const prefixLen = prefixMatch ? prefixMatch[0].length : 0;
  const bare = inner.slice(prefixLen);
  const from = innerStart;

  const kwOptions: SelectorOption[] = keywords
    .filter((kw) => kw.startsWith(inner))
    .map((label) => ({ label, type: 'keyword' }));

  const tableOptions: SelectorOption[] = matchSegs(tableSegs, bare)
    .map((seg) => ({ label: inner.slice(0, prefixLen) + seg, type: 'table' }));

  const options = [...kwOptions, ...tableOptions].slice(0, 50);
  return { from, options };
}
