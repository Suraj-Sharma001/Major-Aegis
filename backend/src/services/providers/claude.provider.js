import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { postJson } from './http.js';

export async function chat({ apiKey, model, messages, temperature, maxTokens }) {
  // Anthropic takes the system prompt as a top-level field and requires max_tokens.
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const convo = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));

  const body = { model, max_tokens: maxTokens ?? 1024, messages: convo };
  if (system) body.system = system;
  if (temperature !== undefined) body.temperature = temperature;

  const data = await postJson('CLAUDE', `${env.providerBaseUrls.CLAUDE}/v1/messages`, {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }, body);

  const content = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (!content) throw new AppError(502, 'CLAUDE returned no text content');
  const u = data.usage || {};
  return {
    content,
    usage: {
      prompt_tokens: u.input_tokens ?? 0,
      completion_tokens: u.output_tokens ?? 0,
      total_tokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
    },
  };
}
