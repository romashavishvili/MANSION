import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, GOV } from '../src/core/governor.js';

test('governor steps resolution down only after sustained slowness, up only after sustained headroom', () => {
  assert.equal(decide({ avgMs: 40, slowFor: 0.2, fastFor: 0, scale: 1 }), 0, 'a short spike does nothing');
  assert.equal(decide({ avgMs: 40, slowFor: 1.5, fastFor: 0, scale: 1 }), -1);
  assert.equal(decide({ avgMs: 12, slowFor: 0, fastFor: 1, scale: 0.7 }), 0, 'needs a few seconds of headroom');
  assert.equal(decide({ avgMs: 12, slowFor: 0, fastFor: 5, scale: 0.7 }), 1);
});
test('governor never leaves its bounds and sits still between the thresholds (no flicker)', () => {
  assert.equal(decide({ avgMs: 99, slowFor: 9, fastFor: 0, scale: GOV.min }), 0);
  assert.equal(decide({ avgMs: 5, slowFor: 0, fastFor: 99, scale: GOV.max }), 0);
  assert.equal(decide({ avgMs: 20, slowFor: 9, fastFor: 9, scale: 0.8 }), 0, '15.5-24 ms is the dead band');
  assert.ok(GOV.fastMs < GOV.slowMs && GOV.upAfter > GOV.downAfter);
});
