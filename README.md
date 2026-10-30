# IPFS Pin Manager

Track, verify and garbage-collect pinned content across IPFS nodes:
a pin registry with CID validation, pin/unpin with reasons, verification
against a node's pinset, and GC of orphaned blocks — from the command line.

## Roadmap

- [x] Project scaffold (package.json, pin module layout, smoke test, CI, README)
- [ ] Pin registry (CID validation, pin/unpin, reasons, persistence)
- [ ] Verification against a node pinset (missing/extra/dangling pins)
- [ ] Garbage collection (orphan detection, dry-run + sweep)
- [ ] Self-review checklist, then public

## Quick start

```sh
npm test    # smoke test, dependency-free (node --test)
```

## License

MIT — see [LICENSE](LICENSE).
