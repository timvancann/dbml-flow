export function focusSelector(seg: string, hops = 1): string {
  return `~${hops}${seg}`;
}

const FOCUS_RE = /^~(\d*)([^\s~+,!]+)$/;

export function parseFocus(selector: string): { table: string; hops: number } | null {
  const s = selector.trim();
  if (/\s/.test(s)) return null;
  const m = FOCUS_RE.exec(s);
  if (!m) return null;
  return { table: m[2], hops: m[1] ? parseInt(m[1], 10) : 1 };
}
