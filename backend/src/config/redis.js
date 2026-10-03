import { createClient } from 'redis';
import { env } from './env.js';

export const redis = createClient({
  url: env.redisUrl,
  socket: { reconnectStrategy: (retries) => Math.min(retries * 200, 5000) },
});

let lastLog = 0;
redis.on('error', (err) => {
  // Throttle: a down Redis would otherwise spam the console on every reconnect attempt.
  const now = Date.now();
  if (now - lastLog > 10000) {
    lastLog = now;
    console.warn(`[redis] ${err.message || err} (semantic cache disabled until Redis is back)`);
  }
});
redis.on('ready', () => console.log('[redis] connected'));

// Fire-and-forget on purpose: the gateway must keep working (cache fails open) if Redis is down.
export function connectRedis() {
  redis.connect().catch((err) => console.warn(`[redis] initial connect failed: ${err.message}`));
}

export const isRedisReady = () => redis.isReady;
