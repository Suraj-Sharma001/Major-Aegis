import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return v.trim();
}
const str = (name, def) => (process.env[name] && process.env[name].trim()) || def;
const num = (name, def) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be a number (got "${raw}")`);
  return n;
};
const bool = (name, def) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
};

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');

const encryptionKey = required('ENCRYPTION_KEY');
if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
  throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
}

// BYOK: there is deliberately NO OPENAI_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY here.
export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  isProd: str('NODE_ENV', 'development') === 'production',
  port: num('PORT', 8081),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  jwtSecret,
  jwtExpiresIn: str('JWT_EXPIRES_IN', '7d'),
  encryptionKey,
  embedding: {
    url: str('EMBEDDING_SERVICE_URL', 'http://localhost:8002').replace(/\/$/, ''),
    timeoutMs: num('EMBEDDING_TIMEOUT_MS', 4000),
  },
  cache: {
    enabled: bool('CACHE_ENABLED', true),
    ttlSeconds: num('CACHE_TTL_SECONDS', 86400),
    maxEntriesPerScope: num('CACHE_MAX_ENTRIES_PER_SCOPE', 500),
    simStrong: num('CACHE_SIM_STRONG', 0.9),
    simWeak: num('CACHE_SIM_WEAK', 0.65),
    keywordMin: num('CACHE_KEYWORD_MIN', 0.5),
  },
  providerBaseUrls: {
    OPENAI: str('OPENAI_BASE_URL', 'https://api.openai.com').replace(/\/$/, ''),
    CLAUDE: str('ANTHROPIC_BASE_URL', 'https://api.anthropic.com').replace(/\/$/, ''),
    GEMINI: str('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com').replace(/\/$/, ''),
    OLLAMA: str('OLLAMA_BASE_URL', 'http://localhost:11434').replace(/\/$/, ''),
  },
  providerTimeoutMs: num('PROVIDER_TIMEOUT_MS', 60000),
};
