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
  if (tokens(base).includes(token)) return base;
  return `${base} ${token}`;
}

export function collapseGroup(selector: string, groupName: string): string {
  return tokens(selector)
    .map((t) => (t === `group:${groupName}` || t === `g:${groupName}` ? '.' + t : t))
    .join(' ');
}

export function expandedGroupTokens(selector: string): { token: string; name: string }[] {
  return tokens(selector)
    .filter((t) => /^(group:|g:)/.test(t))
    .map((t) => ({ token: t, name: t.replace(/^(group:|g:)/, '') }));
}
