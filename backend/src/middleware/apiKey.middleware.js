import { prisma } from '../config/prisma.js';
import { sha256 } from '../lib/crypto.js';
import { AppError } from '../lib/errors.js';

// Gateway auth: x-api-key: aegis_xxx  (or Authorization: Bearer aegis_xxx)
export async function requireApiKey(req, _res, next) {
  let raw = req.headers['x-api-key'];
  if (!raw && req.headers.authorization?.startsWith('Bearer aegis_')) {
    raw = req.headers.authorization.slice(7);
  }
  if (!raw || typeof raw !== 'string') throw new AppError(401, 'Missing x-api-key header');

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: sha256(raw.trim()) },
    include: { application: true },
  });
  if (!apiKey || !apiKey.isActive) throw new AppError(401, 'Invalid or revoked API key');

  req.gateway = {
    apiKeyId: apiKey.id,
    application: apiKey.application,
    organizationId: apiKey.application.organizationId,
  };

  // Fire-and-forget: never slow down or fail a request because of this bookkeeping.
  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  next();
}
