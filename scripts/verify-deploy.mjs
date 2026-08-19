#!/usr/bin/env node
/**
 * Post-deploy smoke: health checks + bundle integrity (Sprint Q).
 * Usage: BASE_URL=https://playfofun.duckdns.org node scripts/verify-deploy.mjs
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = (process.env.BASE_URL || 'https://playfofun.duckdns.org').replace(/\/$/, '');
const DIST = path.join(root, 'apps/web/dist');

let failed = false;
function fail(msg) {
  console.error(`✖ ${msg}`);
  failed = true;
}
function ok(msg) {
  console.log(`✓ ${msg}`);
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  return { res, text: await res.text() };
}

try {
  const health = await fetch(`${BASE}/api/health`);
  if (health.ok) ok(`API health: ${health.status}`);
  else fail(`API health failed: ${health.status}`);
} catch (e) {
  fail(`API health unreachable: ${e.message}`);
}

try {
  const { res, text } = await fetchText(`${BASE}/`);
  if (res.ok && (text.includes('<!DOCTYPE html') || text.includes('<html'))) ok('Homepage HTML OK');
  else fail(`Homepage bad response: ${res.status}`);
} catch (e) {
  fail(`Homepage unreachable: ${e.message}`);
}

try {
  const missing = await fetch(`${BASE}/assets/nonexistent-chunk-deadbeef.js`);
  if (missing.status === 404) ok('Missing asset returns 404 (not index.html)');
  else fail(`Missing asset returned ${missing.status} — nginx regression risk`);
} catch (e) {
  fail(`Asset 404 check failed: ${e.message}`);
}

const indexPath = path.join(DIST, 'index.html');
if (fs.existsSync(indexPath)) {
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const scripts = [...indexHtml.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  for (const src of scripts) {
    const localFile = path.join(DIST, src.replace(/^\//, ''));
    try {
      const remote = await fetch(`${BASE}${src}`);
      if (!remote.ok) {
        fail(`Remote chunk ${src}: HTTP ${remote.status}`);
        continue;
      }
      const remoteLen = Number(remote.headers.get('content-length') || 0);
      if (fs.existsSync(localFile)) {
        const localSize = fs.statSync(localFile).size;
        if (remoteLen > 0 && remoteLen !== localSize) {
          fail(`Chunk size mismatch ${src}: remote ${remoteLen} vs local ${localSize}`);
        } else {
          ok(`Chunk ${path.basename(src)}: ${localSize} bytes`);
        }
        execSync(`node --check "${localFile}"`, { stdio: 'pipe' });
      }
    } catch (e) {
      fail(`Chunk verify ${src}: ${e.message}`);
    }
  }
} else {
  console.log('○ Local dist/index.html missing — skip chunk compare');
}

if (failed) process.exit(1);
console.log('\nDeploy verification passed.');
