#!/usr/bin/env node
// ipfs-pin-manager CLI: pin/unpin/list/show against a JSON pin store.
// Usage: node src/cli.js [--store <path>] <command> [args]
//   pin <cid> --reason <text> [--size <bytes>] [--tag <t> ...]
//   unpin <cid>
//   list [--reason <r>] [--tag <t>]
//   show <cid>
//   stats
//   verify --pinset <file>              (report ok/missing/extra vs a node)
//   gc --pinset <file> [--sizes <json>] [--script <path>] [--prune-dangling]
// Exit codes: 0 ok, 1 usage/validation error, 2 store error.
// verify/gc exit 0 even when drift is found — the report is the result.

import { readFile, writeFile } from "node:fs/promises";
import { loadStore, saveStore } from "./store.js";
import { parsePinset, verifyRegistry } from "./verify.js";
import { planGc, formatGcScript, pruneDangling } from "./gc.js";

const DEFAULT_STORE = "./pins.json";

function parseArgs(argv) {
  const args = { store: DEFAULT_STORE, command: null, positional: [], flags: {} };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--store") args.store = argv[++i];
    else if (arg === "--prune-dangling") args.flags.pruneDangling = true;
    else if (arg === "--pinset" || arg === "--sizes" || arg === "--script") {
      const key = arg.slice(2);
      args.flags[key] = argv[++i];
    } else if (arg === "--reason" || arg === "--size" || arg === "--tag") {
      const key = arg.slice(2);
      if (key === "tag") (args.flags.tag ??= []).push(argv[++i]);
      else args.flags[key] = argv[++i];
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown flag: ${arg}`);
    } else if (args.command === null) args.command = arg;
    else args.positional.push(arg);
    i += 1;
  }
  return args;
}

function usage() {
  return `Usage: ipfs-pin-manager [--store <path>] <command> [args]
Commands:
  pin <cid> --reason <text> [--size <bytes>] [--tag <t> ...]
  unpin <cid>
  list [--reason <r>] [--tag <t>]
  show <cid>
  stats
  verify --pinset <file>
  gc --pinset <file> [--sizes <json>] [--script <path>] [--prune-dangling]`;
}

async function loadPinset(path) {
  if (!path) throw new Error("--pinset <file> is required (ipfs pin ls output, or one CID per line)");
  const text = await readFile(path, "utf8");
  const { cids, invalid } = parsePinset(text);
  if (invalid.length > 0) {
    throw new Error(
      `pinset has ${invalid.length} malformed line(s): ${invalid.map((i) => i.value).join(", ")}`,
    );
  }
  return cids;
}

async function loadSizes(path) {
  if (!path) return {};
  const data = JSON.parse(await readFile(path, "utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("sizes file must be a JSON object mapping CID to bytes");
  }
  for (const [cid, size] of Object.entries(data)) {
    if (!Number.isInteger(size) || size < 0) {
      throw new TypeError(`sizes file: size for ${cid} must be a non-negative integer`);
    }
  }
  return data;
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    console.error(usage());
    return 1;
  }
  if (!args.command) {
    console.error(usage());
    return 1;
  }
  let registry;
  try {
    registry = await loadStore(args.store);
  } catch (err) {
    console.error(`store error: ${err.message}`);
    return 2;
  }
  try {
    if (args.command === "pin") {
      const [cid] = args.positional;
      if (!cid) throw new Error("pin requires a CID");
      const size = args.flags.size !== undefined ? Number(args.flags.size) : null;
      const record = registry.pin(cid, { reason: args.flags.reason, size, tags: args.flags.tag ?? [] });
      await saveStore(args.store, registry);
      console.log(JSON.stringify(record));
      return 0;
    }
    if (args.command === "unpin") {
      const [cid] = args.positional;
      if (!cid) throw new Error("unpin requires a CID");
      const removed = registry.unpin(cid);
      if (removed) await saveStore(args.store, registry);
      console.log(removed ? `unpinned ${cid}` : `not pinned: ${cid}`);
      return 0;
    }
    if (args.command === "list") {
      const records = registry.list({ reason: args.flags.reason, tag: (args.flags.tag ?? [])[0] });
      for (const record of records) console.log(JSON.stringify(record));
      return 0;
    }
    if (args.command === "stats") {
      const records = registry.list();
      const byReason = {};
      for (const record of records) byReason[record.reason] = (byReason[record.reason] ?? 0) + 1;
      const { bytes, complete } = registry.totalSize();
      console.log(JSON.stringify({ pins: records.length, totalSizeBytes: bytes, sizeComplete: complete, byReason }, null, 2));
      return 0;
    }
    if (args.command === "show") {
      const [cid] = args.positional;
      if (!cid) throw new Error("show requires a CID");
      const record = registry.get(cid);
      if (!record) {
        console.error(`not pinned: ${cid}`);
        return 1;
      }
      console.log(JSON.stringify(record, null, 2));
      return 0;
    }
    if (args.command === "verify") {
      const nodeCids = await loadPinset(args.flags.pinset);
      console.log(JSON.stringify(verifyRegistry(registry, nodeCids), null, 2));
      return 0;
    }
    if (args.command === "gc") {
      const nodeCids = await loadPinset(args.flags.pinset);
      const sizes = await loadSizes(args.flags.sizes);
      const plan = planGc(registry, nodeCids, sizes);
      const output = { ...plan };
      if (args.flags.pruneDangling) {
        output.prunedDangling = pruneDangling(registry, nodeCids);
        if (output.prunedDangling.length > 0) await saveStore(args.store, registry);
      }
      console.log(JSON.stringify(output, null, 2));
      if (args.flags.script) {
        await writeFile(args.flags.script, formatGcScript(plan), "utf8");
        console.error(`wrote GC script: ${args.flags.script}`);
      }
      return 0;
    }
    console.error(`unknown command: ${args.command}`);
    console.error(usage());
    return 1;
  } catch (err) {
    console.error(err.message);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}
