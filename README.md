# IPFS Pin Manager

Track, verify and garbage-collect pinned content across IPFS nodes:
a pin registry with CID validation, pin/unpin with reasons, verification
against a node's pinset, and GC of orphaned blocks — from the command line.

## Roadmap

- [x] Project scaffold (package.json, pin module layout, smoke test, CI, README)
- [x] Pin registry (CID validation, pin/unpin, reasons, persistence)
- [x] Verification against a node pinset (ok/missing/extra)
- [x] Garbage collection (orphan detection, dry-run plan + review script)
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

## Verification and garbage collection

The manager never talks to a node itself — you hand it the node's
pinset, so the workflow stays honest about what it can and cannot do:

```sh
ipfs pin ls > pinset.txt   # on the node, or: ipfs pin ls --quiet > pinset.txt
node src/cli.js --store ./pins.json verify --pinset pinset.txt
```

The report splits pins into three buckets: `ok` (registry + node agree),
`missing` (in the registry but lost from the node — re-pin it), and
`extra` (on the node but untracked by the registry — the GC candidates).
`verify` exits 0 even when drift is found; the report is the result,
not an error.

`gc` plans the sweep and never unpins anything on its own:

```sh
node src/cli.js --store ./pins.json gc --pinset pinset.txt
node src/cli.js --store ./pins.json gc --pinset pinset.txt --sizes sizes.json --script sweep.sh
# review sweep.sh, then run it against the node yourself
```

`--sizes` is an optional JSON map of CID to bytes (e.g. from
`ipfs dag stat`); without a size for every candidate, the reclaimable
total is reported with `sizeComplete: false` rather than silently
partial. `--prune-dangling` is the one local mutation: it drops registry
entries for content the node no longer pins, and saves the store — use
it only once you have decided those pins should not be re-pinned.

```sh
node examples/verify-gc.mjs   # same flow in-process, no node needed
```

## License

MIT — see [LICENSE](LICENSE).
