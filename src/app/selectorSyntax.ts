import type { Model } from '@/model/types';
import { matchPiece } from '@/selection/matchPiece';

export type TokenKind = 'keyword' | 'operator' | 'number' | 'glob' | 'identifier' | 'invalid' | 'whitespace';

export interface Token {
  from: number;
  to: number;
  kind: TokenKind;
  text: string;
}

export interface Diagnostic {
  from: number;
  to: number;
  severity: 'error' | 'warning';
  message: string;
}

export function tokenizeSelector(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    // Whitespace
    if (/\s/.test(text[i])) {
      const from = i;
      while (i < text.length && /\s/.test(text[i])) i++;
      tokens.push({ from, to: i, kind: 'whitespace', text: text.slice(from, i) });
      continue;
    }

    // Keywords: --exclude, group:, g:, path:
    if (text.startsWith('--exclude', i)) {
      tokens.push({ from: i, to: i + 9, kind: 'keyword', text: '--exclude' });
      i += 9;
      continue;
    }
    if (text.startsWith('group:', i)) {
      tokens.push({ from: i, to: i + 6, kind: 'keyword', text: 'group:' });
      i += 6;
      continue;
    }
    if (text.startsWith('path:', i)) {
      tokens.push({ from: i, to: i + 5, kind: 'keyword', text: 'path:' });
      i += 5;
      continue;
    }
    if (text.startsWith('g:', i)) {
      tokens.push({ from: i, to: i + 2, kind: 'keyword', text: 'g:' });
      i += 2;
      continue;
    }

    // Identifier: starts [A-Za-z_]
    if (/[A-Za-z_]/.test(text[i])) {
      const from = i;
      while (i < text.length && /[A-Za-z0-9_.]/.test(text[i])) i++;
      tokens.push({ from, to: i, kind: 'identifier', text: text.slice(from, i) });
      continue;
    }

    // Numbers and hop operators: digit run
    if (/\d/.test(text[i])) {
      const from = i;
      while (i < text.length && /\d/.test(text[i])) i++;
      // Check what follows — if it's '+', it's a number (hop prefix: N+piece)
      tokens.push({ from, to: i, kind: 'number', text: text.slice(from, i) });
      continue;
    }

    // Glob
    if (text[i] === '*') {
      tokens.push({ from: i, to: i + 1, kind: 'glob', text: '*' });
      i++;
      continue;
    }

    // Operators: ! ~ + , >
    if ('!~+,>'.includes(text[i])) {
      const ch = text[i];
      tokens.push({ from: i, to: i + 1, kind: 'operator', text: ch });
      i++;
      continue;
    }

    // Everything else: collect a run of invalid chars (one token per contiguous run)
    const from = i;
    while (
      i < text.length &&
      !/\s/.test(text[i]) &&
      !/[A-Za-z0-9_.*!~+,>]/.test(text[i]) &&
      !text.startsWith('--exclude', i) &&
      !text.startsWith('group:', i) &&
      !text.startsWith('path:', i) &&
      !text.startsWith('g:', i)
    ) {
      i++;
    }
    tokens.push({ from, to: i, kind: 'invalid', text: text.slice(from, i) });
  }

  return tokens;
}

/**
 * Strip leading modifiers (!, ~N, N+) and trailing hop suffixes (+N) from a raw chunk
 * to get the bare piece and its position within the original text.
 */
function extractPiece(
  chunk: string,
  chunkStart: number,
): { piece: string; pieceFrom: number; pieceTo: number } | null {
  let s = chunk;
  let offset = 0;

  // Strip leading !
  if (s.startsWith('!')) {
    s = s.slice(1);
    offset += 1;
  }

  // Strip leading ~N or ~
  const undirMatch = /^~(\d*)/.exec(s);
  if (undirMatch) {
    s = s.slice(undirMatch[0].length);
    offset += undirMatch[0].length;
  } else {
    // Strip leading N+
    const prefixIn = /^(\d+)\+/.exec(s);
    if (prefixIn) {
      s = s.slice(prefixIn[0].length);
      offset += prefixIn[0].length;
    }
  }

  // Strip trailing +N or +
  const suffixOut = /\+(\d*)$/.exec(s);
  if (suffixOut) {
    s = s.slice(0, s.length - suffixOut[0].length);
  }

  if (!s) return null;

  return {
    piece: s,
    pieceFrom: chunkStart + offset,
    pieceTo: chunkStart + offset + s.length,
  };
}

export function validateSelector(model: Model, text: string): Diagnostic[] {
  if (!text.trim()) return [];

  const tokens = tokenizeSelector(text);
  const diagnostics: Diagnostic[] = [];

  // Report all invalid tokens as errors
  for (const tok of tokens) {
    if (tok.kind === 'invalid') {
      diagnostics.push({
        from: tok.from,
        to: tok.to,
        severity: 'error',
        message: `Unexpected "${tok.text}"`,
      });
    }
  }

  // Parse whitespace-separated chunks for reference validation
  const chunks = text.trim().split(/\s+/);
  let pos = 0;
  // Advance pos to the first non-whitespace
  while (pos < text.length && /\s/.test(text[pos])) pos++;

  let skipNext = false;
  for (const chunk of chunks) {
    const chunkStart = pos;
    const chunkEnd = chunkStart + chunk.length;

    // Advance pos past this chunk and any following whitespace
    pos = chunkEnd;
    while (pos < text.length && /\s/.test(text[pos])) pos++;

    if (skipNext) {
      skipNext = false;
      // This chunk is the argument to --exclude; validate as a plain piece
    }

    if (chunk === '--exclude') {
      skipNext = true;
      continue;
    }

    // Handle comma-separated pieces within a chunk
    const parts = chunk.split(',');
    let partOffset = chunkStart;
    for (const part of parts) {
      validatePart(model, text, part, partOffset, diagnostics);
      partOffset += part.length + 1; // +1 for the comma
    }
  }

  return diagnostics.sort((a, b) => a.from - b.from);
}

function validatePart(
  model: Model,
  _text: string,
  part: string,
  partStart: number,
  diagnostics: Diagnostic[],
): void {
  if (!part) return;

  // path: prefix
  if (part.startsWith('path:')) {
    const body = part.slice(5);
    const bodyStart = partStart + 5;
    const gtIdx = body.indexOf('>');
    if (gtIdx === -1 || gtIdx === 0 || gtIdx === body.length - 1) {
      diagnostics.push({
        from: partStart,
        to: partStart + part.length,
        severity: 'warning',
        message: 'Path needs two tables: path:a>b',
      });
      return;
    }
    const a = body.slice(0, gtIdx);
    const b = body.slice(gtIdx + 1);
    const aFrom = bodyStart;
    const aTo = bodyStart + a.length;
    const bFrom = bodyStart + gtIdx + 1;
    const bTo = bFrom + b.length;

    if (!a || !b) {
      diagnostics.push({
        from: partStart,
        to: partStart + part.length,
        severity: 'warning',
        message: 'Path needs two tables: path:a>b',
      });
      return;
    }

    if (matchPiece(model, a).size === 0) {
      diagnostics.push({
        from: aFrom,
        to: aTo,
        severity: 'warning',
        message: `Unknown table in path: "${a}"`,
      });
    }
    if (matchPiece(model, b).size === 0) {
      diagnostics.push({
        from: bFrom,
        to: bTo,
        severity: 'warning',
        message: `Unknown table in path: "${b}"`,
      });
    }
    return;
  }

  // group: prefix
  if (part.startsWith('group:')) {
    const name = part.slice(6);
    const nameFrom = partStart + 6;
    const nameTo = nameFrom + name.length;
    if (matchPiece(model, `group:${name}`).size === 0) {
      diagnostics.push({
        from: nameFrom,
        to: nameTo,
        severity: 'warning',
        message: `Unknown group "${name}"`,
      });
    }
    return;
  }

  // g: prefix
  if (part.startsWith('g:')) {
    const pattern = part.slice(2);
    if (matchPiece(model, `g:${pattern}`).size === 0) {
      diagnostics.push({
        from: partStart,
        to: partStart + part.length,
        severity: 'warning',
        message: `No tables match "g:${pattern}"`,
      });
    }
    return;
  }

  // Plain name (with possible modifiers)
  const extracted = extractPiece(part, partStart);
  if (!extracted) return;

  const { piece, pieceFrom, pieceTo } = extracted;

  // Glob pattern (contains *)
  if (piece.includes('*')) {
    if (matchPiece(model, piece).size === 0) {
      diagnostics.push({
        from: pieceFrom,
        to: pieceTo,
        severity: 'warning',
        message: `No tables match "${piece}"`,
      });
    }
    return;
  }

  // Plain table name
  if (matchPiece(model, piece).size === 0) {
    diagnostics.push({
      from: pieceFrom,
      to: pieceTo,
      severity: 'warning',
      message: `Unknown table "${piece}"`,
    });
  }
}
