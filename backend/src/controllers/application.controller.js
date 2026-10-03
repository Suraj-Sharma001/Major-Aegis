import { prisma } from '../config/prisma.js';
import { AppError } from '../lib/errors.js';
import { generateApiKey } from '../lib/crypto.js';
import { assertCanAccessApplication, assertRole, assertTeamInOrg, getMemberTeamIds, isAdmin } from '../lib/authz.js';
import { createApplicationSchema, createKeySchema } from '../utils/validators.js';

export async function listApplications(req, res) {
  const where = { organizationId: req.user.organizationId };
  if (!isAdmin(req.user)) where.teamId = { in: await getMemberTeamIds(req.user.id) };
  const applications = await prisma.application.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { team: { select: { id: true, name: true } }, _count: { select: { apiKeys: true } } },
  });
  res.json({ applications });
}

export async function createApplication(req, res) {
  assertRole(req.user, 'ADMIN', 'DEVELOPER');
  const { name, teamId } = createApplicationSchema.parse(req.body);
  const team = await assertTeamInOrg(req.user, teamId);

  if (!isAdmin(req.user)) {
    const memberOf = await getMemberTeamIds(req.user.id);
    if (!memberOf.includes(team.id)) throw new AppError(403, 'You can only create applications in teams you belong to');
  }

  const application = await prisma.application.create({
    data: { name, teamId: team.id, organizationId: req.user.organizationId },
    include: { team: { select: { id: true, name: true } } },
  });
  res.status(201).json({ application });
}

export async function issueKey(req, res) {
  assertRole(req.user, 'ADMIN', 'DEVELOPER');
  const app = await assertCanAccessApplication(req.user, req.params.id);
  const { label } = createKeySchema.parse(req.body ?? {});

  const { key, hash, prefix } = generateApiKey();
  const record = await prisma.apiKey.create({
    data: { keyHash: hash, keyPrefix: prefix, label, applicationId: app.id, createdById: req.user.id },
    select: { id: true, label: true, keyPrefix: true, createdAt: true },
  });
  res.status(201).json({ ...record, key, warning: 'Save this key now. It is shown only once and cannot be recovered.' });
}

export async function listKeys(req, res) {
  const app = await assertCanAccessApplication(req.user, req.params.id);
  const keys = await prisma.apiKey.findMany({
    where: { applicationId: app.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, keyPrefix: true, isActive: true, lastUsedAt: true, createdAt: true },
  });
  res.json({ keys });
}

export async function revokeKey(req, res) {
  assertRole(req.user, 'ADMIN', 'DEVELOPER');
  const app = await assertCanAccessApplication(req.user, req.params.id);
  const result = await prisma.apiKey.updateMany({
    where: { id: req.params.keyId, applicationId: app.id },
    data: { isActive: false },
  });
  if (result.count === 0) throw new AppError(404, 'API key not found');
  res.json({ revoked: true });
}

export async function listLogs(req, res) {
  const app = await assertCanAccessApplication(req.user, req.params.id);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const logs = await prisma.auditLog.findMany({
    where: { applicationId: app.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json({ logs });
}
