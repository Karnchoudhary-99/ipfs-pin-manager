// Demo: build a small pin registry in memory, then show stats.
// No IPFS node needed — this exercises the registry API only.
// Run: node examples/demo.mjs
import { PinRegistry } from "../src/registry.js";

const registry = new PinRegistry();
registry.pin("QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG", {
  reason: "backup", size: 2048, tags: ["prod"],
});
registry.pin("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", {
  reason: "website", tags: ["prod", "site"],
});
console.log(`pins: ${registry.count}`);
console.log(`total size: ${JSON.stringify(registry.totalSize())}`);
console.log("backups:", registry.list({ reason: "backup" }).map((p) => p.cid));
console.log("prod-tagged:", registry.list({ tag: "prod" }).length);
