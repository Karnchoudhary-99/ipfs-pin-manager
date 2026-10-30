import test from "node:test";
import assert from "node:assert/strict";
import { PinRegistry } from "../src/registry.js";

const A = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const B = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

test("pin stores a record and get/has/count reflect it", () => {
  const reg = new PinRegistry();
  const rec = reg.pin(A, { reason: "backup", size: 1024 });
  assert.equal(rec.cid, A);
  assert.equal(reg.has(A), true);
  assert.equal(reg.count, 1);
  assert.equal(reg.get(A).reason, "backup");
});

test("pin rejects invalid CIDs, empty reasons and bad sizes", () => {
  const reg = new PinRegistry();
  assert.throws(() => reg.pin("nope", { reason: "x" }), TypeError);
  assert.throws(() => reg.pin(A, { reason: "  " }), TypeError);
  assert.throws(() => reg.pin(A, { reason: "x", size: -1 }), TypeError);
  assert.equal(reg.count, 0);
});

test("re-pinning updates the record but keeps pinnedAt", () => {
  const reg = new PinRegistry();
  const first = reg.pin(A, { reason: "backup" });
  const second = reg.pin(A, { reason: "website", size: 5 });
  assert.equal(second.pinnedAt, first.pinnedAt);
  assert.equal(second.reason, "website");
  assert.equal(second.size, 5);
  assert.equal(reg.count, 1);
});

test("unpin returns false for unknown CIDs and removes known ones", () => {
  const reg = new PinRegistry();
  reg.pin(A, { reason: "backup" });
  assert.equal(reg.unpin(B), false);
  assert.equal(reg.unpin(A), true);
  assert.equal(reg.has(A), false);
});

test("list filters by reason and tag, sorted by pinnedAt", () => {
  const reg = new PinRegistry();
  reg.pin(A, { reason: "backup", tags: ["prod"] });
  reg.pin(B, { reason: "website", tags: ["prod", "site"] });
  assert.deepEqual(reg.list({ reason: "backup" }).map((p) => p.cid), [A]);
  assert.deepEqual(reg.list({ tag: "site" }).map((p) => p.cid), [B]);
  assert.equal(reg.list({ tag: "prod" }).length, 2);
});

test("totalSize reports incompleteness when any size is unknown", () => {
  const reg = new PinRegistry();
  reg.pin(A, { reason: "a", size: 100 });
  assert.deepEqual(reg.totalSize(), { bytes: 100, complete: true });
  reg.pin(B, { reason: "b" });
  assert.deepEqual(reg.totalSize(), { bytes: 100, complete: false });
});

test("JSON round-trip preserves records and rejects bad formats", () => {
  const reg = new PinRegistry();
  reg.pin(A, { reason: "backup", size: 7, tags: ["x"] });
  const restored = PinRegistry.fromJSON(JSON.parse(JSON.stringify(reg.toJSON())));
  assert.equal(restored.get(A).reason, "backup");
  assert.equal(restored.get(A).pinnedAt, reg.get(A).pinnedAt);
  assert.throws(() => PinRegistry.fromJSON({ version: 2, pins: [] }), TypeError);
  assert.throws(() => PinRegistry.fromJSON({ version: 1 }), TypeError);
});
