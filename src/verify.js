// Verification: compare the registry against a node's actual pinset.
//
// The node pinset is supplied as text, in either of the two shapes an
// operator can produce without this tool talking to a node itself:
//   - `ipfs pin ls` output: "<cid> recursive|direct|indirect ..." per line
//   - one CID per line (e.g. `ipfs pin ls --type=recursive --quiet`)
//
// The report uses three disjoint buckets:
//   - ok:      in the registry AND on the node (the healthy case)
//   - missing: in the registry but NOT on the node — a pin the manager
//              believes exists, but the node has lost (re-pin it, or
//              prune it deliberately via gc --prune-dangling)
//   - extra:   on the node but NOT in the registry — untracked pins, the
//              GC candidates. Extra pins are never deleted by verify;
//              that is gc.js's job, and only as a dry-run plan by default.
//
// A pinset line whose first token is not a valid CID is reported in
// `invalid` rather than silently dropped: a malformed pinset would make
// a clean-looking report a lie, so callers (the CLI) treat any invalid
// line as a hard error.

import { isValidCid } from "./cid.js";

/**
 * Parse pinset text. Returns { cids, invalid } where cids are deduplicated
 * in first-seen order and invalid is [{ line, value }] for malformed lines.
 */
export function parsePinset(text) {
  if (typeof text !== "string") throw new TypeError("pinset must be a string");
  const cids = [];
  const seen = new Set();
  const invalid = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const [first] = line.split(/\s+/);
    if (!isValidCid(first)) {
      invalid.push({ line, value: first });
      continue;
    }
    if (!seen.has(first)) {
      seen.add(first);
      cids.push(first);
    }
  }
  return { cids, invalid };
}

/**
 * Compare a PinRegistry against a node pinset (array of CID strings).
 * Registry order is kept for ok/missing; node order for extra.
 */
export function verifyRegistry(registry, nodeCids) {
  const nodeSet = new Set(nodeCids);
  const registryPins = registry.list();
  const registrySet = new Set(registryPins.map((p) => p.cid));
  const ok = [];
  const missing = [];
  for (const pin of registryPins) {
    if (nodeSet.has(pin.cid)) ok.push(pin.cid);
    else missing.push(pin.cid);
  }
  const extra = [];
  for (const cid of nodeCids) {
    if (!registrySet.has(cid) && !extra.includes(cid)) extra.push(cid);
  }
  return {
    ok,
    missing,
    extra,
    counts: {
      registry: registryPins.length,
      node: nodeSet.size,
      ok: ok.length,
      missing: missing.length,
      extra: extra.length,
    },
    healthy: missing.length === 0 && extra.length === 0,
  };
}
