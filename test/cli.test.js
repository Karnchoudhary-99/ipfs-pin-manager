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

test("CLI works as a real subprocess (node src/cli.js)", async () => {
  const store = await storePath();
  const { stdout } = await run("node", ["src/cli.js", "--store", store, "pin", A, "--reason", "backup"]);
  assert.match(stdout, /"cid":"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"/);
  const { stdout: list } = await run("node", ["src/cli.js", "--store", store, "list"]);
  assert.match(list, /backup/);
});
