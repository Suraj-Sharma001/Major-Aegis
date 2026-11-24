import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const KEY = Buffer.from(env.encryptionKey, 'hex');

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


//export function generateApiKey() {
//  const key = `aegis_${randomBytes(24).toString('hex')}`;
 // return { key, hash: sha256(key), prefix: key.slice(0, 12) };
//}
//export function generateApiKey(options = {}) {
 // const { prefix, env, byteLength, expiresInDays } = {
  /*  ...DEFAULT_OPTIONS,
    ...options,
  };

  if (!prefix || typeof prefix !== 'string') {
    throw new TypeError('API key prefix must be a non-empty string.');
  }

  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new RangeError('byteLength must be an integer of at least 16.');
  }

  const keyId = randomBytes(6).toString('hex');
  const secret = randomBytes(byteLength).toString('base64url');
  const core = `${prefix}_${env}_${keyId}_${secret}`;
  const checksum = computeChecksum(core);
  const key = `${core}_${checksum}`;

  const createdAt = new Date();
  const expiresAt =
    expiresInDays && expiresInDays > 0
      ? new Date(createdAt.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  return {
    key,
    keyId,
    prefix: `${prefix}_${env}`,
    displayPrefix: key.slice(0, 16),
    hash: sha256(key),
    checksum,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };
}
*/




export function generateApiKey() {
  const key = `aegis_${randomBytes(24).toString('hex')}`;
  return { key, hash: sha256(key), prefix: key.slice(0, 12) };
}
