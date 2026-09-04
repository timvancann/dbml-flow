import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { resolveSelection } from '@/selection/resolveSelection';
import { selectionToFlow } from '@/canvas/selectionToFlow';

it('example file: stg_orders -> f_order survives parse and flow', () => {
  const model = loadModel(readFileSync('examples/shop.dbml', 'utf8'));
  expect(model.lineage).toContainEqual({ fromTable: 'model.shop.stg_orders', toTable: 'model.shop.f_order' });

  const sel = resolveSelection(model, 'g:*');
  const { edges } = selectionToFlow(model, sel, { edges: model.lineage });
  const lin = edges.find((e) => e.source === 'model.shop.stg_orders' && e.target === 'model.shop.f_order');
  expect(lin).toBeDefined();
});
