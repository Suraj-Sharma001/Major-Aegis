import { Router } from 'express';
import { listProviderKeys, addProviderKey, deleteProviderKey } from '../controllers/providerKey.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const r = Router();
r.use(requireAuth, requireRole('ADMIN'));
r.get('/', listProviderKeys);
r.post('/', addProviderKey);
r.delete('/:id', deleteProviderKey);
export default r;
