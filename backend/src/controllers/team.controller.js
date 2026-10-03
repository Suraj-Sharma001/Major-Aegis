import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { AppError } from '../lib/errors.js';
import { assertTeamInOrg, getMemberTeamIds, isAdmin } from '../lib/authz.js';
import { createTeamSchema, addMemberSchema } from '../utils/validators.js';

// Admins see every team in the org; everyone else only the teams they belong to.
export async function listTeams(req, res) {
  const where = { organizationId: req.user.organizationId };
  if (!isAdmin(req.user)) where.id = { in: await getMemberTeamIds(req.user.id) };
  const teams = await prisma.team.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { members: true, applications: true } } },
  });
  res.json({ teams });
}

export async function createTeam(req, res) {
  const { name } = createTeamSchema.parse(req.body);
  const team = await prisma.team.create({ data: { name, organizationId: req.user.organizationId } });
  res.status(201).json({ team });
}

export async function listMembers(req, res) {
  const team = await assertTeamInOrg(req.user, req.params.id);
  const members = await prisma.teamMember.findMany({
    where: { teamId: team.id },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  res.json({ team: { id: team.id, name: team.name }, members: members.map((m) => ({ ...m.user, joinedAt: m.joinedAt })) });
}

// Admin adds an existing org user, or creates the teammate's account directly (no invite/email system).
export async function addMember(req, res) {
  const team = await assertTeamInOrg(req.user, req.params.id);
  const { email, name, password, role } = addMemberSchema.parse(req.body);

  let user = await prisma.user.findUnique({ where: { email } });
  let created = false;

  if (user) {
    if (user.organizationId !== req.user.organizationId) {
      throw new AppError(409, 'This email belongs to an account in another organization');
    }
  } else {
    if (!name || !password) {
      throw new AppError(400, 'No account exists for this email. Provide name and password to create one.');
    }
    user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 10),
        role: role ?? 'DEVELOPER',
        organizationId: req.user.organizationId,
      },
    });
    created = true;
  }

  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: user.id, teamId: team.id } },
  });
  if (existing) throw new AppError(409, 'User is already a member of this team');

  await prisma.teamMember.create({ data: { userId: user.id, teamId: team.id } });
  res.status(201).json({
    created,
    member: { id: user.id, email: user.email, name: user.name, role: user.role },
    team: { id: team.id, name: team.name },
  });
}

export async function removeMember(req, res) {
  const team = await assertTeamInOrg(req.user, req.params.id);
  const result = await prisma.teamMember.deleteMany({ where: { teamId: team.id, userId: req.params.userId } });
  if (result.count === 0) throw new AppError(404, 'That user is not a member of this team');
  res.json({ removed: true });
}
