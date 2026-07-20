import type { Model } from '@/model/types';

export function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function matchPiece(model: Model, piece: string): Set<string> {
  const result = new Set<string>();

  if (piece.startsWith('group:')) {
    const name = piece.slice('group:'.length);
    for (const group of model.groups.values()) {
      if (group.name === name || group.name.endsWith('.' + name)) {
        for (const table of group.tables) result.add(table);
      }
    }
    return result;
  }

  if (piece.startsWith('g:')) {
    const re = globToRegExp(piece.slice('g:'.length));
    for (const group of model.groups.values()) {
      if (re.test(group.name)) {
        for (const table of group.tables) result.add(table);
      }
    }
    return result;
  }

  if (piece.includes('*')) {
    const re = globToRegExp(piece);
    for (const name of model.tables.keys()) {
      if (re.test(name)) result.add(name);
    }
    return result;
  }

  if (model.tables.has(piece)) {
    result.add(piece);
    return result;
  }

  for (const name of model.tables.keys()) {
    if (name.endsWith('.' + piece)) result.add(name);
  }
  return result;
}

export function matchGroups(model: Model, piece: string): Set<string> {
  const result = new Set<string>();
  if (piece.startsWith('group:')) {
    const name = piece.slice('group:'.length);
    for (const group of model.groups.values()) {
      if (group.name === name || group.name.endsWith('.' + name)) result.add(group.name);
    }
  } else if (piece.startsWith('g:')) {
    const re = globToRegExp(piece.slice('g:'.length));
    for (const group of model.groups.values()) {
      if (re.test(group.name)) result.add(group.name);
    }
  }
  return result;
}
