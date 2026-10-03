import { randomUUID, createHash } from 'node:crypto';
import { redis, isRedisReady } from '../config/redis.js';
import { env } from '../config/env.js';
import { embed } from './embedding.service.js';

/*
 * Hybrid semantic cache.
 *   HIT if  similarity >= STRONG
 *       OR (similarity >= WEAK AND keywordOverlap >= KEYWORD_MIN)
 *
 * Why hybrid: pure embedding similarity is unreliable on short, differently-worded queries
 * (paraphrases score 0.76-0.84), so keyword overlap acts as a second opinion for the middle band.
 *
 * Isolation: entries are scoped per (organization, model) and per conversation-context fingerprint,
 * so one tenant can never receive another tenant's cached answer, and the same question asked in a
 * different conversation context does not collide.
 *
 * Redis layout:
 *   aegis:cache:entry:<org>:<model>:<id>  -> JSON entry   (EX = TTL)
 *   aegis:cache:idx:<org>:<model>         -> ZSET of ids  (score = createdAt ms)
 */

const STOPWORDS = new Set(
  ('a an the is are was were be been am do does did to of in on at for with and or but if so it its this that ' +
    'these those i me my you your we our they them what which who whom how why when where can could should would ' +
    'will shall may might please tell explain give about into from as by than then there here also just ' +
    'some any').split(' '),
);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Jaccard overlap of keyword sets (0..1). Conservative: needs a real share of the vocabulary.
export function keywordOverlap(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export function cosine(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function isHit(similarity, overlap) {
  const c = env.cache;
  return similarity >= c.simStrong || (similarity >= c.simWeak && overlap >= c.keywordMin);
}

// Cache key material: the last user message is the "query"; everything before it is "context".
// Returns null when the request should bypass the cache (e.g. last message is not from the user).
export function buildCacheContext(messages) {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') return null;
  const context = messages.slice(0, -1).map((m) => [m.role, m.content]);
  const fingerprint = createHash('sha256').update(JSON.stringify(context)).digest('hex').slice(0, 16);
  return { queryText: last.content, fingerprint };
}

const scope = (orgId, model) => `${orgId}:${String(model).toLowerCase()}`;
const entryKey = (s, id) => `aegis:cache:entry:${s}:${id}`;
const idxKey = (s) => `aegis:cache:idx:${s}`;

async function loadEntries(s) {
  const ids = await redis.zRange(idxKey(s), 0, -1);
  if (ids.length === 0) return [];
  const raw = await redis.mGet(ids.map((id) => entryKey(s, id)));
  const entries = [];
  const dead = [];
  raw.forEach((val, i) => {
    if (val) entries.push(JSON.parse(val));
    else dead.push(ids[i]); // TTL expired
  });
  if (dead.length) await redis.zRem(idxKey(s), dead);
  return entries;
}

/**
 * @returns {Promise<
 *   {status:'hit', entry, similarity, overlap, embedding} |
 *   {status:'miss', embedding, bestSimilarity, bestOverlap} |
 *   {status:'disabled'|'unavailable', reason?: string}>}
 */
export async function lookup({ organizationId, model, queryText, fingerprint }) {
  if (!env.cache.enabled) return { status: 'disabled' };
  if (!isRedisReady()) return { status: 'unavailable', reason: 'redis is not connected' };

  let embedding;
  try {
    embedding = await embed(queryText);
  } catch (err) {
    console.warn(`[cache] embedding unavailable, skipping cache: ${err.message}`);
    return { status: 'unavailable', reason: 'embedding service unavailable' };
  }

  try {
    const entries = await loadEntries(scope(organizationId, model));
    let best = null;
    let bestSimilarity = 0;
    let bestOverlap = 0;

    for (const e of entries) {
      if (e.fingerprint !== fingerprint) continue;
      const similarity = cosine(embedding, e.embedding);
      const overlap = keywordOverlap(queryText, e.queryText);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestOverlap = overlap;
      }
      if (isHit(similarity, overlap) && (!best || similarity > best.similarity)) {
        best = { entry: e, similarity, overlap };
      }
    }
    if (best) return { status: 'hit', ...best, embedding };
    return { status: 'miss', embedding, bestSimilarity, bestOverlap };
  } catch (err) {
    console.warn(`[cache] lookup failed: ${err.message}`);
    return { status: 'unavailable', reason: 'redis error' };
  }
}

// Best-effort: a failed store must never fail the user's request.
export async function store({ organizationId, model, queryText, fingerprint, embedding, response }) {
  if (!env.cache.enabled || !isRedisReady() || !embedding) return;
  try {
    const s = scope(organizationId, model);
    const id = randomUUID();
    const now = Date.now();
    const entry = {
      id,
      queryText,
      fingerprint,
      embedding: embedding.map((x) => Math.round(x * 1e5) / 1e5),
      response,
      createdAt: now,
    };
    await redis.set(entryKey(s, id), JSON.stringify(entry), { EX: env.cache.ttlSeconds });
    await redis.zAdd(idxKey(s), { score: now, value: id });
    await redis.zRemRangeByScore(idxKey(s), '-inf', now - env.cache.ttlSeconds * 1000);

    const overflow = (await redis.zCard(idxKey(s))) - env.cache.maxEntriesPerScope;
    if (overflow > 0) {
      const oldest = await redis.zRange(idxKey(s), 0, overflow - 1);
      if (oldest.length) {
        await redis.del(oldest.map((x) => entryKey(s, x)));
        await redis.zRem(idxKey(s), oldest);
      }
    }
    await redis.expire(idxKey(s), env.cache.ttlSeconds);
  } catch (err) {
    console.warn(`[cache] store failed: ${err.message}`);
  }
}
