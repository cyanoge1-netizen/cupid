export interface PinHashData {
  salt: string; // hex
  hash: string; // hex
  iterations: number;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derives a secure PBKDF2 hash of a 4-digit PIN using SubtleCrypto.
 */
export async function hashPin(pin: string, existingSaltHex?: string): Promise<PinHashData> {
  const enc = new TextEncoder();
  const pinBytes = enc.encode(pin);

  const saltBytes = existingSaltHex
    ? hexToBytes(existingSaltHex)
    : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const iterations = 100000;
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign']
  );

  const rawKey = await crypto.subtle.exportKey('raw', derivedKey);
  const hash = bytesToHex(new Uint8Array(rawKey));

  return {
    salt: bytesToHex(saltBytes),
    hash,
    iterations,
  };
}

/**
 * Constant-time comparison between two hex strings to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const aLen = a.length;
  const bLen = b.length;
  let diff = aLen ^ bLen;
  for (let i = 0; i < aLen; i++) {
    const bChar = i < bLen ? b.charCodeAt(i) : 0;
    diff |= a.charCodeAt(i) ^ bChar;
  }
  return diff === 0;
}

/**
 * Verifies a 4-digit PIN against stored salted hash using constant-time comparison.
 */
export async function verifyPin(pin: string, stored: PinHashData): Promise<boolean> {
  const { hash } = await hashPin(pin, stored.salt);
  return timingSafeEqual(hash, stored.hash);
}
