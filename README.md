# IPFS Pin Manager

Track, verify and garbage-collect pinned content across IPFS nodes:
a pin registry with CID validation, pin/unpin with reasons, verification
against a node's pinset, and GC of orphaned blocks — from the command line.

## Roadmap

- [x] Project scaffold (package.json, pin module layout, smoke test, CI, README)
- [x] Pin registry (CID validation, pin/unpin, reasons, persistence)
- [ ] Verification against a node pinset (missing/extra/dangling pins)
- [ ] Garbage collection (orphan detection, dry-run + sweep)
- [ ] Self-review checklist, then public

## Quick start

```sh
npm test                  # dependency-free (node --test)
node examples/demo.mjs    # registry API demo, no IPFS node needed
```

## Pin registry

The registry tracks what is pinned, why, and how big it is. CIDs are
validated structurally: CIDv0 (`Qm…`, 46 base58 chars) and CIDv1
(base32 `bafy…` / base58btc `z…`). A pin requires a non-empty reason —
unexplained pins are how orphans accumulate. Re-pinning a CID updates its
record but keeps the original `pinnedAt`. The store is JSON
(`{ version: 1, pins: [...] }`), saved atomically; a missing file loads
as an empty registry, while a corrupt file is a hard error rather than a
silent reset.

```sh
node src/cli.js --store ./pins.json pin QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG --reason backup --size 1024 --tag prod
node src/cli.js --store ./pins.json list --reason backup
node src/cli.js --store ./pins.json show QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
node src/cli.js --store ./pins.json stats
node src/cli.js --store ./pins.json unpin QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

`stats` reports pin count, total size (with `sizeComplete: false` when
any pin's size is unknown), and pins grouped by reason.

## License

MIT — see [LICENSE](LICENSE).
