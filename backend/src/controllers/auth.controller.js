import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { signToken } from '../lib/jwt.js';
import { AppError } from '../lib/errors.js';
import { registerSchema, loginSchema } from '../utils/validators.js';

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, organizationId: u.organizationId });
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // keeps login timing similar for unknown emails

// Creates the organization, its first ADMIN, and a "Default Team" the admin belongs to.
export async function register(req, res) {
  const { organizationName, name, email, password } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const { org, user, team } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name: organizationName } });
    const user = await tx.user.create({
      data: { email, name, passwordHash, role: 'ADMIN', organizationId: org.id },
    });
    const team = await tx.team.create({ data: { name: 'Default Team', organizationId: org.id } });
    await tx.teamMember.create({ data: { userId: user.id, teamId: team.id } });
    return { org, user, team };
  });

  res.status(201).json({
    token: signToken(user),
    user: publicUser(user),
    organization: { id: org.id, name: org.name },
    defaultTeam: { id: team.id, name: team.name },
  });
}

export async function login(req, res) {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'Invalid email or password');
  res.json({ token: signToken(user), user: publicUser(user) });
}

export async function me(req, res) {
  const [org, memberships] = await Promise.all([
    prisma.organization.findUnique({ where: { id: req.user.organizationId }, select: { id: true, name: true } }),
    prisma.teamMember.findMany({
      where: { userId: req.user.id },
      select: { team: { select: { id: true, name: true } } },
    }),
  ]);
  res.json({ user: req.user, organization: org, teams: memberships.map((m) => m.team) });
}
