import { Router } from 'express';
import { listTeams, createTeam, listMembers, addMember, removeMember } from '../controllers/team.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const r = Router();
r.use(requireAuth);
r.get('/', listTeams);
r.post('/', requireRole('ADMIN'), createTeam);
r.get('/:id/members', requireRole('ADMIN'), listMembers);
r.post('/:id/members', requireRole('ADMIN'), addMember);
r.delete('/:id/members/:userId', requireRole('ADMIN'), removeMember);
export default r;
