import { createHash } from "node:crypto";

/**
 * How many sessions with the same opening prompt it takes to call them a
 * template rather than coincidence. A person rarely starts three sessions with
 * the same words; a hook or script that runs `codex exec "Review this change..."`
 * on every commit does it all day.
 */
export const DEFAULT_MIN_REPEATS = 3;

/**
 * The title is the first prompt cut to 80 code points. Grouping on it rather
 * than the full prompt matters: a templated prompt usually goes on to list the
 * changed files, so the full text differs every run while the opening is fixed.
 */
function groupKey(session) {
  return `${session.provider}\u0000${session.projectKey}\u0000${session.title}`;
}

function stableKey(key) {
  return `repeat-${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
}

function byLastActivity(a, b) {
  return String(a.lastActivityAt ?? "").localeCompare(String(b.lastActivityAt ?? ""));
}

/**
 * Folds runs of the same templated prompt into one session per project, keyed
 * so that every later run refreshes that one thread instead of adding another.
 * The newest run supplies the content; the group keeps the earliest start.
 */
export function collapseRepeatedPrompts(sessions, { minRepeats } = {}) {
  // Two is the floor: at one, every session would be "repeated".
  const threshold = Number.isInteger(minRepeats) && minRepeats >= 2 ? minRepeats : DEFAULT_MIN_REPEATS;
  const groups = new Map();
  const out = [];
  for (const session of sessions) {
    // No prompt means the title is the "<project> session <date>" placeholder,
    // which says nothing about what ran. Sharing it is no sign of a template:
    // those are distinct sessions that just could not be named.
    if (!session.originalIntent) {
      out.push(session);
      continue;
    }
    const key = groupKey(session);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(session);
  }

  const collapsed = [];
  for (const [key, members] of groups) {
    if (members.length < threshold) {
      out.push(...members);
      continue;
    }
    const ordered = [...members].sort(byLastActivity);
    const latest = ordered[ordered.length - 1];
    const startedAt = ordered
      .map((s) => s.startedAt)
      .filter(Boolean)
      .sort()[0] ?? latest.startedAt;
    const providerSessionKey = stableKey(key);
    out.push({
      ...latest,
      providerSessionKey,
      startedAt,
      metadata: {
        ...latest.metadata,
        repeatedPrompt: true,
        repeatCount: members.length,
        latestSessionKey: latest.providerSessionKey,
      },
    });
    collapsed.push({
      provider: latest.provider,
      projectKey: latest.projectKey,
      title: latest.title,
      count: members.length,
      providerSessionKey,
    });
  }
  return { sessions: out, collapsed };
}
