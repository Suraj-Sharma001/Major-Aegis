import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { postJson } from './http.js';

export async function chat({ apiKey, model, messages, temperature, maxTokens }) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const body = { contents };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const generationConfig = {};
  if (temperature !== undefined) generationConfig.temperature = temperature;
  if (maxTokens) generationConfig.maxOutputTokens = maxTokens;
  if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;

  // Key goes in a header (not the query string) so it can never leak into URLs or logs.
  const url = `${env.providerBaseUrls.GEMINI}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const data = await postJson('GEMINI', url, { 'x-goog-api-key': apiKey }, body);

  const parts = data.candidates?.[0]?.content?.parts;
  const content = (parts || []).map((p) => p.text || '').join('');
  if (!content) {
    const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || 'no content';
    throw new AppError(502, `GEMINI returned no text (${reason})`);
  }
  const u = data.usageMetadata || {};
  const prompt = u.promptTokenCount ?? 0;
  const completion = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
  return {
    content,
    usage: { prompt_tokens: prompt, completion_tokens: completion, total_tokens: u.totalTokenCount ?? prompt + completion },
  };
}
