/**
 * End-to-end smoke test against a running stack.
 *
 * The vitest suite mocks the API client, so it proves the pages behave given a
 * response shape -- but not that the shape is what the API really sends. That
 * gap is where the original bugs lived. This script drives the real UI against
 * a real API and asserts the resulting server state.
 *
 * Needs postgres, the API on :8080 and the web app on :3000, plus a Chromium
 * that playwright-core can launch:
 *
 *   PLAYWRIGHT_CHROMIUM=/path/to/chrome node e2e/smoke.mjs
 */
import { chromium } from 'playwright-core';

const API = process.env.API_URL ?? 'http://localhost:8080/api/v1';
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM;

const problems = [];
const errors = [];
const check = (ok, message) => {
  if (!ok) problems.push(message);
};

const browser = await chromium.launch({
  ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
  args: ['--no-sandbox'],
});
const page = await (await browser.newContext()).newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  // The app ships no favicon; that 404 is not a failure.
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`);
});

// 1. Create a thread through the form.
await page.goto(`${WEB}/threads/new`, { waitUntil: 'networkidle' });
const title = `smoke ${Date.now()}`;
await page.fill('#projectKey', 'threadkeeper');
await page.fill('#title', title);
await page.selectOption('#priority', 'HIGH');
await page.fill('#originalIntent', 'Implement billing webhook retry logic');
await page.fill('#todayGoal', 'Ship retries');
await page.fill('#doneCondition', 'Retries land');
await page.click('button[type=submit]');
await page.waitForURL(/\/threads\/\d+$/, { timeout: 20000 });
const threadId = Number(page.url().match(/(\d+)$/)[1]);
console.log(`created thread #${threadId}`);

// 2. Pin a next action, record progress, and hand off.
await page.fill('#nextAction', 'Verify persistence');
await page.click('button:has-text("Pin Next Action")');
await page.waitForTimeout(1000);
await page.fill('#progressNote', 'Added retry backoff to the billing webhook handler.');
await page.click('button:has-text("Add Snapshot")');
await page.waitForTimeout(1000);
await page.selectOption('#targetProvider', 'CODEX');
await page.click('button:has-text("Create Handoff")');
await page.waitForTimeout(1000);

let thread = await (await fetch(`${API}/threads/${threadId}`)).json();
check(thread.currentNextAction === 'Verify persistence', 'next action not persisted');
check(thread.snapshots.length >= 1, 'snapshot not persisted');
check(thread.handoffs.some((h) => h.targetProvider === 'CODEX'), 'handoff not persisted');
check(thread.driftStatus === 'ON_TRACK', `on-topic work should stay ON_TRACK, got ${thread.driftStatus}`);
console.log(`after progress: drift=${thread.driftStatus} score=${thread.driftScore}`);

// 3. Drift away from the original intent and confirm the warning appears.
for (const summary of [
  'Renamed components and reworked the css theme.',
  'More unrelated cleanup of the sidebar layout.',
  'Tweaked spacing tokens across the design system.',
]) {
  await page.fill('#progressNote', summary);
  await page.click('button:has-text("Add Snapshot")');
  await page.waitForTimeout(800);
}
thread = await (await fetch(`${API}/threads/${threadId}`)).json();
check(thread.driftStatus === 'DRIFTING', `unrelated work should drift, got ${thread.driftStatus}`);
const detailText = await page.innerText('body');
check(detailText.includes('Drifting'), 'detail page does not show the drift warning');
console.log(`after drifting: drift=${thread.driftStatus} score=${thread.driftScore}`);

// 4. The Today dashboard should link to the thread.
await page.goto(`${WEB}/today`, { waitUntil: 'networkidle' });
check(
  (await page.locator(`a[href="/threads/${threadId}"]`).count()) > 0,
  'Today does not link to the thread',
);

// 5. Complete it.
await page.goto(`${WEB}/threads/${threadId}`, { waitUntil: 'networkidle' });
await page.click('button:has-text("Mark Completed")');
await page.waitForTimeout(1200);
thread = await (await fetch(`${API}/threads/${threadId}`)).json();
check(thread.status === 'COMPLETED', 'status not COMPLETED');
check(thread.completedAt !== null, 'completedAt not set');
console.log(`completed: status=${thread.status} drift=${thread.driftStatus}`);

// 6. Settings screens load against the real API.
for (const path of ['/settings/notifications', '/settings/providers']) {
  await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  check(!(await page.innerText('body')).includes('Error:'), `${path} reported an error`);
}

await browser.close();

if (errors.length) console.log('console/page errors:', errors);
if (problems.length) {
  console.error(`\nFAILED: ${problems.join('; ')}`);
  process.exit(1);
}
console.log('\nSMOKE PASSED');
