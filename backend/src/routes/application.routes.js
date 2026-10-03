import { Router } from 'express';
import {
  listApplications, createApplication, issueKey, listKeys, revokeKey, listLogs,
} from '../controllers/application.controller.js';
import { applicationAnalytics } from '../controllers/analytics.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const r = Router();
r.use(requireAuth);
r.get('/', listApplications);
r.post('/', createApplication);
r.post('/:id/keys', issueKey);
r.get('/:id/keys', listKeys);
r.delete('/:id/keys/:keyId', revokeKey);
r.get('/:id/analytics', applicationAnalytics);
r.get('/:id/logs', listLogs);
export default r;
