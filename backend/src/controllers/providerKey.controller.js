import { prisma } from '../config/prisma.js';
import { AppError } from '../lib/errors.js';
import { encrypt } from '../lib/crypto.js';
import { providerKeySchema } from '../utils/validators.js';

const meta = { id: true, provider: true, label: true, keyHint: true, isActive: true, createdAt: true };

// Metadata only. The key (even encrypted) is never returned.
export async function listProviderKeys(req, res) {
  const keys = await prisma.providerKey.findMany({
    where: { organizationId: req.user.organizationId },
    orderBy: { createdAt: 'desc' },
    select: meta,
  });
  res.json({ keys });
}

// One active key per provider per org: adding a new one deactivates the previous (kept for audit history).
export async function addProviderKey(req, res) {
  const { provider, label, apiKey } = providerKeySchema.parse(req.body);
  const record = await prisma.$transaction(async (tx) => {
    await tx.providerKey.updateMany({
      where: { organizationId: req.user.organizationId, provider, isActive: true },
      data: { isActive: false },
    });
    return tx.providerKey.create({
      data: {
        provider,
        label,
        encryptedKey: encrypt(apiKey),
        keyHint: `...${apiKey.slice(-4)}`,
        organizationId: req.user.organizationId,
      },
      select: meta,
    });
  });
  res.status(201).json({ key: record });
}

export async function deleteProviderKey(req, res) {
  const result = await prisma.providerKey.deleteMany({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (result.count === 0) throw new AppError(404, 'Provider key not found');
  res.json({ deleted: true });
}
