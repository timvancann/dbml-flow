import { buildModel } from '@/model/buildModel';
import { parseDbml } from '@/model/parseDbml';
import { recoverCommentGroups } from '@/model/recoverCommentGroups';
import type { Model } from '@/model/types';

export function loadModel(content: string): Model {
  const { tables, refs } = parseDbml(content);
  const commentGroups = recoverCommentGroups(content);

  for (const table of tables) {
    if (table.group === undefined) {
      table.group = commentGroups.get(table.name);
    }
  }

  return buildModel(tables, refs);
}
