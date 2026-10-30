import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PinRegistry } from "../src/registry.js";
import { loadStore, saveStore } from "../src/store.js";

const A = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

test("missing store loads empty; save/load round-trips", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ipm-"));
  const path = join(dir, "pins.json");
  assert.equal((await loadStore(path)).count, 0);
  const reg = new PinRegistry();
  reg.pin(A, { reason: "backup", size: 42 });
  await saveStore(path, reg);
  const restored = await loadStore(path);
  assert.equal(restored.get(A).size, 42);
  assert.equal(restored.get(A).pinnedAt, reg.get(A).pinnedAt);
});

test("corrupt JSON is a hard error, not an empty registry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ipm-"));
  const path = join(dir, "pins.json");
  await writeFile(path, "{not json", "utf8");
  await assert.rejects(() => loadStore(path), TypeError);
  await writeFile(path, JSON.stringify({ version: 9, pins: [] }), "utf8");
  await assert.rejects(() => loadStore(path), TypeError);
});

test("save leaves no temp file behind and writes pretty JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ipm-"));
  const path = join(dir, "pins.json");
  await saveStore(path, new PinRegistry());
  const raw = await readFile(path, "utf8");
  assert.match(raw, /"version": 1/);
  assert.equal(raw.includes(".tmp-"), false);
});
