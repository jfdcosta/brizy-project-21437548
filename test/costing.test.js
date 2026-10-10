import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateCosts } from '../src/costing.js';

test('agreed JDC Duo example separates actual machine cost from customer margin', () => {
  const input = { material: 'pla', grams: 124, printHours: 55 / 12, labourMinutes: 15, saleAmount: 17.99 };
  const cost = estimateCosts(input);
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);
  near(cost.printerCost, 2.53);
  near(cost.production, 9.27);
  near(cost.contribution, 8.25015);
  near(cost.machineContribution, 13.5116666667);
  near(estimateCosts({ ...input, material: 'petg' }).contribution, 8.00215);
  const delivered = estimateCosts({ ...input, deliveryCharge: 1.99, actualDeliveryCost: 3 });
  near(delivered.revenue, 19.98);
  near(delivered.paymentFee, 0.4997);
  near(delivered.contribution, 7.2103);
  assert.throws(() => estimateCosts({ ...input, grams: NaN }));
});
