const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let envLoaded = false;

const loadEnvFile = () => {
  if (envLoaded) {
    return;
  }

  envLoaded = true;
  const envPath = path.join(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const [key, ...rest] = line.split('=');
      if (!key) {
        return;
      }

      const value = rest.join('=').trim();
      if (value && process.env[key] === undefined) {
        const normalized = value.replace(/^['"]|['"]$/g, '');
        process.env[key] = normalized;
      }
    });
};

const detectLanIPv4 = () => {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) continue;
      if (!entry.address || entry.address.startsWith('169.254.')) continue;
      candidates.push(entry.address);
    }
  }

  return candidates[0] ?? null;
};

const normalizeHost = (value) => {
  if (!value) return null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  try {
    const prefixed = trimmed.match(/^[a-zA-Z]+:\/\//) ? trimmed : `http://${trimmed}`;
    const parsed = new URL(prefixed);
    return parsed.hostname || null;
  } catch {
    return trimmed.split(':')[0];
  }
};

const isExpoHosted = (host) => {
  if (!host) return false;
  return host === 'exp.host' || host === 'u.expo.dev' || host.endsWith('.expo.dev') || host.endsWith('.exp.direct');
};

const buildBaseUrlFromHost = (host, port) => {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) {
    return null;
  }

  const normalizedPort = String(port || '').trim();
  const hasPort = Boolean(normalizedPort);
  const portSuffix = hasPort ? `:${normalizedPort}` : '';

  return `http://${normalizedHost}${portSuffix}`;
};

const getExpoDevHost = () => {
  // Expo sets these when running through `expo start`.
  const envCandidates = [process.env.EXPO_DEV_SERVER_HOST, process.env.EXPO_SERVER_HOSTNAME];

  for (const candidate of envCandidates) {
    const host = normalizeHost(candidate);
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !isExpoHosted(host)) {
      return host;
    }
  }

  return null;
};

const inferDevApiBaseUrl = () => {
  const isBuild = process.env.EAS_BUILD === 'true' || process.env.CI === 'true';
  const isProduction = process.env.NODE_ENV === 'production';
  if (isBuild || isProduction) {
    return null;
  }

  const expoDevHost = getExpoDevHost();
  if (expoDevHost) {
    const port = process.env.EXPO_PUBLIC_API_PORT || '8080';
    const url = `http://${expoDevHost}:${port}`;
    console.log(`[app.config] Using Expo dev host for EXPO_PUBLIC_API_URL: ${url}`);
    return url;
  }

  const ip = detectLanIPv4();
  if (!ip) {
    console.warn('[app.config] Could not detect LAN IPv4. Set EXPO_PUBLIC_API_URL manually.');
    return null;
  }

  const port = process.env.EXPO_PUBLIC_API_PORT || '8080';
  const url = `http://${ip}:${port}`;
  console.log(`[app.config] Defaulting EXPO_PUBLIC_API_URL to ${url}`);
  return url;
};

module.exports = () => {
  const { expo } = require('./app.json');
  loadEnvFile();

  let apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || expo?.extra?.apiBaseUrl || '';

  if (!apiBaseUrl && process.env.EXPO_PUBLIC_API_HOST) {
    const built = buildBaseUrlFromHost(process.env.EXPO_PUBLIC_API_HOST, process.env.EXPO_PUBLIC_API_PORT || '8080');
    if (built) {
      apiBaseUrl = built;
      console.log(`[app.config] Using EXPO_PUBLIC_API_HOST for EXPO_PUBLIC_API_URL: ${apiBaseUrl}`);
    }
  }

  if (!apiBaseUrl) {
    apiBaseUrl = inferDevApiBaseUrl() || '';
  }

  return {
    ...expo,
    extra: {
      ...expo?.extra,
      apiBaseUrl,
      apiHost: process.env.EXPO_PUBLIC_API_HOST || '',
      apiPort: process.env.EXPO_PUBLIC_API_PORT || '',
      mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || expo?.extra?.mapboxToken || '',
    },
  };
};