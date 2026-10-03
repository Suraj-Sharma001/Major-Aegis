import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { postJson } from './http.js';

// Local models: no API key, no SDK, plain REST.
export async function chat({ model, messages, temperature, maxTokens }) {
  const options = {};
  if (temperature !== undefined) options.temperature = temperature;
  if (maxTokens) options.num_predict = maxTokens;

  const data = await postJson('OLLAMA', `${env.providerBaseUrls.OLLAMA}/api/chat`, {}, {
    model,
    messages,
    stream: false,
    ...(Object.keys(options).length ? { options } : {}),
  });

  const content = data.message?.content;
  if (typeof content !== 'string') throw new AppError(502, 'OLLAMA returned no message content');
  const prompt = data.prompt_eval_count ?? 0;
  const completion = data.eval_count ?? 0;
  return { content, usage: { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion } };
}
