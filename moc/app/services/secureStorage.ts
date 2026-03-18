export type StorageDriver = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
};

export type StorageHandler = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export const normalizeSecureStoreKey = (key: string) => {
  const trimmed = key.trim();
  const normalized = trimmed.replace(/[^A-Za-z0-9._-]/g, '_');

  if (!normalized) {
    throw new Error('Invalid SecureStore key: key is empty after normalization');
  }

  return normalized;
};

type IntegrityMeta = {
  length?: number;
  hash?: string;
  chunkCount?: number;
};

const CHUNK_PREFIX = '__chunked__:';
const DEFAULT_CHUNK_SIZE = 1800;

const chunkValue = (value: string, size: number) => {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    parts.push(value.slice(i, i + size));
  }
  return parts;
};

const parseMeta = (raw: string | null): IntegrityMeta | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const meta: IntegrityMeta = {};
    if (typeof parsed.length === 'number') {
      meta.length = parsed.length;
    }
    if (typeof parsed.hash === 'string') {
      meta.hash = parsed.hash;
    }
    if (typeof parsed.chunkCount === 'number') {
      meta.chunkCount = parsed.chunkCount;
    }

    return meta;
  } catch {
    return null;
  }
};

const digestValue = async (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const metaKeyFor = (key: string) => `${key}-meta`;

const deleteChunkParts = async (driver: StorageDriver, key: string) => {
  let index = 1;
  // Continue deleting until no more part keys are found.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const partKey = `${key}-part-${index}`;
    const existing = await driver.getItem(partKey);
    if (!existing) {
      break;
    }
    await driver.deleteItem(partKey);
    index += 1;
  }
};

export const createIntegrityStorage = (
  driver: StorageDriver,
  options?: {
    normalizeKey?: (key: string) => string;
    chunkSize?: number;
  },
): StorageHandler => {
  const normalizeKey = options?.normalizeKey ?? (key => key);
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;

  const setItem = async (key: string, value: string): Promise<void> => {
    const normalized = normalizeKey(key);
    const metaKey = metaKeyFor(normalized);
    const hash = await digestValue(value);
    const meta: IntegrityMeta = {
      length: value.length,
      hash,
    };

    if (chunkSize > 0 && value.length > chunkSize) {
      await deleteChunkParts(driver, normalized);
      const parts = chunkValue(value, chunkSize);
      const partPromises = parts.map((part, idx) =>
        driver.setItem(`${normalized}-part-${idx + 1}`, part),
      );
      await Promise.all(partPromises);
      meta.chunkCount = parts.length;
      await driver.setItem(normalized, `${CHUNK_PREFIX}${parts.length}`);
    } else {
      await deleteChunkParts(driver, normalized);
      await driver.setItem(normalized, value);
      meta.chunkCount = 0;
    }

    await driver.setItem(metaKey, JSON.stringify(meta));
  };

  const removeItem = async (key: string): Promise<void> => {
    const normalized = normalizeKey(key);
    const metaKey = metaKeyFor(normalized);
    await deleteChunkParts(driver, normalized);
    await driver.deleteItem(metaKey);
    await driver.deleteItem(normalized);
  };

  const getItem = async (key: string): Promise<string | null> => {
    const normalized = normalizeKey(key);
    const metaKey = metaKeyFor(normalized);

    const [metaRaw, base] = await Promise.all([
      driver.getItem(metaKey),
      driver.getItem(normalized),
    ]);

    if (!base) {
      await driver.deleteItem(metaKey);
      await deleteChunkParts(driver, normalized);
      return null;
    }

    const meta = parseMeta(metaRaw);
    let chunkCountFromBase: number | null = null;
    if (base.startsWith(CHUNK_PREFIX)) {
      const parsed = Number(base.slice(CHUNK_PREFIX.length));
      chunkCountFromBase = Number.isFinite(parsed) ? parsed : null;
    }

    if (chunkCountFromBase === null && base.startsWith(CHUNK_PREFIX)) {
      await removeItem(key);
      return null;
    }

    const expectedChunkCount = meta?.chunkCount ?? chunkCountFromBase ?? 0;
    let value: string | null = null;

    if (expectedChunkCount > 0) {
      const parts: (string | null)[] = await Promise.all(
        Array.from({ length: expectedChunkCount }).map((_, idx) =>
          driver.getItem(`${normalized}-part-${idx + 1}`),
        ),
      );

      if (parts.some(part => part == null)) {
        await removeItem(key);
        return null;
      }

      value = parts.join('');
    } else {
      value = base;
    }

    const digest = await digestValue(value);
    const lengthMatches = !meta?.length || meta.length === value.length;
    const hashMatches = !meta?.hash || meta.hash === digest;

    if (!lengthMatches || !hashMatches) {
      await removeItem(key);
      return null;
    }

    if (!meta) {
      await driver.setItem(
        metaKey,
        JSON.stringify({ length: value.length, hash: digest, chunkCount: expectedChunkCount }),
      );
    }

    return value;
  };

  return {
    getItem,
    setItem,
    removeItem,
  };
};