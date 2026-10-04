import crypto from 'crypto';
import argon2 from 'argon2';

export async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    salt,
    raw: true,
  }) as Promise<Buffer>;
}

export function encrypt(
  data: string,
  key: Buffer
): { iv: Buffer; ciphertext: Buffer; tag: Buffer } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  return { iv, ciphertext, tag: cipher.getAuthTag() };
}

export function decrypt(
  encrypted: { iv: Buffer; ciphertext: Buffer; tag: Buffer },
  key: Buffer
): string {
  const iv = Buffer.isBuffer(encrypted.iv) ? encrypted.iv : Buffer.from(encrypted.iv);
  const ciphertext = Buffer.isBuffer(encrypted.ciphertext)
    ? encrypted.ciphertext
    : Buffer.from(encrypted.ciphertext);
  const tag = Buffer.isBuffer(encrypted.tag) ? encrypted.tag : Buffer.from(encrypted.tag);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
