import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { postJson } from './http.js';

export async function chat({ apiKey, model, messages, temperature, maxTokens }) {
  const body = { model, messages };
  if (maxTokens) body.max_tokens = maxTokens;
  if (temperature !== undefined) body.temperature = temperature;

  const url = `${env.providerBaseUrls.GROK}/v1/chat/completions`;
  const data = await postJson('GROK', url, { authorization: `Bearer ${apiKey}` }, body);

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new AppError(502, 'GROK returned no message content');
  const u = data.usage || {};
  return {
    content,
    usage: {
      prompt_tokens: u.prompt_tokens ?? 0,
      completion_tokens: u.completion_tokens ?? 0,
      total_tokens: u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0),
    },
  };
}