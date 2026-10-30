import test from "node:test";
import assert from "node:assert/strict";
import { parseCid, isValidCid, assertValidCid } from "../src/cid.js";

const V0 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const V1_32 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const V1_58 = "zQmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

test("CIDv0 parses as version 0", () => {
  assert.deepEqual(parseCid(V0), { version: 0, encoding: "base58btc" });
  assert.equal(isValidCid(V0), true);
});

test("CIDv1 base32 parses as version 1", () => {
  assert.deepEqual(parseCid(V1_32), { version: 1, encoding: "base32" });
});

test("CIDv1 base58btc parses as version 1", () => {
  assert.deepEqual(parseCid(V1_58), { version: 1, encoding: "base58btc" });
});

test("malformed CIDs are rejected", () => {
  for (const bad of ["", "hello", "Qmshort", "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbd0",
    "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzd!", 42, null]) {
    assert.equal(isValidCid(bad), false, JSON.stringify(bad));
    assert.equal(parseCid(bad), null);
  }
});

test("assertValidCid throws on invalid input and returns the parse on valid", () => {
  assert.throws(() => assertValidCid("nope"), TypeError);
  assert.deepEqual(assertValidCid(V0), { version: 0, encoding: "base58btc" });
});
