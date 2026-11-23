// The backend only has per-application analytics, so the Overview merges them in the browser.
export function mergeAnalytics(list) {
  const sum = (f) => list.reduce((s, a) => s + f(a), 0);
  const totalRequests = sum((a) => a.totalRequests);
  const errors = sum((a) => a.errors);
  const cacheHits = sum((a) => a.cacheHits);
  const cacheMisses = sum((a) => a.cacheMisses);
  const served = cacheHits + cacheMisses;

  // Weighted average of a latency field; weight = number of requests behind it.
  const wavg = (get, weight) => {
    let n = 0, d = 0;
    list.forEach((a) => {
      const v = get(a);
      const w = weight(a);
      if (v != null && w > 0) { n += v * w; d += w; }
    });
    return d ? Math.round(n / d) : null;
  };

  const providers = new Map();
  list.forEach((a) => a.byProvider.forEach((p) => {
    const cur = providers.get(p.provider) || { provider: p.provider, requests: 0, tokens: 0, costUsd: 0, savedUsd: 0 };
    cur.requests += p.requests; cur.tokens += p.tokens; cur.costUsd += p.costUsd; cur.savedUsd += p.savedUsd;
    providers.set(p.provider, cur);
  }));

  return {
    totalRequests, errors, cacheHits, cacheMisses,
    cacheHitRate: served ? cacheHits / served : 0,
    tokens: { prompt: sum((a) => a.tokens.prompt), completion: sum((a) => a.tokens.completion), total: sum((a) => a.tokens.total) },
    costUsd: sum((a) => a.costUsd),
    savedByCacheUsd: sum((a) => a.savedByCacheUsd),
    avgLatencyMs: {
      overall: wavg((a) => a.avgLatencyMs.overall, (a) => a.totalRequests),
      cached: wavg((a) => a.avgLatencyMs.cached, (a) => a.cacheHits),
      uncached: wavg((a) => a.avgLatencyMs.uncached, (a) => a.cacheMisses),
    },
    byProvider: [...providers.values()],
  };
}
