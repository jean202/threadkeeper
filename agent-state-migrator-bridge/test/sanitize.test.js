import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateCodePoints, replaceLoneSurrogates } from "../src/sanitize.js";

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

test("replaceLoneSurrogates replaces unpaired high surrogate with U+FFFD", () => {
  // \uD83D alone is a lone high surrogate (paired with \uDE00 it would be 😀)
  const input = "ok\uD83Dend";
  assert.equal(replaceLoneSurrogates(input), "ok�end");
});

test("replaceLoneSurrogates replaces unpaired low surrogate with U+FFFD", () => {
  const input = "ok\uDE00end";
  assert.equal(replaceLoneSurrogates(input), "ok�end");
});

test("replaceLoneSurrogates preserves valid surrogate pairs", () => {
  const input = "smile 😀 here";
  assert.equal(replaceLoneSurrogates(input), "smile 😀 here");
});

test("replaceLoneSurrogates handles non-string input", () => {
  assert.equal(replaceLoneSurrogates(null), "");
  assert.equal(replaceLoneSurrogates(undefined), "");
});
