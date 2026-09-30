import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from './security';

describe('Security and PIN Hashing (SPEC 5.12)', () => {
  it('hashes and verifies a 4-digit PIN correctly', async () => {
    const pin = '1234';
    const hashData = await hashPin(pin);

    expect(hashData.salt).toHaveLength(32); // 16 bytes in hex
    expect(hashData.hash.length).toBeGreaterThan(0);

    const isMatch = await verifyPin('1234', hashData);
    expect(isMatch).toBe(true);

    const isWrong = await verifyPin('9999', hashData);
    expect(isWrong).toBe(false);
  });

  it('generates different salts for each PIN creation', async () => {
    const h1 = await hashPin('4321');
    const h2 = await hashPin('4321');

    expect(h1.salt).not.toBe(h2.salt);
    expect(h1.hash).not.toBe(h2.hash);

    expect(await verifyPin('4321', h1)).toBe(true);
    expect(await verifyPin('4321', h2)).toBe(true);
  });
});
