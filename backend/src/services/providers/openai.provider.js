import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { postJson } from './http.js';

// Reasoning-style models (o-series, gpt-5) take max_completion_tokens and ignore custom temperature.
const isReasoning = (model) => /^(o\d|gpt-5)/i.test(model);

export async function chat({ apiKey, model, messages, temperature, maxTokens }) {
  const body = { model, messages };
  if (isReasoning(model)) {
    if (maxTokens) body.max_completion_tokens = maxTokens;
  } else {
    if (temperature !== undefined) body.temperature = temperature;
    if (maxTokens) body.max_tokens = maxTokens;
  }

  const data = await postJson('OPENAI', `${env.providerBaseUrls.OPENAI}/v1/chat/completions`, {
    authorization: `Bearer ${apiKey}`,
  }, body);

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new AppError(502, 'OPENAI returned no message content');
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
