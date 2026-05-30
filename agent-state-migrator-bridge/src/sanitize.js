export function truncateCodePoints(value, max) {
  if (typeof value !== "string") return "";
  const codePoints = Array.from(value);
  if (codePoints.length <= max) return value;
  return codePoints.slice(0, max).join("");
}

const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function replaceLoneSurrogates(value) {
  if (typeof value !== "string") return "";
  return value.replace(LONE_SURROGATE_RE, "�");
}
