const COMMENT_RE = /^\s*\/\/--configured at schema:\s*(.+?)\s*$/;
const TABLE_RE = /^\s*Table\s+"?([^"{\s]+)"?/;

export function recoverCommentGroups(content: string): Map<string, string> {
  const map = new Map<string, string>();
  let pendingGroup: string | null = null;

  for (const line of content.split('\n')) {
    const comment = COMMENT_RE.exec(line);
    if (comment) {
      pendingGroup = comment[1];
      continue;
    }
    const table = TABLE_RE.exec(line);
    if (table) {
      if (pendingGroup) map.set(table[1], pendingGroup);
      pendingGroup = null;
    }
  }

  return map;
}
