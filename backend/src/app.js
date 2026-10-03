import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { prisma } from './config/prisma.js';
import { isRedisReady } from './config/redis.js';
import { env } from './config/env.js';
import { embeddingHealth } from './services/embedding.service.js';
import authRoutes from './routes/auth.routes.js';
import teamRoutes from './routes/team.routes.js';
import applicationRoutes from './routes/application.routes.js';
import providerKeyRoutes from './routes/providerKey.routes.js';
import gatewayRoutes from './routes/gateway.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));

  // Dependency health. Postgres is required; Redis + embedding only affect the cache (it fails open).
  app.get('/health', async (_req, res) => {
    let database = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    const redis = isRedisReady() ? 'up' : 'down';
    const embedding = await embeddingHealth();
    const ok = database === 'up';
    res.status(ok ? 200 : 503).json({
      status: ok ? (redis === 'up' && embedding === 'up' ? 'ok' : 'degraded') : 'down',
      service: 'aegis-majorp-gateway',
      dependencies: { database, redis, embedding },
      semanticCache: redis === 'up' && embedding === 'up' ? 'active' : 'inactive (requests still work, uncached)',
    });
  });

  app.use('/auth', authRoutes);
  app.use('/teams', teamRoutes);
  app.use('/applications', applicationRoutes);
  app.use('/provider-keys', providerKeyRoutes);
  app.use('/v1', gatewayRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
