export function truncateCodePoints(value, max) {
  if (typeof value !== "string") return "";
  const codePoints = Array.from(value);
  if (codePoints.length <= max) return value;
  return codePoints.slice(0, max).join("");
}
