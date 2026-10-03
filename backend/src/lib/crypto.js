import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const KEY = Buffer.from(env.encryptionKey, 'hex'); // 32 bytes -> AES-256

// Layout (base64): [12-byte IV][16-byte auth tag][ciphertext]
export function encrypt(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

export function decrypt(payload) {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// Gateway key: aegis_<48 hex>. Plaintext is shown once; only the hash is stored.
export function generateApiKey() {
  const key = `aegis_${randomBytes(24).toString('hex')}`;
  return { key, hash: sha256(key), prefix: key.slice(0, 12) };
}
