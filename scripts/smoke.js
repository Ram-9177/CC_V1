#!/usr/bin/env node
/*
  Simple backend + realtime smoke test
  Env (auto-loads from .env if present):
    SMOKE_API_URL (e.g., https://api.example.com)
    SMOKE_WS_URL (e.g., wss://ws.example.com)
    SMOKE_AUTH_TOKEN (optional JWT for protected checks)
  Fallbacks: if SMOKE_* not set, uses VITE_API_URL / VITE_WS_URL when present.
*/

const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Load .env if available (no external deps)
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const text = fs.readFileSync(envPath, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const k = m[1];
        let v = m[2].replace(/^['"]|['"]$/g, '');
        if (!(k in process.env)) process.env[k] = v;
      }
    }
  } catch {}

  const API = process.env.SMOKE_API_URL || process.env.VITE_API_URL;
  const API_PREFIX = process.env.SMOKE_API_PREFIX || '';
  const WS = process.env.SMOKE_WS_URL || process.env.VITE_WS_URL;
  const TOKEN = process.env.SMOKE_AUTH_TOKEN;

  let failures = 0;
  function fail(msg) { console.error(`✗ ${msg}`); failures++; }
  function pass(msg) { console.log(`✓ ${msg}`); }

  if (!API || !WS) {
    console.error('Missing env. Please set SMOKE_API_URL and SMOKE_WS_URL (or VITE_API_URL and VITE_WS_URL).');
    process.exit(2);
  }

  // Small helper to build API URLs with optional prefix
  const buildApi = (p) => {
    const base = (API || '').replace(/\/+$/, '');
    const pref = (API_PREFIX || '').replace(/^\/+|\/+$/g, '');
    const path = (p || '').replace(/^\/+/, '');
    return pref ? `${base}/${pref}/${path}` : `${base}/${path}`;
  };

  // 1) API health
  try {
    const url = buildApi('/health');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pass(`API health OK (${url})`);
  } catch (e) {
    fail(`API health failed: ${e.message}`);
  }

  // 2) Auth check (optional)
  if (TOKEN) {
    try {
      const url = buildApi('/auth/me');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const me = await res.json();
      pass(`Auth /me OK: ${me?.hallticket || me?.id || 'user'}`);
    } catch (e) {
      fail(`/auth/me failed: ${e.message}`);
    }
  } else {
    console.log('ℹ No SMOKE_AUTH_TOKEN supplied; skipping /me check.');
  }

  // 3) WebSocket connect
  try {
    const socket = io(WS, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 5000,
      auth: TOKEN ? { token: `Bearer ${TOKEN}` } : undefined,
    });

    const result = await new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        socket.disconnect();
        resolve({ ok: false, error: 'timeout' });
      }, 7000);

      socket.on('connect', () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ ok: true });
        socket.disconnect();
      });

      socket.on('connect_error', (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ ok: false, error: err?.message || 'connect_error' });
        socket.disconnect();
      });
    });

    if (result.ok) pass(`WS connect OK (${WS})`);
    else fail(`WS connect failed: ${result.error}`);
  } catch (e) {
    fail(`WS connect threw: ${e.message}`);
  }

  // 4) Optional: simple protected resource checks
  if (TOKEN) {
    try {
      const url = buildApi('/notices/my');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.json();
      pass('Protected endpoint /notices/my OK');
    } catch (e) {
      console.warn('ℹ Skipping /notices/my check (optional):', e.message);
    }
  }

  if (failures > 0) {
    console.error(`Smoke test FAILED with ${failures} issue(s).`);
    process.exit(1);
  } else {
    console.log('All smoke checks passed.');
  }
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
