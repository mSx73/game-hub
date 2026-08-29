#!/usr/bin/env node
/**
 * TLS certificate expiry warning (Sprint R).
 * Usage: node scripts/check-tls-expiry.mjs [hostname]
 * Warns if cert expires within WARN_DAYS (default 14).
 */
import tls from 'tls';

const host = process.argv[2] || 'playfofun.duckdns.org';
const port = Number(process.env.TLS_PORT || 443);
const WARN_DAYS = Number(process.env.TLS_WARN_DAYS || 14);

function daysUntil(date) {
  return (date.getTime() - Date.now()) / (86400 * 1000);
}

const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true }, () => {
  const cert = socket.getPeerCertificate();
  socket.end();
  if (!cert?.valid_to) {
    console.error('No certificate info');
    process.exit(2);
  }
  const expiry = new Date(cert.valid_to);
  const days = daysUntil(expiry);
  console.log(`${host}: expires ${expiry.toISOString()} (${Math.floor(days)} days)`);
  if (days <= WARN_DAYS) {
    console.error(`WARNING: certificate expires in ${Math.floor(days)} days`);
    process.exit(1);
  }
});

socket.on('error', (e) => {
  console.error(`TLS check failed: ${e.message}`);
  process.exit(2);
});

setTimeout(() => {
  console.error('TLS check timeout');
  process.exit(2);
}, 15000);
