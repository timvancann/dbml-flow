import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { parseDbtManifest } from '@/model/parseDbtManifest';
import { resolveSelection } from '@/selection/resolveSelection';
import { selectionToFlow } from '@/canvas/selectionToFlow';

it('example files: stg_orders -> f_order survives join and flow', () => {
  const model = loadModel(readFileSync('examples/shop.dbml', 'utf8'));
  const manifest = JSON.parse(readFileSync('examples/shop.manifest.json', 'utf8'));
  const lineage = parseDbtManifest(manifest, model);
  expect(lineage.matchedTables.has('model.shop.stg_orders')).toBe(true);
  expect(lineage.edges).toContainEqual({ fromTable: 'model.shop.stg_orders', toTable: 'model.shop.f_order' });

  const sel = resolveSelection(model, 'g:*');
  const { edges } = selectionToFlow(model, sel, { edges: lineage.edges, external: lineage.external });
  const lin = edges.find((e) => e.source === 'model.shop.stg_orders' && e.target === 'model.shop.f_order');
  expect(lin).toBeDefined();
});
