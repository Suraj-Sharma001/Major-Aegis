import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { chatSchema } from '../utils/validators.js';
import { callProvider, resolveProvider } from '../services/providers/index.js';
import { calculateCost } from '../services/pricing.service.js';
import * as semanticCache from '../services/semanticCache.service.js';

// Phase 1 pipeline:
//   API-key auth (middleware) -> validate -> semantic cache lookup -> provider call (BYOK) -> audit log -> respond
// Later phases slot rate limiting and governance in before the cache lookup.
export async function chatCompletion(req, res) {
  const started = Date.now();
  const body = chatSchema.parse(req.body);
  if (body.stream) throw new AppError(400, 'Streaming is not supported in Phase 1. Send stream:false or omit it.');

  const { application, apiKeyId, organizationId } = req.gateway;
  const { model, messages, temperature, max_tokens: maxTokens } = body;
  const provider = resolveProvider(model);

  const log = (data) =>
    prisma.auditLog
      .create({ data: { applicationId: application.id, apiKeyId, provider, model, ...data } })
      .catch((err) => console.error('[audit] failed to write log:', err.message));

  try {
    // ---- 1. semantic cache ----
    const ctx = semanticCache.buildCacheContext(messages);
    let cacheStatus = 'bypass';
    let lookup = null;
    if (ctx) {
      lookup = await semanticCache.lookup({ organizationId, model, ...ctx });
      cacheStatus = lookup.status; // hit | miss | disabled | unavailable
    }

    if (lookup?.status === 'hit') {
      const { response } = lookup.entry;
      const saved = calculateCost(provider, model, response.usage.prompt_tokens, response.usage.completion_tokens);
      const latency = Date.now() - started;
      await log({
        status: 'CACHED',
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        latencyMs: latency,
        costUsd: 0,
        savedCostUsd: saved,
        cacheHit: true,
        similarityScore: lookup.similarity,
      });
      return res.json({
        model,
        provider,
        content: response.content,
        usage: response.usage,
        latency_ms: latency,
        cache_hit: true,
        cache_status: 'hit',
        similarity_score: Number(lookup.similarity.toFixed(4)),
        cost_usd: 0,
        saved_usd: saved,
      });
    }

    // ---- 2. provider call (organization's own key) ----
    const result = await callProvider({ provider, organizationId, model, messages, temperature, maxTokens });
    const cost = calculateCost(provider, model, result.usage.prompt_tokens, result.usage.completion_tokens);
    const latency = Date.now() - started;

    await log({
      status: 'SUCCESS',
      promptTokens: result.usage.prompt_tokens,
      completionTokens: result.usage.completion_tokens,
      totalTokens: result.usage.total_tokens,
      latencyMs: latency,
      costUsd: cost,
    });

    // ---- 3. remember the answer for next time ----
    if (lookup?.status === 'miss') {
      await semanticCache.store({
        organizationId,
        model,
        ...ctx,
        embedding: lookup.embedding,
        response: { content: result.content, usage: result.usage, provider },
      });
    }

    const out = {
      model,
      provider,
      content: result.content,
      usage: result.usage,
      latency_ms: latency,
      cache_hit: false,
      cache_status: cacheStatus,
      cost_usd: cost,
    };
    // Handy while tuning thresholds; hidden in production.
    if (!env.isProd && lookup?.status === 'miss') {
      out.cache_debug = {
        best_similarity: Number(lookup.bestSimilarity.toFixed(4)),
        best_keyword_overlap: Number(lookup.bestOverlap.toFixed(4)),
      };
    }
    return res.json(out);
  } catch (err) {
    await log({
      status: 'ERROR',
      latencyMs: Date.now() - started,
      errorMessage: String(err.message || err).slice(0, 500),
    });
    throw err;
  }
}
