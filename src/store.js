// JSON persistence for the pin registry.
//
// Format: { version: 1, pins: [...] } (see PinRegistry.toJSON).
// - Loading a missing file yields an empty registry: a first run should
//   not fail just because no store exists yet.
// - A corrupt file is a hard error, never silently replaced: silently
//   dropping the pin list would make the GC step (a later roadmap item)
//   treat every live pin as orphaned.
// - Saves are atomic: write to a sibling temp file, then rename over the
//   store, so a crash mid-write cannot leave a half-written registry.

import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { PinRegistry } from "./registry.js";

export async function loadStore(path) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return new PinRegistry();
    throw err;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new TypeError(`pin store is not valid JSON: ${path}`);
  }
  return PinRegistry.fromJSON(data);
}

export async function saveStore(path, registry) {
  const tmp = `${path}.tmp-${process.pid}`;
  try {
    await writeFile(tmp, JSON.stringify(registry.toJSON(), null, 2) + "\n", "utf8");
    await rename(tmp, path);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}
