import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { connectRedis, redis } from './config/redis.js';
import { createApp } from './app.js';

connectRedis();
const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`Aegis Phase 1 gateway listening on http://localhost:${env.port}  (${env.nodeEnv})`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.isOpen ? redis.quit() : Promise.resolve()]);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
