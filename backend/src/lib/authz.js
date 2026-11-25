import { prisma } from '../config/prisma.js';
import { AppError } from './errors.js';

export const isAdmin = (user) => user.role === 'ADMIN';
export const isDeveloper = (user) => user.role === 'DEVELOPER';

export function assertRole(user, ...roles) {
  if (!roles.includes(user.role)) {
    throw new AppError(403, `This action requires one of these roles: ${roles.join(', ')}`);
  }
}

export async function getMemberTeamIds(userId) {
  const rows = await prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } });
  return rows.map((r) => r.teamId);
}

export async function assertCanAccessApplication(user, applicationId) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, organizationId: user.organizationId },
  });
  if (!app) throw new AppError(404, 'Application not found');
  if (isAdmin(user)) return app;

  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: user.id, teamId: app.teamId } },
  });
  if (!membership) throw new AppError(403, "You are not a member of this application's team");
  return app;
}

export async function assertTeamInOrg(user, teamId) {
  const team = await prisma.team.findFirst({ where: { id: teamId, organizationId: user.organizationId } });
  if (!team) throw new AppError(404, 'Team not found');
  return team;
}
