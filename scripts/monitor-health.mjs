#!/usr/bin/env node
/**
 * Uptime / health monitor — cron-friendly (Sprint R).
 * Usage: npm run monitor:health
 * Exit 1 if any check fails.
 */
const BASE = (process.env.BASE_URL || 'https://playfofun.duckdns.org').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 15000);

let failed = 0;

async function check(name, url, predicate) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    const ok = predicate(res, await res.text().catch(() => ''));
    if (ok) console.log(`OK  ${name}`);
    else {
      console.error(`FAIL ${name} — HTTP ${res.status}`);
      failed += 1;
    }
  } catch (e) {
    console.error(`FAIL ${name} — ${e.message}`);
    failed += 1;
  } finally {
    clearTimeout(timer);
  }
}

await check('api-health', `${BASE}/api/health`, (r) => r.ok);
await check('homepage', `${BASE}/`, (r, body) => r.ok && body.includes('html'));
await check('asset-404-guard', `${BASE}/assets/__health_probe_missing__.js`, (r) => r.status === 404);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll health checks passed.');
