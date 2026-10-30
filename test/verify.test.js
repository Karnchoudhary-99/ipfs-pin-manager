import test from "node:test";
import assert from "node:assert/strict";
import { PinRegistry } from "../src/registry.js";
import { parsePinset, verifyRegistry } from "../src/verify.js";

const A = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const B = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const C = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH";

function registryWith(...cids) {
  const registry = new PinRegistry();
  for (const cid of cids) registry.pin(cid, { reason: "test" });
  return registry;
}

test("parsePinset accepts ipfs pin ls lines and plain CID lines", () => {
  const { cids, invalid } = parsePinset(
    `${A} recursive\n${B} direct\n# a comment\n\n${A} recursive\n`,
  );
  assert.deepEqual(cids, [A, B]);
  assert.deepEqual(invalid, []);
});

test("parsePinset collects malformed lines instead of dropping them", () => {
  const { cids, invalid } = parsePinset(`${A}\nnot-a-cid\n${B}\n`);
  assert.deepEqual(cids, [A, B]);
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0].value, "not-a-cid");
});

test("verifyRegistry splits pins into ok, missing and extra", () => {
  const report = verifyRegistry(registryWith(A, B), [A, C]);
  assert.deepEqual(report.ok, [A]);
  assert.deepEqual(report.missing, [B]);
  assert.deepEqual(report.extra, [C]);
  assert.deepEqual(report.counts, { registry: 2, node: 2, ok: 1, missing: 1, extra: 1 });
  assert.equal(report.healthy, false);
});

test("verifyRegistry is healthy when registry and node agree", () => {
  const report = verifyRegistry(registryWith(A, B), [B, A]);
  assert.equal(report.healthy, true);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.extra, []);
});

test("verifyRegistry deduplicates repeated node CIDs", () => {
  const report = verifyRegistry(registryWith(A), [A, A, C, C]);
  assert.deepEqual(report.extra, [C]);
  assert.equal(report.counts.node, 2);
});
