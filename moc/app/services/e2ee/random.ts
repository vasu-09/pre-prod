declare const require: any;

export const randomBytes = (length: number): Uint8Array => {
  const output = new Uint8Array(length);
  if (typeof globalThis !== 'undefined') {
    const cryptoObj = (globalThis as any).crypto;
    if (cryptoObj?.getRandomValues) {
      cryptoObj.getRandomValues(output);
      return output;
    }
  }

  try {
     
    const nodeCrypto = require('crypto');
    if (nodeCrypto?.randomBytes) {
      const buf: Buffer = nodeCrypto.randomBytes(length);
      output.set(buf);
      return output;
    }
  } catch {
    // ignore
  }

  for (let i = 0; i < length; i += 1) {
    output[i] = Math.floor(Math.random() * 256);
  }
  return output;
};

export const randomId = (length = 16): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
};