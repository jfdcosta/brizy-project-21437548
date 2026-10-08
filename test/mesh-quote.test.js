import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry } from 'three';
import { inspectGeometry } from '../storefront/mesh-quote.js';

test('STL measurement reports millimetre envelope and enclosed volume', () => {
  const geometry = new BoxGeometry(10, 20, 30);
  const result = inspectGeometry(geometry);
  assert.deepEqual(result.dimensionsMm, [10, 20, 30]);
  assert.ok(Math.abs(result.volumeCm3 - 6) < 1e-6);
  assert.equal(result.triangles, 12);
});

test('STL measurement rejects a model outside the preview envelope', () => {
  assert.throws(() => inspectGeometry(new BoxGeometry(251, 20, 30)), /250 mm/);
});
