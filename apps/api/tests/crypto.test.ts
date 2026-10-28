import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, sign, unsign } from '../src/utils/crypto.js';

describe('Crypto Utilities', () => {
  it('encrypts and decrypts sensitive tokens with AES-256-GCM', () => {
    const secretToken = 'xoxb-1234567890-slack-bot-token-secret-value';
    const encrypted = encrypt(secretToken);

    expect(encrypted).not.toBe(secretToken);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(secretToken);
  });

  it('fails decryption when payload is tampered', () => {
    const encrypted = encrypt('my-secret-data');
    const [iv, tag, ciphertext] = encrypted.split(':');
    const tampered = `${iv}:${tag}:${ciphertext.slice(0, -2)}ff`;

    expect(() => decrypt(tampered)).toThrow();
  });

  it('signs and unsigns session tokens with HMAC', () => {
    const session = 'user-123:tenant-456:1700000000';
    const signed = sign(session);

    expect(signed).toContain(session);
    const verified = unsign(signed);
    expect(verified).toBe(session);

    // Tampered signature should return null
    const tampered = signed + 'bad';
    expect(unsign(tampered)).toBeNull();
  });
});
