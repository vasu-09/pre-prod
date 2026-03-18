import { claimPrekey, getPrekeyStock, listDeviceBundles, registerDevice, uploadPrekeys, } from '../../../app/services/e2ee/api';
import { E2EEClient } from '../../../app/services/e2ee/client';
import { generateDhKeyPair } from '../../../app/services/e2ee/dh';
import { generateKeyPair as generateEd25519KeyPair, sign as signEd25519 } from '../../../app/services/e2ee/ed25519';
import { base64ToBytes, bytesToBase64 } from '../../../app/services/e2ee/encoding';
import { loadDeviceState, type DeviceState } from '../../../app/services/e2ee/storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('../../../app/services/e2ee/api', () => ({
  claimPrekey: jest.fn(),
  listDeviceBundles: jest.fn(),
  registerDevice: jest.fn(),
  uploadPrekeys: jest.fn(),
  getPrekeyStock: jest.fn(),
}));

jest.mock('../../../app/services/e2ee/storage', () => {
  const actual = jest.requireActual('../../../app/services/e2ee/storage');
  return {
    ...actual,
    loadDeviceState: jest.fn(async () => null),
    saveDeviceState: jest.fn(async () => {}),
  };
});

jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return {
    getRandomBytes: (length: number) => nodeCrypto.randomBytes(length),
    digestStringAsync: async (_algorithm: string, value: string) =>
      nodeCrypto.createHash('sha512').update(value).digest('hex'),
    CryptoDigestAlgorithm: { SHA512: 'SHA-512' },
  };
});

const mockClaimPrekey = claimPrekey as jest.MockedFunction<typeof claimPrekey>;
const mockListDeviceBundles = listDeviceBundles as jest.MockedFunction<typeof listDeviceBundles>;
const mockGetPrekeyStock = getPrekeyStock as jest.MockedFunction<typeof getPrekeyStock>;
const mockUploadPrekeys = uploadPrekeys as jest.MockedFunction<typeof uploadPrekeys>;
const mockRegisterDevice = registerDevice as jest.MockedFunction<typeof registerDevice>;
const mockLoadDeviceState = loadDeviceState as jest.MockedFunction<typeof loadDeviceState>;

const DEVICE_VERSION = 25;

const buildSenderState = (): DeviceState => {
  const identity = generateEd25519KeyPair();
  const signedPrekey = generateDhKeyPair();

  return {
    version: DEVICE_VERSION,
    deviceId: 'sender-dev',
    identity: {
      publicKey: bytesToBase64(identity.publicKey),
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
};

const signPrekey = (identityPriv: Uint8Array, prekeyPub: string) =>
  bytesToBase64(signEd25519(base64ToBytes(prekeyPub), identityPriv));

const buildRecipientState = (
  deviceId: string,
  identity: ReturnType<typeof generateEd25519KeyPair>,
  signedPrekey: ReturnType<typeof generateDhKeyPair>,
  signature: string,
  otk: ReturnType<typeof generateDhKeyPair>
): DeviceState => ({
  version: DEVICE_VERSION,
  deviceId,
  identity: {
    publicKey: bytesToBase64(identity.publicKey),
    privateKey: bytesToBase64(identity.privateKey),
  },
  signedPrekey: {
    publicKey: signedPrekey.publicKey,
    privateKey: signedPrekey.privateKey,
    signature,
  },
  oneTimePrekeys: [
    {
      publicKey: otk.publicKey,
      privateKey: otk.privateKey,
      uploaded: true,
      createdAt: Date.now(),
    },
  ],
  sentMessageKeys: [],
  peerFingerprints: {},
});

describe('E2EEClient device fingerprint handling', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetPrekeyStock.mockResolvedValue(10);
    mockUploadPrekeys.mockResolvedValue();
    mockRegisterDevice.mockResolvedValue();
    mockLoadDeviceState.mockResolvedValue(null);
  });

  it('refreshes sessions when the recipient reinstalls with new keys', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const targetUserId = 42;
    const recipientDeviceId = 'recipient-dev';

    const v1Identity = generateEd25519KeyPair();
    const v1SignedPrekey = generateDhKeyPair();
    const v1Otk = generateDhKeyPair();
    const v1Signature = signPrekey(v1Identity.privateKey, v1SignedPrekey.publicKey);

    const v2Identity = generateEd25519KeyPair();
    const v2SignedPrekey = generateDhKeyPair();
    const v2Otk = generateDhKeyPair();
    const v2Signature = signPrekey(v2Identity.privateKey, v2SignedPrekey.publicKey);

    mockListDeviceBundles
      .mockResolvedValueOnce([
        {
          deviceId: recipientDeviceId,
          identityKeyPub: bytesToBase64(v1Identity.publicKey),
          signedPrekeyPub: v1SignedPrekey.publicKey,
          signedPrekeySig: v1Signature,
          oneTimePrekeyPub: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          deviceId: recipientDeviceId,
          identityKeyPub: bytesToBase64(v2Identity.publicKey),
          signedPrekeyPub: v2SignedPrekey.publicKey,
          signedPrekeySig: v2Signature,
          oneTimePrekeyPub: null,
        },
      ]);

    mockClaimPrekey
      .mockResolvedValueOnce({
        deviceId: recipientDeviceId,
        identityKeyPub: bytesToBase64(v1Identity.publicKey),
        signedPrekeyPub: v1SignedPrekey.publicKey,
        signedPrekeySig: v1Signature,
        oneTimePrekeyPub: v1Otk.publicKey,
      })
      .mockResolvedValueOnce({
        deviceId: recipientDeviceId,
        identityKeyPub: bytesToBase64(v2Identity.publicKey),
        signedPrekeyPub: v2SignedPrekey.publicKey,
        signedPrekeySig: v2Signature,
        oneTimePrekeyPub: v2Otk.publicKey,
      });

    const sender = new E2EEClient(buildSenderState());

    const recipientV1 = new E2EEClient(
      buildRecipientState(recipientDeviceId, v1Identity, v1SignedPrekey, v1Signature, v1Otk)
    );
    const recipientV2 = new E2EEClient(
      buildRecipientState(recipientDeviceId, v2Identity, v2SignedPrekey, v2Signature, v2Otk)
    );

    const first = await sender.encryptForUser(targetUserId, 'm1', 'hello-old-device');
    expect(first).not.toBeNull();

    const firstPlaintext = await recipientV1.decryptEnvelope(
      {
        ...first!.envelope,
        messageId: 'm1',
      },
      false
    );
    expect(firstPlaintext).toBe('hello-old-device');

    const second = await sender.encryptForUser(targetUserId, 'm2', 'hello-new-device');
    expect(second).not.toBeNull();

    const secondPlaintext = await recipientV2.decryptEnvelope(
      {
        ...second!.envelope,
        messageId: 'm2',
      },
      false
    );
    expect(secondPlaintext).toBe('hello-new-device');

    const cached = (sender as unknown as { state: DeviceState }).state.peerFingerprints?.[targetUserId];
    expect(cached?.identityKey).toBe(bytesToBase64(v2Identity.publicKey));
    expect(first!.sharedKey).not.toEqual(second!.sharedKey);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
   it('decrypts envelopes with an existing session', async () => {
    const targetUserId = 7;
    const recipientDeviceId = 'recipient-dev';

    const recipientIdentity = generateEd25519KeyPair();
    const recipientSignedPrekey = generateDhKeyPair();
    const recipientOtk = generateDhKeyPair();
    const recipientSig = signPrekey(recipientIdentity.privateKey, recipientSignedPrekey.publicKey);

    mockListDeviceBundles.mockResolvedValue([
      {
        deviceId: recipientDeviceId,
        identityKeyPub: bytesToBase64(recipientIdentity.publicKey),
        signedPrekeyPub: recipientSignedPrekey.publicKey,
        signedPrekeySig: recipientSig,
        oneTimePrekeyPub: recipientOtk.publicKey,
      },
    ]);
    mockClaimPrekey.mockResolvedValue({
      deviceId: recipientDeviceId,
      identityKeyPub: bytesToBase64(recipientIdentity.publicKey),
      signedPrekeyPub: recipientSignedPrekey.publicKey,
      signedPrekeySig: recipientSig,
      oneTimePrekeyPub: recipientOtk.publicKey,
    });

    const sender = new E2EEClient(buildSenderState());
    const recipient = new E2EEClient(
      buildRecipientState(recipientDeviceId, recipientIdentity, recipientSignedPrekey, recipientSig, recipientOtk),
    );

    const encrypted = await sender.encryptForUser(targetUserId, 'm-valid', 'hello-session');
    expect(encrypted).not.toBeNull();

    const plaintext = await recipient.decryptEnvelope(
      { ...encrypted!.envelope, messageId: 'm-valid' },
      false,
      { senderId: targetUserId, sessionId: encrypted!.envelope.keyRef },
    );

    expect(plaintext).toBe('hello-session');
  });

  it('rebuilds and retries decryption when no matching session exists', async () => {
    const targetUserId = 101;
    const recipientDeviceId = 'missing-session-device';

    const recipientIdentity = generateEd25519KeyPair();
    const recipientSignedPrekey = generateDhKeyPair();
    const recipientOtk = generateDhKeyPair();
    const recipientSig = signPrekey(recipientIdentity.privateKey, recipientSignedPrekey.publicKey);

    mockListDeviceBundles.mockResolvedValue([
      {
        deviceId: recipientDeviceId,
        identityKeyPub: bytesToBase64(recipientIdentity.publicKey),
        signedPrekeyPub: recipientSignedPrekey.publicKey,
        signedPrekeySig: recipientSig,
        oneTimePrekeyPub: recipientOtk.publicKey,
      },
    ]);
    mockClaimPrekey.mockResolvedValue({
      deviceId: recipientDeviceId,
      identityKeyPub: bytesToBase64(recipientIdentity.publicKey),
      signedPrekeyPub: recipientSignedPrekey.publicKey,
      signedPrekeySig: recipientSig,
      oneTimePrekeyPub: recipientOtk.publicKey,
    });

    const sender = new E2EEClient(buildSenderState());
    const recipientState = buildRecipientState(
      recipientDeviceId,
      recipientIdentity,
      recipientSignedPrekey,
      recipientSig,
      recipientOtk,
    );
    const recipient = new E2EEClient({ ...recipientState, oneTimePrekeys: [] });
    mockLoadDeviceState.mockResolvedValue(recipientState);

    const encrypted = await sender.encryptForUser(targetUserId, 'm-recover', 'rebuild-me');
    expect(encrypted).not.toBeNull();
    expect(encrypted!.envelope.keyRef).toBe(`otk:${recipientOtk.publicKey}`);

    mockListDeviceBundles.mockClear();
    mockClaimPrekey.mockClear();

    const plaintext = await recipient.decryptEnvelope(
      { ...encrypted!.envelope, messageId: 'm-recover' },
      false,
      { senderId: targetUserId, sessionId: encrypted!.envelope.keyRef },
    );

    expect(plaintext).toBe('rebuild-me');
    
    expect(mockLoadDeviceState).toHaveBeenCalled();
  });

  it('refreshes stale fingerprints when a different device ID arrives', async () => {
    const targetUserId = 202;
    const cachedDevice = 'old-device';
    const newDevice = 'new-device';

    const recipientIdentity = generateEd25519KeyPair();
    const recipientSignedPrekey = generateDhKeyPair();
    const recipientOtk = generateDhKeyPair();
    const recipientSig = signPrekey(recipientIdentity.privateKey, recipientSignedPrekey.publicKey);

    mockListDeviceBundles.mockResolvedValue([
      {
        deviceId: newDevice,
        identityKeyPub: bytesToBase64(recipientIdentity.publicKey),
        signedPrekeyPub: recipientSignedPrekey.publicKey,
        signedPrekeySig: recipientSig,
        oneTimePrekeyPub: recipientOtk.publicKey,
      },
    ]);
    mockClaimPrekey.mockResolvedValue({
      deviceId: newDevice,
      identityKeyPub: bytesToBase64(recipientIdentity.publicKey),
      signedPrekeyPub: recipientSignedPrekey.publicKey,
      signedPrekeySig: recipientSig,
      oneTimePrekeyPub: recipientOtk.publicKey,
    });

    const sender = new E2EEClient(buildSenderState());
    const recipient = new E2EEClient(
      buildRecipientState(newDevice, recipientIdentity, recipientSignedPrekey, recipientSig, recipientOtk),
    );

    mockLoadDeviceState.mockResolvedValue(
      buildRecipientState(newDevice, recipientIdentity, recipientSignedPrekey, recipientSig, recipientOtk),
    );

    const encrypted = await sender.encryptForUser(targetUserId, 'm-duplicate', 'fresh-device');
    expect(encrypted).not.toBeNull();

    (recipient as unknown as { state: DeviceState }).state.peerFingerprints = {
      [targetUserId]: {
        deviceId: cachedDevice,
        identityKey: 'stale',
        signedPrekey: 'stale',
        updatedAt: Date.now(),
      },
    };

    mockListDeviceBundles.mockClear();
    mockClaimPrekey.mockClear();

    const plaintext = await recipient.decryptEnvelope(
      { ...encrypted!.envelope, messageId: 'm-duplicate' },
      false,
      { senderId: targetUserId, senderDeviceId: newDevice, sessionId: encrypted!.envelope.keyRef },
    );

    expect(plaintext).toBe('fresh-device');
    expect(mockListDeviceBundles).toHaveBeenCalledWith(targetUserId);
    expect((recipient as unknown as { state: DeviceState }).state.peerFingerprints?.[targetUserId]?.deviceId).toBe(
      newDevice,
    );
  });

  it('encrypts and decrypts boundary-length payloads without padding errors', async () => {
    const targetUserId = 303;
    const recipientDeviceId = 'padding-device';

    const recipientIdentity = generateEd25519KeyPair();
    const recipientSignedPrekey = generateDhKeyPair();
    const recipientOtk1 = generateDhKeyPair();
    const recipientOtk2 = generateDhKeyPair();
    const recipientOtk3 = generateDhKeyPair();
    const recipientSig = signPrekey(recipientIdentity.privateKey, recipientSignedPrekey.publicKey);

    const buildBundle = (otk: ReturnType<typeof generateDhKeyPair>) => ({
      deviceId: recipientDeviceId,
      identityKeyPub: bytesToBase64(recipientIdentity.publicKey),
      signedPrekeyPub: recipientSignedPrekey.publicKey,
      signedPrekeySig: recipientSig,
      oneTimePrekeyPub: otk.publicKey,
    });

    const bundleQueue = [recipientOtk1, recipientOtk2, recipientOtk3].map(buildBundle);

    mockListDeviceBundles.mockResolvedValue([buildBundle(recipientOtk1)]);

    mockClaimPrekey.mockImplementation(async () => bundleQueue.shift() ?? buildBundle(recipientOtk3));

    const sender = new E2EEClient(buildSenderState());
    const recipientState = buildRecipientState(
      recipientDeviceId,
      recipientIdentity,
      recipientSignedPrekey,
      recipientSig,
      recipientOtk1,
    );
    recipientState.oneTimePrekeys = [recipientOtk1, recipientOtk2, recipientOtk3].map(otk => ({
      publicKey: otk.publicKey,
      privateKey: otk.privateKey,
      uploaded: true,
      createdAt: Date.now(),
    }));
    const recipient = new E2EEClient(recipientState);

    const boundaryLengths = [56, 120, 184];

    for (const [index, length] of boundaryLengths.entries()) {
      const plaintext = 'x'.repeat(length);
      const messageId = `padding-${index}`;

      const encrypted = await sender.encryptForUser(targetUserId, messageId, plaintext);
      expect(encrypted).not.toBeNull();

      const decrypted = await recipient.decryptEnvelope(
        { ...encrypted!.envelope, messageId },
        false,
        { senderId: targetUserId, sessionId: encrypted!.envelope.keyRef },
      );

      expect(decrypted).toBe(plaintext);
    }
  });
});