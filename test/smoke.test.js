import test from "node:test";
import assert from "node:assert/strict";
import { VERSION } from "../src/index.js";

test("version is set", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});
