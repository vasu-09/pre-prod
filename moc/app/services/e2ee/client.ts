import { Platform } from 'react-native';

import {
  claimPrekey,
  getPrekeyStock,
  listDeviceBundles,
  registerDevice,
  uploadPrekeys,
  type DeviceBundleResponse,
  type OneTimePrekeyPayload,
} from './api';
import { computeFromEphemeral, deriveEphemeral, generateDhKeyPair } from './dh';
import {
  generateKeyPair as generateEd25519KeyPair,
  sign as signEd25519,
  verify as verifyEd25519,
} from './ed25519';

import { base64ToBytes, bytesToBase64, bytesToUtf8, concatBytes, utf8ToBytes } from './encoding';
import { randomBytes, randomId } from './random';
import { sha256 } from './sha256';
import { DeviceState, PeerFingerprint, SentMessageKey, StoredPrekey, loadDeviceState, saveDeviceState } from './storage';

type Envelope = {
  messageId: string;
  aad: string;
  iv: string;
  ciphertext: string;
  keyRef: string;
};
type DecryptContext = {
  senderId?: number;
  senderDeviceId?: string | null;
  sessionId?: string | null;
};

type EncryptResult = {
  envelope: {
    e2eeVer: number;
    algo: string;
    aad: string;
    iv: string;
    ciphertext: string;
    keyRef: string;
  };
  sharedKey: string; // base64
};

const DEVICE_VERSION = 25;
const INITIAL_PREKEY_BATCH = 10;
const MIN_SERVER_STOCK = 5;
const CONSUMED_PREKEY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FINGERPRINT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const ensurePrekeysAvailable = (state: DeviceState, count: number): DeviceState => {
  const now = Date.now();
  const nextKeys = [...state.oneTimePrekeys];
  for (let i = 0; i < count; i += 1) {
    const kp = generateDhKeyPair();
    nextKeys.push({
      publicKey: kp.publicKey,
      privateKey: kp.privateKey,
      uploaded: false,
      createdAt: now,
    });
  }
  return {
    ...state,
    oneTimePrekeys: nextKeys,
  };
};

const rememberSentKey = (state: DeviceState, entry: SentMessageKey): DeviceState => {
  const existing = state.sentMessageKeys.filter(item => item.messageId !== entry.messageId);
  const next = [entry, ...existing];
  if (next.length > 200) {
    next.length = 200;
  }
  return {
    ...state,
    sentMessageKeys: next,
  };
};

const markPrekeyConsumed = (state: DeviceState, publicKey: string): DeviceState => {
  const now = Date.now();
  const updated = state.oneTimePrekeys.map(pk =>
    pk.publicKey === publicKey ? { ...pk, consumed: true, consumedAt: now } : pk,
  );
  const filtered = updated.filter(
    pk => !pk.consumedAt || pk.consumedAt >= now - CONSUMED_PREKEY_RETENTION_MS,
  );

  return {
    ...state,
    oneTimePrekeys: filtered,
  };
};

const buildFingerprint = (bundle: DeviceBundleResponse, timestamp: number): PeerFingerprint => ({
  deviceId: bundle.deviceId,
  identityKey: bundle.identityKeyPub,
  signedPrekey: bundle.signedPrekeyPub,
  updatedAt: timestamp,
});

const fingerprintsMatch = (
  bundle: DeviceBundleResponse,
  cached: PeerFingerprint | null | undefined
): cached is PeerFingerprint =>
  Boolean(
    cached &&
      cached.deviceId === bundle.deviceId &&
      cached.identityKey === bundle.identityKeyPub &&
      cached.signedPrekey === bundle.signedPrekeyPub
  );

const isFingerprintFresh = (cached: PeerFingerprint | null | undefined): cached is PeerFingerprint =>
  Boolean(cached && cached.updatedAt >= Date.now() - FINGERPRINT_TTL_MS);

const SIGNATURE_LENGTH = 64;
const KEY_LENGTH = 32;

const hasValidPrekeySignature = async (
  identityPubB64: string,
  prekeyPubB64: string,
  sigB64?: string | null
): Promise<boolean> => {
  if (!sigB64) return false;

  const sigBytes = base64ToBytes(sigB64);
  if (sigBytes.length !== SIGNATURE_LENGTH) return false;

  const pubBytes = base64ToBytes(identityPubB64);
  if (pubBytes.length !== KEY_LENGTH) return false;

  const message = base64ToBytes(prekeyPubB64);
  return verifyEd25519(message, sigBytes, pubBytes);
};

const signPrekey = async (
  identityPrivB64: string,
  prekeyPubB64: string
): Promise<string> => {
  const message = base64ToBytes(prekeyPubB64);
  const priv = base64ToBytes(identityPrivB64);

  // ed25519.sign is async
  const signature = await signEd25519(message, priv);

  return bytesToBase64(signature);
};

const normalizePeerFingerprints = (state: DeviceState): DeviceState => ({
  ...state,
  peerFingerprints: state.peerFingerprints ?? {},
});



const createDeviceState = async (): Promise<DeviceState> => {
  const deviceId = `dev-${randomId(20)}`;
  const identity = await generateEd25519KeyPair();
  const signedPrekey = generateDhKeyPair();
  const base: DeviceState = {
    version: DEVICE_VERSION,
    deviceId,
    identity: {
      publicKey:  bytesToBase64(identity.publicKey),
      privateKey: bytesToBase64(identity.privateKey),
    },
    signedPrekey: {
      publicKey: signedPrekey.publicKey,
      privateKey: signedPrekey.privateKey,
      signature: null,
    },
    oneTimePrekeys: [],
    sentMessageKeys: [],
    peerFingerprints: {},
  };
   const withPrekeys = ensurePrekeysAvailable(base, INITIAL_PREKEY_BATCH);
  const signature = await signPrekey(withPrekeys.identity.privateKey, withPrekeys.signedPrekey.publicKey);
  const withSignature: DeviceState = {
    ...withPrekeys,
    signedPrekey: { ...withPrekeys.signedPrekey, signature },
  };
  await saveDeviceState(withSignature);
  return withSignature;
};

const ensureSignedPrekeySignature = async (
  state: DeviceState
): Promise<DeviceState> => {
  try {
    const valid = await hasValidPrekeySignature(
      state.identity.publicKey,
      state.signedPrekey.publicKey,
      state.signedPrekey.signature
    );

    if (valid) {
      return state;
    }

    const signature = await signPrekey(
      state.identity.privateKey,
      state.signedPrekey.publicKey
    );

    const updated: DeviceState = {
      ...state,
      signedPrekey: {
        ...state.signedPrekey,
        signature,
      },
    };

    return updated;
  } catch (e) {
    console.warn('[E2EE] Failed to (re)sign signedPrekey', e);
    return state;
  }
};


const ensureDeviceState = async (): Promise<DeviceState> => {
  const current = await loadDeviceState();
  if (!current || current.version !== DEVICE_VERSION) {
    if (!current) {
      console.warn('[E2EE] Missing device state; generating a new device identity.');
    }
    return createDeviceState();
  }
  const withSignature = await ensureSignedPrekeySignature(current);
  return normalizePeerFingerprints(withSignature);
};

const toUploadablePrekeys = (prekeys: StoredPrekey[]): OneTimePrekeyPayload[] =>
  prekeys.map(k => ({
    prekeyId: k.prekeyId ?? null,
    prekeyPub: k.publicKey,
  }));

const registerIfNeeded = async (state: DeviceState): Promise<DeviceState> => {
  const pendingUpload = state.oneTimePrekeys.filter(pk => !pk.uploaded);
  if (state.lastRegisteredAt) {
    if (!pendingUpload.length) {
      return state;
    }

    const uploads = toUploadablePrekeys(pendingUpload);
    try {
      await uploadPrekeys(state.deviceId, uploads);
    } catch (err) {
      console.warn('[E2EE] Failed to upload prekeys', err);
      throw err;
    }
    const refreshed: DeviceState = {
      ...state,
      oneTimePrekeys: state.oneTimePrekeys.map(pk =>
        pendingUpload.find(item => item.publicKey === pk.publicKey)
          ? { ...pk, uploaded: true }
          : pk,
      ),
    };
    await saveDeviceState(refreshed);
    return refreshed;
  }
  try {
    await registerDevice({
      deviceId: state.deviceId,
      name: 'MoC Mobile',
      platform: Platform.OS,
      identityKeyPub: state.identity.publicKey,
      signedPrekeyPub: state.signedPrekey.publicKey,
      signedPrekeySig: state.signedPrekey.signature,
      oneTimePrekeys: toUploadablePrekeys(pendingUpload),
    });
  } catch (err) {
    console.warn('[E2EE] Failed to register device', err);
    throw err;
  }
  const updated: DeviceState = {
    ...state,
    oneTimePrekeys: state.oneTimePrekeys.map(pk => ({ ...pk, uploaded: true })),
    lastRegisteredAt: Date.now(),
  };
  await saveDeviceState(updated);
  return updated;
};

const replenishPrekeys = async (state: DeviceState): Promise<DeviceState> => {
  const stock = await getPrekeyStock(state.deviceId);
  if (stock >= MIN_SERVER_STOCK) {
    return state;
  }
  const needed = MIN_SERVER_STOCK - stock;
  const availableLocal = state.oneTimePrekeys.filter(pk => !pk.uploaded);
  let updated = state;
  if (availableLocal.length < needed) {
    updated = ensurePrekeysAvailable(updated, needed - availableLocal.length);
  }
  const toSend = updated.oneTimePrekeys.filter(pk => !pk.uploaded).slice(0, needed);
  if (toSend.length) {
    await uploadPrekeys(updated.deviceId, toUploadablePrekeys(toSend));
    updated = {
      ...updated,
      oneTimePrekeys: updated.oneTimePrekeys.map(pk =>
        toSend.find(item => item.publicKey === pk.publicKey)
          ? { ...pk, uploaded: true }
          : pk,
      ),
    };
  }
  return updated;
};

const deriveKeystream = (sharedKey: Uint8Array, nonce: Uint8Array, length: number): Uint8Array => {
  const blocks = Math.ceil(length / 32);
  const output = new Uint8Array(blocks * 32);
  const buffer = new Uint8Array(sharedKey.length + nonce.length + 4);
  buffer.set(sharedKey, 0);
  buffer.set(nonce, sharedKey.length);
  for (let counter = 0; counter < blocks; counter += 1) {
    buffer[buffer.length - 4] = (counter >>> 24) & 0xff;
    buffer[buffer.length - 3] = (counter >>> 16) & 0xff;
    buffer[buffer.length - 2] = (counter >>> 8) & 0xff;
    buffer[buffer.length - 1] = counter & 0xff;
    const digest = sha256(buffer);
    output.set(digest, counter * 32);
  }
  return output.slice(0, length);
};

const computeTag = (sharedKey: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array, aad: Uint8Array): Uint8Array => {
  const material = concatBytes(sharedKey, nonce, ciphertext, aad);
  return sha256(material);
};

const encodeMeta = (ephemeral: string, tagBase64?: string): Uint8Array => {
  const meta: Record<string, string> = { e: ephemeral };
  if (tagBase64) {
    meta.t = tagBase64;
  }
  return utf8ToBytes(JSON.stringify(meta));
};

const encryptPayload = (sharedKey: Uint8Array, plaintext: string, keyRef: string, ephemeral: string): EncryptResult => {
  const nonce = randomBytes(16);
  const plainBytes = utf8ToBytes(plaintext);
  const keystream = deriveKeystream(sharedKey, nonce, plainBytes.length);
  const cipher = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i += 1) {
    cipher[i] = plainBytes[i] ^ keystream[i];
  }
  const aadBase = encodeMeta(ephemeral);
  const tag = computeTag(sharedKey, nonce, cipher, aadBase);
  const aad = encodeMeta(ephemeral, bytesToBase64(tag));
  return {
    envelope: {
      e2eeVer: 1,
      algo: 'DH-SHA256-STREAM',
      aad: bytesToBase64(aad),
      iv: bytesToBase64(nonce),
      ciphertext: bytesToBase64(cipher),
      keyRef,
    },
    sharedKey: bytesToBase64(sharedKey),
  };
};

const decryptPayload = (sharedKey: Uint8Array, envelope: Envelope): string => {
  const aadBytes = base64ToBytes(envelope.aad ?? '');
  let meta: { e: string; t: string } | null = null;
  try {
    meta = JSON.parse(bytesToUtf8(aadBytes));
  } catch {
    throw new Error('Invalid metadata');
  }
  if (!meta || typeof meta.e !== 'string' || typeof meta.t !== 'string') {
    throw new Error('Malformed metadata');
  }
  const nonce = base64ToBytes(envelope.iv ?? '');
  const cipher = base64ToBytes(envelope.ciphertext ?? '');
  const expectedTag = base64ToBytes(meta.t);
  const baseMeta = encodeMeta(meta.e);
  const actualTag = computeTag(sharedKey, nonce, cipher, baseMeta);
  if (expectedTag.length !== actualTag.length) {
    throw new Error('Tag mismatch');
  }
  for (let i = 0; i < expectedTag.length; i += 1) {
    if (expectedTag[i] !== actualTag[i]) {
      throw new Error('Tag verification failed');
    }
  }
  const keystream = deriveKeystream(sharedKey, nonce, cipher.length);
  const plain = new Uint8Array(cipher.length);
  for (let i = 0; i < cipher.length; i += 1) {
    plain[i] = cipher[i] ^ keystream[i];
  }
  return bytesToUtf8(plain);
};

export class E2EEClient {
  private state: DeviceState;

  private ready: Promise<void>;

  constructor(state: DeviceState) {
    this.state = state;
    this.ready = Promise.resolve();
  }

  static async bootstrap(): Promise<E2EEClient> {
    let state = await ensureDeviceState();
    state = await registerIfNeeded(state);
    state = await replenishPrekeys(state);
    await saveDeviceState(state);
    return new E2EEClient(state);
  }

  getDeviceId() {
    return this.state.deviceId;
  }
  private logDecryptTelemetry(event: string, details: Record<string, unknown>) {
    console.log(`[E2EE] ${event}`, details);
  }

  private async withState(update: (state: DeviceState) => Promise<DeviceState> | DeviceState): Promise<void> {
    this.ready = this.ready.then(async () => {
      const next = await update(this.state);
      this.state = next;
      await saveDeviceState(this.state);
    });
    await this.ready;
  }

  private findPrekey(publicKey: string): StoredPrekey | undefined {
    return this.state.oneTimePrekeys.find(pk => pk.publicKey === publicKey);
  }

  private async rebuildSession(targetUserId?: number, expectedDeviceId?: string | null): Promise<boolean> {
    try {
      const refreshed = await ensureDeviceState();
      const registered = await registerIfNeeded(refreshed);
      const replenished = await replenishPrekeys(registered);
      await this.withState(() => ({ ...replenished, sentMessageKeys: this.state.sentMessageKeys }));

      if (targetUserId == null) {
        return true;
      }

      const bundles = await listDeviceBundles(targetUserId);
      const validated = await Promise.all(
        bundles.map(async bundle => ({
          bundle,
          valid: await hasValidPrekeySignature(
            bundle.identityKeyPub,
            bundle.signedPrekeyPub,
            bundle.signedPrekeySig,
          ),
        })),
      );
      const candidates = validated.filter(item => item.valid).map(item => item.bundle);
      if (!candidates.length) {
        return false;
      }

      const target = expectedDeviceId
        ? candidates.find(item => item.deviceId === expectedDeviceId) ?? candidates[0]
        : candidates[0];
      const bundle = await claimPrekey(targetUserId, target.deviceId);
      const bundleValid = await hasValidPrekeySignature(
        bundle.identityKeyPub,
        bundle.signedPrekeyPub,
        bundle.signedPrekeySig,
      );
      if (!bundleValid) {
        return false;
      }

      const fingerprint = buildFingerprint(bundle, Date.now());
      await this.withState(current => ({
        ...current,
        peerFingerprints: {
          ...(current.peerFingerprints ?? {}),
          [targetUserId]: fingerprint,
        },
      }));

      this.logDecryptTelemetry('session-rebuilt', {
        senderId: targetUserId,
        deviceId: fingerprint.deviceId,
      });
      return true;
    } catch (err) {
      console.warn('[E2EE] Failed to rebuild session', { targetUserId, expectedDeviceId }, err);
      return false;
    }
  }

  async encryptForUser(targetUserId: number, messageId: string, plaintext: string): Promise<EncryptResult | null> {
    if (!plaintext) {
      return null;
    }
    const devices = await listDeviceBundles(targetUserId);
    if (!devices.length) {
      return null;
    }

    const validatedDevices: DeviceBundleResponse[] = [];
    for (const device of devices) {
      const validSignature = await hasValidPrekeySignature(
        device.identityKeyPub,
        device.signedPrekeyPub,
        device.signedPrekeySig
      );
      if (validSignature) {
        validatedDevices.push(device);
      }
    }

    const usableDevices = validatedDevices.length ? validatedDevices : devices;
    if (!validatedDevices.length) {
      console.warn('[E2EE] No verified device signatures; falling back to unsigned bundle');
    }

    const cached = isFingerprintFresh(this.state.peerFingerprints?.[targetUserId])
      ? this.state.peerFingerprints?.[targetUserId] ?? null
      : null;

    const preferred = cached
      ? usableDevices.find(bundle => fingerprintsMatch(bundle, cached))
      : undefined;
    const target = preferred ?? usableDevices[0];

    const bundle = await claimPrekey(targetUserId, target.deviceId);
    const bundleSignatureValid = await hasValidPrekeySignature(
      bundle.identityKeyPub,
      bundle.signedPrekeyPub,
      bundle.signedPrekeySig
    );
    if (!bundleSignatureValid) {
      console.warn('[E2EE] Proceeding with claimed bundle despite missing/invalid signature');
    }

    const now = Date.now();
    const fingerprint = buildFingerprint(bundle, now);
    const fingerprintChanged = !fingerprintsMatch(bundle, cached);

    const prekey = bundle.oneTimePrekeyPub ?? bundle.signedPrekeyPub;
    if (!prekey) {
      return null;
    }
    const { shared, ephemeralPublic } = deriveEphemeral(prekey);
    const keyRef = bundle.oneTimePrekeyPub ? `otk:${bundle.oneTimePrekeyPub}` : 'spk';
    const envelope = encryptPayload(shared, plaintext, keyRef, ephemeralPublic);

     if (fingerprintChanged && cached) {
      console.warn('[E2EE] Detected changed device fingerprint; refreshing session before send');
    }

    await this.withState(async current => {
      const normalized = normalizePeerFingerprints(current);
      const withSentKey = rememberSentKey(normalized, { messageId, key: envelope.sharedKey, createdAt: now });
      return {
        ...withSentKey,
        peerFingerprints: {
          ...(withSentKey.peerFingerprints ?? {}),
          [targetUserId]: fingerprint,
        },
      };
    });
    
    return envelope;
  }

   async decryptEnvelope(
    envelope: Envelope,
    fromSelf: boolean,
    context: DecryptContext = {},
  ): Promise<string> {
    const attemptDecrypt = async (retrying: boolean): Promise<string> => {
      const sessionId = context.sessionId ?? envelope.keyRef ?? 'unknown';
      const senderId = context.senderId ?? null;
      const senderDeviceId = context.senderDeviceId ?? null;

      try {
        const localEntry = this.state.sentMessageKeys.find(
          item => item.messageId === envelope.messageId,
        );

        if (localEntry) {
          const key = base64ToBytes(localEntry.key);
          this.logDecryptTelemetry('decrypt-self', {
            senderId,
            senderDeviceId,
            sessionId,
            retrying,
            inferred: !fromSelf,
          });
          return decryptPayload(key, envelope);
        }

         if (fromSelf) {
          throw new Error('Missing local key');
        }
          const aadBytes = base64ToBytes(envelope.aad ?? '');
          let meta: { e: string; t: string } | null = null;
        try {
          meta = JSON.parse(bytesToUtf8(aadBytes));
        } catch {
          throw new Error('Invalid metadata');
        }
        if (!meta || typeof meta.e !== 'string') {
          throw new Error('Missing ephemeral key');
        }

        const cachedFingerprint = senderId != null ? this.state.peerFingerprints?.[senderId] : null;
          const fingerprintIsFresh = Boolean(isFingerprintFresh(cachedFingerprint));
          const staleFingerprint = cachedFingerprint && !fingerprintIsFresh ? cachedFingerprint : null;
          if (staleFingerprint) {
            this.logDecryptTelemetry('stale-session', {
              senderId,
              senderDeviceId,
              cachedDeviceId: staleFingerprint.deviceId,
              sessionId,
            });
            await this.rebuildSession(senderId ?? undefined, senderDeviceId ?? staleFingerprint.deviceId);
          }

        if (
          senderDeviceId &&
          cachedFingerprint &&
          cachedFingerprint.deviceId !== senderDeviceId &&
          !retrying
        ) {
          this.logDecryptTelemetry('duplicate-device', {
            senderId,
            expectedDevice: senderDeviceId,
            cachedDevice: cachedFingerprint.deviceId,
            sessionId,
          });
          throw new Error('Device fingerprint mismatch');
        }

        let shared: Uint8Array | null = null;
        const prekeyPath = envelope.keyRef?.startsWith('otk:');
        if (prekeyPath) {
          const key = envelope.keyRef.slice(4);
          let record = this.findPrekey(key);
          this.logDecryptTelemetry('lookup-prekey', {
            senderId,
            senderDeviceId,
            sessionId,
            found: Boolean(record),
          });
          if (!record) {
            const refreshed = await ensureDeviceState();
            record = refreshed.oneTimePrekeys.find(pk => pk.publicKey === key);
            if (record) {
              await this.withState(current => ({
                ...current,
                oneTimePrekeys: refreshed.oneTimePrekeys,
              }));
            }
          }
          if (!record) {
            throw new Error('Unknown prekey');
          }
          shared = computeFromEphemeral(record.privateKey, meta.e);
          await this.withState(async current => {
            const marked = markPrekeyConsumed(current, key);
            return replenishPrekeys(marked);
          });
        } else {
          this.logDecryptTelemetry('decrypt-with-session', {
            senderId,
            senderDeviceId,
            sessionId,
          });
          shared = computeFromEphemeral(this.state.signedPrekey.privateKey, meta.e);
        }
        return decryptPayload(shared, envelope);
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'unknown';
        this.logDecryptTelemetry('decrypt-failed', {
          senderId,
          senderDeviceId,
          sessionId,
          retrying,
          reason,
        });
        const recoverable =
          !fromSelf &&
          !retrying &&
          ['Unknown prekey', 'Device fingerprint mismatch'].includes(reason);

        if (recoverable) {
          const rebuilt = await this.rebuildSession(senderId ?? undefined, senderDeviceId);
          if (rebuilt) {
            return attemptDecrypt(true);
          }
        }

        throw err;
      };
    }
         return attemptDecrypt(false);
    
  }
}

let clientPromise: Promise<E2EEClient> | null = null;

export const getE2EEClient = async (): Promise<E2EEClient> => {
  if (!clientPromise) {
    clientPromise = E2EEClient.bootstrap().catch(err => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
};

export type { Envelope as E2EEEnvelope };

