import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateCodePoints } from "../src/sanitize.js";

test("truncateCodePoints keeps astral pairs intact at boundary", () => {
  // "한국어😀😀" → 5 code points: 한, 국, 어, 😀, 😀 (last two are 2 UTF-16 units each)
  const input = "한국어😀😀";
  assert.equal(truncateCodePoints(input, 4), "한국어😀");
  assert.equal(truncateCodePoints(input, 5), "한국어😀😀");
  assert.equal(truncateCodePoints(input, 10), "한국어😀😀");
});

test("truncateCodePoints returns empty for non-strings", () => {
  assert.equal(truncateCodePoints(null, 5), "");
  assert.equal(truncateCodePoints(undefined, 5), "");
});
