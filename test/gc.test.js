import test from "node:test";
import assert from "node:assert/strict";
import { PinRegistry } from "../src/registry.js";
import { planGc, formatGcScript, pruneDangling } from "../src/gc.js";

const A = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const B = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const C = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH";

function registryWith(...cids) {
  const registry = new PinRegistry();
  for (const cid of cids) registry.pin(cid, { reason: "test" });
  return registry;
}

test("planGc reports only untracked node pins as candidates", () => {
  const plan = planGc(registryWith(A), [A, C, C]);
  assert.deepEqual(plan.candidates, [C]);
  assert.equal(plan.candidateCount, 1);
});

test("planGc sums reclaimable bytes only when every size is known", () => {
  const full = planGc(registryWith(A), [A, C], { [C]: 4096 });
  assert.equal(full.reclaimableBytes, 4096);
  assert.equal(full.sizeComplete, true);
  const partial = planGc(registryWith(A), [A, C, B], { [C]: 4096 });
  assert.equal(partial.reclaimableBytes, 4096);
  assert.equal(partial.sizeComplete, false);
});

test("formatGcScript emits one pin rm per candidate, safe empty script", () => {
  const script = formatGcScript(planGc(registryWith(A), [A, C]));
  assert.match(script, /^#!\/bin\/sh/m);
  assert.match(script, new RegExp(`ipfs pin rm ${C}`));
  assert.doesNotMatch(script, new RegExp(`ipfs pin rm ${A}`));
  const empty = formatGcScript(planGc(registryWith(A), [A]));
  assert.match(empty, /nothing to remove/);
  assert.doesNotMatch(empty, /ipfs pin rm/);
});

test("pruneDangling removes only registry pins missing from the node", () => {
  const registry = registryWith(A, B);
  assert.deepEqual(pruneDangling(registry, [A]), [B]);
  assert.equal(registry.count, 1);
  assert.equal(registry.has(A), true);
  assert.equal(registry.has(B), false);
});
