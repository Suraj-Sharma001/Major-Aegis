import { prisma } from '../config/prisma.js';
import { verifyToken } from '../lib/jwt.js';
import { AppError } from '../lib/errors.js';

// Dashboard/API-management auth (JWT). Loads the user fresh so role changes and deletions apply instantly.
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Missing Authorization: Bearer <token>');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, organizationId: true },
  });
  if (!user) throw new AppError(401, 'User no longer exists');
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) {
    throw new AppError(403, `This action requires one of these roles: ${roles.join(', ')}`);
  }
  next();
};
