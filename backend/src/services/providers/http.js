import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';

// POST JSON to a provider and normalise failures into AppErrors.
// Never put request headers (API keys) into error messages.
export async function postJson(providerName, url, headers, body) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(env.providerTimeoutMs),
    });
  } catch (err) {
    const hint = providerName === 'OLLAMA' ? ` Is Ollama running at ${env.providerBaseUrls.OLLAMA}?` : '';
    throw new AppError(502, `${providerName} is unreachable: ${err.cause?.code || err.message}.${hint}`);
  }

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const msg = json?.error?.message || (typeof json?.error === 'string' ? json.error : null) || text.slice(0, 300);
    const status = res.status === 429 ? 429 : 502;
    throw new AppError(status, `${providerName} error (HTTP ${res.status}): ${msg}`);
  }
  if (!json) throw new AppError(502, `${providerName} returned a non-JSON response`);
  return json;
}
