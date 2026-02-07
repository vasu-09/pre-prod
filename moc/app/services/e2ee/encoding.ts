const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

export const utf8ToBytes = (value: string): Uint8Array => {
  if (encoder) {
    return encoder.encode(value);
  }
  const utf16: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      utf16.push(code);
    } else if (code < 0x800) {
      utf16.push(0xc0 | (code >> 6));
      utf16.push(0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      utf16.push(0xe0 | (code >> 12));
      utf16.push(0x80 | ((code >> 6) & 0x3f));
      utf16.push(0x80 | (code & 0x3f));
    } else {
      i += 1;
      const next = value.charCodeAt(i) & 0x3ff;
      const current = ((code & 0x3ff) << 10) | next;
      const codePoint = current + 0x10000;
      utf16.push(0xf0 | (codePoint >> 18));
      utf16.push(0x80 | ((codePoint >> 12) & 0x3f));
      utf16.push(0x80 | ((codePoint >> 6) & 0x3f));
      utf16.push(0x80 | (codePoint & 0x3f));
    }
  }
  return Uint8Array.from(utf16);
};

export const bytesToUtf8 = (bytes: Uint8Array): string => {
  if (decoder) {
    return decoder.decode(bytes);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i];
    if (value < 0x80) {
      out += String.fromCharCode(value);
    } else if (value < 0xe0) {
      const next = bytes[++i];
      out += String.fromCharCode(((value & 0x1f) << 6) | (next & 0x3f));
    } else if (value < 0xf0) {
      const next = bytes[++i];
      const next2 = bytes[++i];
      out += String.fromCharCode(
        ((value & 0x0f) << 12) | ((next & 0x3f) << 6) | (next2 & 0x3f),
      );
    } else {
      const next = bytes[++i];
      const next2 = bytes[++i];
      const next3 = bytes[++i];
      const codePoint =
        ((value & 0x07) << 18) |
        ((next & 0x3f) << 12) |
        ((next2 & 0x3f) << 6) |
        (next3 & 0x3f);
      const surrogate = codePoint - 0x10000;
      out += String.fromCharCode(0xd800 | (surrogate >> 10));
      out += String.fromCharCode(0xdc00 | (surrogate & 0x3ff));
    }
  }
  return out;
};

export const concatBytes = (...arrays: Uint8Array[]): Uint8Array => {
  const total = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  arrays.forEach(arr => {
    output.set(arr, offset);
    offset += arr.length;
  });
  return output;
};

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;

    const triple = (a << 16) | (b << 8) | c;

    result += BASE64_CHARS[(triple >> 18) & 0x3f];
    result += BASE64_CHARS[(triple >> 12) & 0x3f];
    result += i + 1 < bytes.length ? BASE64_CHARS[(triple >> 6) & 0x3f] : '=';
    result += i + 2 < bytes.length ? BASE64_CHARS[triple & 0x3f] : '=';
  }
  return result;
};

export const base64ToBytes = (value: string): Uint8Array => {
  const sanitized = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const output: number[] = [];
  for (let i = 0; i < sanitized.length; i += 4) {
    const enc1 = BASE64_CHARS.indexOf(sanitized[i]);
    const enc2 = BASE64_CHARS.indexOf(sanitized[i + 1]);
    const enc3 = BASE64_CHARS.indexOf(sanitized[i + 2]);
    const enc4 = BASE64_CHARS.indexOf(sanitized[i + 3]);

    const triple =
      ((enc1 & 0x3f) << 18) |
      ((enc2 & 0x3f) << 12) |
      (((enc3 & 0x3f) << 6) >>> 0) |
      (enc4 & 0x3f);

    output.push((triple >> 16) & 0xff);
    if (enc3 !== 64) {
      output.push((triple >> 8) & 0xff);
    }
    if (enc4 !== 64) {
      output.push(triple & 0xff);
    }
  }
  return Uint8Array.from(output);
};

export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

export const hexToBytes = (hex: string): Uint8Array => {
  const cleaned = hex.replace(/[^a-fA-F0-9]/g, '');
  const output = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    output[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
  }
  return output;
};

export const bigIntToBytes = (value: bigint, length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  let temp = value;
  for (let i = length - 1; i >= 0; i -= 1) {
    bytes[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }
  return bytes;
};

export const bytesToBigInt = (bytes: Uint8Array): bigint => {
  let result = 0n;
  for (let i = 0; i < bytes.length; i += 1) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
};
