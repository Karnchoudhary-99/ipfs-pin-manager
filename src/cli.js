#!/usr/bin/env node
// ipfs-pin-manager CLI: pin/unpin/list/show against a JSON pin store.
// Usage: node src/cli.js [--store <path>] <command> [args]
//   pin <cid> --reason <text> [--size <bytes>] [--tag <t> ...]
//   unpin <cid>
//   list [--reason <r>] [--tag <t>]
//   show <cid>
// Exit codes: 0 ok, 1 usage/validation error, 2 store error.

import { loadStore, saveStore } from "./store.js";

const DEFAULT_STORE = "./pins.json";

function parseArgs(argv) {
  const args = { store: DEFAULT_STORE, command: null, positional: [], flags: {} };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--store") args.store = argv[++i];
    else if (arg === "--reason" || arg === "--size" || arg === "--tag") {
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
  show <cid>`;
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
