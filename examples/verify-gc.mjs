// Demo: verify a registry against a node pinset, then plan a GC sweep.
// No IPFS node needed — the pinset is a string in `ipfs pin ls` format.
// Run: node examples/verify-gc.mjs
import { PinRegistry } from "../src/registry.js";
import { parsePinset, verifyRegistry } from "../src/verify.js";
import { planGc, formatGcScript } from "../src/gc.js";

const A = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const B = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const C = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH";

const registry = new PinRegistry();
registry.pin(A, { reason: "backup", size: 2048 });
registry.pin(B, { reason: "website" });

// The node pins A and an untracked C; B has been lost from the node.
const { cids: nodeCids } = parsePinset(`${A} recursive\n${C} direct\n`);

const report = verifyRegistry(registry, nodeCids);
console.log("verify:", JSON.stringify(report.counts));
console.log("missing (re-pin or prune):", report.missing);
console.log("extra (GC candidates):", report.extra);

const plan = planGc(registry, nodeCids, { [C]: 4096 });
console.log("gc plan:", JSON.stringify(plan));
console.log("--- sweep script (review before running) ---");
console.log(formatGcScript(plan));
