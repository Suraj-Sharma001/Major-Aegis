import { prisma } from '../config/prisma.js';
import { assertCanAccessApplication } from '../lib/authz.js';

const round = (n, d = 6) => (n == null ? 0 : Math.round(n * 10 ** d) / 10 ** d);

// Cache hit reporting + cost savings for one application.
export async function applicationAnalytics(req, res) {
  const app = await assertCanAccessApplication(req.user, req.params.id);
  const where = { applicationId: app.id };

  const [totals, hits, errors, byProvider, latencyByCache] = await Promise.all([
    prisma.auditLog.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true, costUsd: true, savedCostUsd: true },
      _avg: { latencyMs: true },
    }),
    prisma.auditLog.count({ where: { ...where, cacheHit: true } }),
    prisma.auditLog.count({ where: { ...where, status: 'ERROR' } }),
    prisma.auditLog.groupBy({
      by: ['provider'],
      where,
      _count: { _all: true },
      _sum: { totalTokens: true, costUsd: true, savedCostUsd: true },
    }),
    prisma.auditLog.groupBy({ by: ['cacheHit'], where: { ...where, status: { not: 'ERROR' } }, _avg: { latencyMs: true } }),
  ]);

  const total = totals._count._all;
  const served = total - errors; // requests that actually returned an answer
  const avgFor = (flag) => latencyByCache.find((r) => r.cacheHit === flag)?._avg.latencyMs ?? null;

  res.json({
    application: { id: app.id, name: app.name },
    totalRequests: total,
    errors,
    cacheHits: hits,
    cacheMisses: served - hits,
    cacheHitRate: served > 0 ? round(hits / served, 4) : 0,
    tokens: {
      prompt: totals._sum.promptTokens ?? 0,
      completion: totals._sum.completionTokens ?? 0,
      total: totals._sum.totalTokens ?? 0,
    },
    costUsd: round(totals._sum.costUsd),
    savedByCacheUsd: round(totals._sum.savedCostUsd),
    avgLatencyMs: {
      overall: totals._avg.latencyMs == null ? null : Math.round(totals._avg.latencyMs),
      cached: avgFor(true) == null ? null : Math.round(avgFor(true)),
      uncached: avgFor(false) == null ? null : Math.round(avgFor(false)),
    },
    byProvider: byProvider.map((p) => ({
      provider: p.provider,
      requests: p._count._all,
      tokens: p._sum.totalTokens ?? 0,
      costUsd: round(p._sum.costUsd),
      savedUsd: round(p._sum.savedCostUsd),
    })),
  });
}
