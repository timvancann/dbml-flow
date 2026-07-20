function tokens(selector: string): string[] {
  return selector.trim().split(/\s+/).filter(Boolean);
}

export function toggleTableCollapsed(selector: string, tableName: string, collapse: boolean): string {
  const seg = tableName.split('.').pop() ?? tableName;
  const base = selector.trim() === '' ? '.g:*' : selector.trim();
  const drop = new Set([seg, '.' + seg, tableName, '.' + tableName]);
  const kept = tokens(base).filter((t) => !drop.has(t));
  kept.push(collapse ? '.' + seg : seg);
  return kept.join(' ');
}

export function expandGroup(selector: string, groupName: string): string {
  const base = selector.trim() === '' ? '.g:*' : selector.trim();
  const token = `group:${groupName}`;
  const kept = tokens(base).filter((t) => t !== `.group:${groupName}` && t !== `.g:${groupName}`);
  if (!kept.includes(token)) kept.push(token);
  return kept.join(' ');
}

export function collapseGroup(selector: string, groupName: string): string {
  return tokens(selector)
    .map((t) => (t === `group:${groupName}` || t === `g:${groupName}` ? '.' + t : t))
    .join(' ');
}

function walkIncludeTokens(selector: string, transform: (t: string) => string): string[] {
  const t = tokens(selector);
  const result: string[] = [];
  for (let i = 0; i < t.length; i++) {
    const tok = t[i];
    if (tok.startsWith('!')) {
      result.push(tok);
    } else if (tok === '--exclude') {
      result.push(tok);
      if (i + 1 < t.length) {
        result.push(t[i + 1]);
        i++;
      }
    } else {
      result.push(transform(tok));
    }
  }
  return result;
}

export function collapseAll(selector: string): string {
  if (selector.trim() === '') return '.g:*';
  return walkIncludeTokens(selector, (t) => (t.startsWith('.') ? t : '.' + t)).join(' ');
}

export function expandAll(selector: string): string {
  if (selector.trim() === '') return 'g:*';
  return walkIncludeTokens(selector, (t) => (t.startsWith('.') ? t.slice(1) : t)).join(' ');
}

export function expandedGroupTokens(selector: string): { token: string; name: string }[] {
  return tokens(selector)
    .filter((t) => /^(group:|g:)/.test(t))
    .map((t) => ({ token: t, name: t.replace(/^(group:|g:)/, '') }));
}
