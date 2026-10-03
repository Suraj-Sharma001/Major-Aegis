import { Router } from 'express';
import { chatCompletion } from '../controllers/gateway.controller.js';
import { requireApiKey } from '../middleware/apiKey.middleware.js';

const r = Router();
r.post('/chat/completions', requireApiKey, chatCompletion);
export default r;
