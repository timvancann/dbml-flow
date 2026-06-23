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
// CONTAIN the query, with prefix matches ranked first. `segs` must be sorted so
// alphabetical order is preserved within each rank.
function matchSegs(segs: string[], query: string): string[] {
  if (!query) return segs;
  const q = query.toLowerCase();
  const starts: string[] = [];
  const contains: string[] = [];
  for (const s of segs) {
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

  const tableSegs = sorted([...model.tables.keys()].map(lastSeg));
  const groupSegs = sorted([...model.groups.values()].map((g) => lastSeg(g.name)));

  const keywords = ['group:', 'g:', 'path:'];

  if (token.startsWith('group:')) {
    const rest = token.slice(6);
    const from = tokenStart + 6;
    const options = matchSegs(groupSegs, rest)
      .slice(0, 50)
      .map((label) => ({ label, type: 'group' }));
    return { from, options };
  }

  if (token.startsWith('g:')) {
    const rest = token.slice(2);
    const from = tokenStart + 2;
    const options = matchSegs(groupSegs, rest)
      .slice(0, 50)
      .map((label) => ({ label, type: 'group' }));
    return { from, options };
  }

  if (token.startsWith('path:')) {
    const body = token.slice(5);
    if (body.includes('>')) {
      const gtIdx = body.indexOf('>');
      const a = body.slice(0, gtIdx);
      const b = body.slice(gtIdx + 1);
      const from = tokenStart + 5 + a.length + 1;
      const options = matchSegs(tableSegs, b)
        .slice(0, 50)
        .map((label) => ({ label, type: 'table' }));
      return { from, options };
    } else {
      const from = tokenStart + 5;
      const options = matchSegs(tableSegs, body)
        .slice(0, 50)
        .map((label) => ({ label, type: 'table' }));
      return { from, options };
    }
  }

  // plain token
  const prefixMatch = token.match(/^[!~+0-9]*/);
  const prefixLen = prefixMatch ? prefixMatch[0].length : 0;
  const bare = token.slice(prefixLen);
  const from = tokenStart;

  const kwOptions: SelectorOption[] = keywords
    .filter((kw) => kw.startsWith(token))
    .map((label) => ({ label, type: 'keyword' }));

  const tableOptions: SelectorOption[] = matchSegs(tableSegs, bare)
    .map((seg) => ({ label: token.slice(0, prefixLen) + seg, type: 'table' }));

  const options = [...kwOptions, ...tableOptions].slice(0, 50);
  return { from, options };
}
