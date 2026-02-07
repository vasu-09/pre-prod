#!/usr/bin/env node
const { spawn } = require('node:child_process');
const os = require('node:os');

const detectLanIPv4 = () => {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const [name, entries] of Object.entries(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) continue;
      if (!entry.address || entry.address.startsWith('169.254.')) continue; // ignore link-local
      candidates.push({ name, address: entry.address });
    }
  }

  if (!candidates.length) {
    return null;
  }

  const preferredOrder = ['wifi', 'wi-fi', 'wlan', 'eth', 'en', 'ethernet'];
  const score = (name = '') => {
    const lower = name.toLowerCase();
    const idx = preferredOrder.findIndex((prefix) => lower.startsWith(prefix));
    return idx === -1 ? preferredOrder.length : idx;
  };

  candidates.sort((a, b) => score(a.name) - score(b.name));
  return candidates[0].address;
};

const ensureApiBaseUrl = (env) => {
  if (env.EXPO_PUBLIC_API_URL && env.EXPO_PUBLIC_API_URL.trim()) {
    console.log(`[start-tunnel] Using existing EXPO_PUBLIC_API_URL=${env.EXPO_PUBLIC_API_URL}`);
    return;
  }

  const ip = detectLanIPv4();
  if (!ip) {
    console.warn('[start-tunnel] Could not detect a LAN IPv4 address. Set EXPO_PUBLIC_API_URL manually.');
    return;
  }

  const port = env.EXPO_PUBLIC_API_PORT || '8080';
  env.EXPO_PUBLIC_API_URL = `http://${ip}:${port}`;
  console.log(`[start-tunnel] Detected LAN IP ${ip}. Using EXPO_PUBLIC_API_URL=${env.EXPO_PUBLIC_API_URL}`);
};

const run = () => {
  const env = { ...process.env };
  ensureApiBaseUrl(env);

  const userArgs = process.argv.slice(2);
  const expoArgs = userArgs.length ? userArgs : ['start', '-c', '--tunnel'];
  const npxArgs = ['expo', ...expoArgs];

  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(command, npxArgs, { stdio: 'inherit', env });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
};

run();