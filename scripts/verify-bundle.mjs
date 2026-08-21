#!/usr/bin/env node
/**
 * Post-build checks: syntax validation + asset size budget (Sprint M).
 * Usage: npm run check:bundle (after build:web)
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'apps/web/dist/assets');

const MAIN_CHUNK_MAX_KB = 700;
const TOTAL_JS_MAX_KB = 1200;

let failed = false;
function fail(msg) {
  console.error(`✖ ${msg}`);
  failed = true;
}
function ok(msg) {
  console.log(`✓ ${msg}`);
}

if (!fs.existsSync(assetsDir)) {
  fail(`Assets dir missing: ${assetsDir} — run npm run build:web first`);
  process.exit(1);
}

const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
if (jsFiles.length === 0) {
  fail('No JS files in dist/assets');
  process.exit(1);
}

let totalBytes = 0;
let mainChunkBytes = 0;
let mainChunkName = '';

for (const file of jsFiles) {
  const full = path.join(assetsDir, file);
  const stat = fs.statSync(full);
  totalBytes += stat.size;

  if (file.startsWith('index-') && stat.size > mainChunkBytes) {
    mainChunkBytes = stat.size;
    mainChunkName = file;
  }

  try {
    execSync(`node --check "${full}"`, { stdio: 'pipe' });
    ok(`syntax OK: ${file}`);
  } catch (e) {
    fail(`syntax error in ${file}: ${e.message}`);
  }
}

const mainKb = Math.round(mainChunkBytes / 1024);
const totalKb = Math.round(totalBytes / 1024);

if (mainChunkName) {
  if (mainKb <= MAIN_CHUNK_MAX_KB) {
    ok(`main chunk ${mainChunkName}: ${mainKb} KB (budget ${MAIN_CHUNK_MAX_KB} KB)`);
  } else {
    fail(`main chunk ${mainChunkName}: ${mainKb} KB exceeds budget ${MAIN_CHUNK_MAX_KB} KB`);
  }
} else {
  fail('No index-*.js main chunk found');
}

if (totalKb <= TOTAL_JS_MAX_KB) {
  ok(`total JS: ${totalKb} KB (budget ${TOTAL_JS_MAX_KB} KB)`);
} else {
  fail(`total JS: ${totalKb} KB exceeds budget ${TOTAL_JS_MAX_KB} KB`);
}

if (failed) process.exit(1);
console.log('\nBundle checks passed.');
