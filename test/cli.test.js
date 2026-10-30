import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { main } from "../src/cli.js";

const run = promisify(execFile);
const A = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const B = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

async function storePath() {
  return join(await mkdtemp(join(tmpdir(), "ipm-cli-")), "pins.json");
}

// Capture console output for main() calls without spawning a process.
async function runMain(argv) {
  const out = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a) => out.push(a.join(" "));
  console.error = (...a) => out.push(a.join(" "));
  try {
    const code = await main(argv);
    return { code, out };
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

test("CLI pin/list/show/unpin round-trip via main()", async () => {
  const store = await storePath();
  let r = await runMain(["--store", store, "pin", A, "--reason", "backup", "--size", "10"]);
  assert.equal(r.code, 0);
  assert.match(r.out[0], /"reason":"backup"/);
  r = await runMain(["--store", store, "pin", B, "--reason", "website"]);
  assert.equal(r.code, 0);
  r = await runMain(["--store", store, "list"]);
  assert.equal(r.out.length, 2);
  r = await runMain(["--store", store, "list", "--reason", "website"]);
  assert.equal(r.out.length, 1);
  assert.match(r.out[0], new RegExp(B));
  r = await runMain(["--store", store, "show", A]);
  assert.equal(r.code, 0);
  r = await runMain(["--store", store, "unpin", A]);
  assert.equal(r.code, 0);
  assert.match(r.out[0], /unpinned/);
  r = await runMain(["--store", store, "show", A]);
  assert.equal(r.code, 1);
});

test("CLI rejects invalid CIDs, missing reasons and unknown commands", async () => {
  const store = await storePath();
  assert.equal((await runMain(["--store", store, "pin", "nope", "--reason", "x"])).code, 1);
  assert.equal((await runMain(["--store", store, "pin", A])).code, 1);
  assert.equal((await runMain(["--store", store, "frobnicate"])).code, 1);
  assert.equal((await runMain([])).code, 1);
});

test("CLI stats reports count, size and pins by reason", async () => {
  const store = await storePath();
  await runMain(["--store", store, "pin", A, "--reason", "backup", "--size", "100"]);
  await runMain(["--store", store, "pin", B, "--reason", "website"]);
  const r = await runMain(["--store", store, "stats"]);
  assert.equal(r.code, 0);
  const stats = JSON.parse(r.out.join("\n"));
  assert.equal(stats.pins, 2);
  assert.equal(stats.totalSizeBytes, 100);
  assert.equal(stats.sizeComplete, false);
  assert.deepEqual(stats.byReason, { backup: 1, website: 1 });
});

test("CLI works as a real subprocess (node src/cli.js)", async () => {
  const store = await storePath();
  const { stdout } = await run("node", ["src/cli.js", "--store", store, "pin", A, "--reason", "backup"]);
  assert.match(stdout, /"cid":"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"/);
  const { stdout: list } = await run("node", ["src/cli.js", "--store", store, "list"]);
  assert.match(list, /backup/);
});

const C_CLI = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH";

async function writeTmpFile(dir, name, content) {
  const { writeFile } = await import("node:fs/promises");
  const path = join(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

test("CLI verify reports ok/missing/extra and rejects malformed pinsets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ipm-verify-"));
  const store = join(dir, "pins.json");
  await runMain(["--store", store, "pin", A, "--reason", "backup"]);
  await runMain(["--store", store, "pin", B, "--reason", "website"]);
  const pinset = await writeTmpFile(dir, "pinset.txt", `${A} recursive\n${C_CLI} direct\n`);
  const r = await runMain(["--store", store, "verify", "--pinset", pinset]);
  assert.equal(r.code, 0);
  const report = JSON.parse(r.out.join("\n"));
  assert.deepEqual(report.ok, [A]);
  assert.deepEqual(report.missing, [B]);
  assert.deepEqual(report.extra, [C_CLI]);
  const bad = await writeTmpFile(dir, "bad.txt", `${A}\nnot-a-cid\n`);
  assert.equal((await runMain(["--store", store, "verify", "--pinset", bad])).code, 1);
  assert.equal((await runMain(["--store", store, "verify"])).code, 1);
});

test("CLI gc plans orphans, writes a review script, prunes dangling pins", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ipm-gc-"));
  const store = join(dir, "pins.json");
  await runMain(["--store", store, "pin", A, "--reason", "backup"]);
  await runMain(["--store", store, "pin", B, "--reason", "website"]);
  const pinset = await writeTmpFile(dir, "pinset.txt", `${A} recursive\n${C_CLI} direct\n`);
  const sizes = await writeTmpFile(dir, "sizes.json", JSON.stringify({ [C_CLI]: 4096 }));
  const script = join(dir, "sweep.sh");
  const r = await runMain(["--store", store, "gc", "--pinset", pinset, "--sizes", sizes, "--script", script]);
  assert.equal(r.code, 0);
  const plan = JSON.parse(r.out.filter((l) => !l.startsWith("wrote GC script")).join("\n"));
  assert.deepEqual(plan.candidates, [C_CLI]);
  assert.equal(plan.reclaimableBytes, 4096);
  assert.equal(plan.sizeComplete, true);
  const { readFile } = await import("node:fs/promises");
  assert.match(await readFile(script, "utf8"), new RegExp(`ipfs pin rm ${C_CLI}`));
  // Prune: B is missing from the node, so it leaves the registry; A stays.
  const r2 = await runMain(["--store", store, "gc", "--pinset", pinset, "--prune-dangling"]);
  assert.deepEqual(JSON.parse(r2.out.join("\n")).prunedDangling, [B]);
  assert.equal((await runMain(["--store", store, "show", B])).code, 1);
  assert.equal((await runMain(["--store", store, "show", A])).code, 0);
});
