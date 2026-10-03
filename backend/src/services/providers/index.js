import { prisma } from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { AppError } from '../../lib/errors.js';
import * as openai from './openai.provider.js';
import * as claude from './claude.provider.js';
import * as gemini from './gemini.provider.js';
import * as ollama from './ollama.provider.js';

const ADAPTERS = { OPENAI: openai, CLAUDE: claude, GEMINI: gemini, OLLAMA: ollama };

// gpt*/o1/o3/o4 -> OpenAI, claude* -> Claude, gemini* -> Gemini, everything else -> Ollama (local).
export function resolveProvider(model) {
  const m = model.toLowerCase();
  if (/^(gpt|chatgpt|o\d)/.test(m)) return 'OPENAI';
  if (m.startsWith('claude')) return 'CLAUDE';
  if (m.startsWith('gemini')) return 'GEMINI';
  return 'OLLAMA';
}

// BYOK: only the calling organization's own active key is ever used. There is no shared fallback.
async function getOrgKey(organizationId, provider) {
  const record = await prisma.providerKey.findFirst({
    where: { organizationId, provider, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) {
    throw new AppError(
      400,
      `No active ${provider} provider key is configured for your organization. An admin must add one via POST /provider-keys.`,
    );
  }
  return decrypt(record.encryptedKey);
}

export async function callProvider({ provider, organizationId, model, messages, temperature, maxTokens }) {
  const apiKey = provider === 'OLLAMA' ? null : await getOrgKey(organizationId, provider);
  return ADAPTERS[provider].chat({ apiKey, model, messages, temperature, maxTokens });
}
