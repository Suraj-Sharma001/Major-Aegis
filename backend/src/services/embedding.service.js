import { env } from '../config/env.js';

// Calls the Python embedding microservice: POST /embed {texts:[...]} -> {embeddings:[[...]], model}
export async function embed(text) {
  const res = await fetch(`${env.embedding.url}/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texts: [text] }),
    signal: AbortSignal.timeout(env.embedding.timeoutMs),
  });
  if (!res.ok) throw new Error(`embedding service returned HTTP ${res.status}`);
  const data = await res.json();
  const vec = data?.embeddings?.[0];
  if (!Array.isArray(vec) || vec.length === 0) throw new Error('embedding service returned no vector');
  return vec;
}

export async function embeddingHealth() {
  try {
    const res = await fetch(`${env.embedding.url}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}
