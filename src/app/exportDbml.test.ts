import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { parseDbml } from '@/model/parseDbml';
import { resolveSelection } from '@/selection/resolveSelection';
import { selectionToDbml } from '@/app/exportDbml';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));

describe('selectionToDbml', () => {
  it('serializes selected tables and refs back to DBML', () => {
    const sel = resolveSelection(model, 'f_order+');
    const out = selectionToDbml(model, sel);
    expect(out).toContain('Table "model.shop.f_order" {');
    expect(out).toMatch(/\[pk\]/);
    expect(out).toMatch(/^Ref: .+ > .+$/m);
  });

  it('round-trips through the parser', () => {
    const sel = resolveSelection(model, 'g:*');
    const { tables } = parseDbml(selectionToDbml(model, sel));
    expect(tables.length).toBe(sel.nodes.size);
  });
});
