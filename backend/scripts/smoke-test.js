// End-to-end smoke test for Aegis Phase 1. Needs the backend running (npm run dev) plus Postgres + Redis.
//
//   npm run smoke
//   SMOKE_MODEL=llama3.2 npm run smoke          # local Ollama model used for the gateway/cache checks
//   SMOKE_ALL_PROVIDERS=1 npm run smoke         # also exercise OpenAI/Claude/Gemini adapters (needs mock-providers, see README)
//
// Section D needs a model that actually answers. If Ollama is not running, section D is SKIPPED (not failed).
const BASE = process.env.BASE_URL || 'http://localhost:8081';
const MODEL = process.env.SMOKE_MODEL || 'llama3.2';
const ALL = process.env.SMOKE_ALL_PROVIDERS === '1';
const run = Date.now().toString(36);

let passed = 0, failed = 0, skipped = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; console.log(`  FAIL  ${name} ${extra}`); }
};
const info = (msg) => console.log(`  INFO  ${msg}`);
const section = (t) => console.log(`\n== ${t} ==`);

async function api(method, path, { token, key, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (key) headers['x-api-key'] = key;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}
const chat = (key, content, extra = {}) =>
  api('POST', '/v1/chat/completions', { key, body: { model: MODEL, messages: [{ role: 'user', content }], ...extra } });

async function main() {
  const health = await api('GET', '/health');
  console.log(`Aegis smoke test -> ${BASE}`);
  console.log(`health: ${JSON.stringify(health.data)}`);
  if (health.status === 0 || !health.data) throw new Error('Backend not reachable');

  // ---------------- A. Authentication ----------------
  section('A. Authentication & roles');
  const adminEmail = `admin+${run}@a.test`;
  let r = await api('POST', '/auth/register', { body: { organizationName: `Org A ${run}`, name: 'Alice Admin', email: adminEmail, password: 'password123' } });
  ok('register creates org + admin (201)', r.status === 201 && r.data.token && r.data.user.role === 'ADMIN', JSON.stringify(r.data));
  const A = r.data;
  r = await api('POST', '/auth/register', { body: { organizationName: 'Dup Org', name: 'Dup', email: adminEmail, password: 'password123' } });
  ok('duplicate email rejected (409)', r.status === 409);
  r = await api('POST', '/auth/register', { body: { organizationName: 'Org', name: 'n', email: 'bad', password: '1' } });
  ok('invalid input rejected with details (400)', r.status === 400 && Array.isArray(r.data.details));
  r = await api('POST', '/auth/login', { body: { email: adminEmail, password: 'wrong-password' } });
  ok('wrong password rejected (401)', r.status === 401);
  r = await api('POST', '/auth/login', { body: { email: adminEmail, password: 'password123' } });
  ok('login returns JWT (200)', r.status === 200 && !!r.data.token);
  r = await api('GET', '/auth/me', { token: A.token });
  ok('/auth/me lists the Default Team', r.status === 200 && r.data.teams.some((t) => t.name === 'Default Team'));
  r = await api('GET', '/applications');
  ok('protected route without token -> 401', r.status === 401);
  r = await api('GET', '/applications', { token: 'garbage' });
  ok('protected route with bad token -> 401', r.status === 401);

  // ---------------- B. Multi-tenancy & teams ----------------
  section('B. Multi-tenancy, teams, RBAC');
  r = await api('POST', '/teams', { token: A.token, body: { name: 'Engineering' } });
  const eng = r.data.team;
  ok('admin creates team Engineering', r.status === 201 && eng?.id);
  r = await api('POST', '/teams', { token: A.token, body: { name: 'Data' } });
  const data = r.data.team;
  ok('admin creates team Data', r.status === 201 && data?.id);
  r = await api('POST', `/teams/${eng.id}/members`, { token: A.token, body: { email: `dev+${run}@a.test`, name: 'Dev Dan', password: 'password123', role: 'DEVELOPER' } });
  ok('admin creates developer account inside team', r.status === 201 && r.data.created === true);
  r = await api('POST', `/teams/${eng.id}/members`, { token: A.token, body: { email: `view+${run}@a.test`, name: 'View Vera', password: 'password123', role: 'VIEWER' } });
  ok('admin creates viewer account inside team', r.status === 201 && r.data.member.role === 'VIEWER');

  const dev = (await api('POST', '/auth/login', { body: { email: `dev+${run}@a.test`, password: 'password123' } })).data;
  const viewer = (await api('POST', '/auth/login', { body: { email: `view+${run}@a.test`, password: 'password123' } })).data;

  r = await api('POST', '/teams', { token: dev.token, body: { name: 'Hack' } });
  ok('developer cannot create teams (403)', r.status === 403);
  r = await api('GET', '/teams', { token: dev.token });
  ok('developer sees only own teams', r.status === 200 && r.data.teams.length === 1 && r.data.teams[0].name === 'Engineering');

  r = await api('POST', '/applications', { token: dev.token, body: { name: 'Chatbot', teamId: eng.id } });
  const appA = r.data.application;
  ok('developer creates app in own team', r.status === 201 && appA?.id);
  r = await api('POST', '/applications', { token: dev.token, body: { name: 'Sneaky', teamId: data.id } });
  ok('developer cannot create app in foreign team (403)', r.status === 403);
  r = await api('POST', '/applications', { token: dev.token, body: { name: 'NoTeam' } });
  ok('team must be chosen explicitly (400)', r.status === 400);

  r = await api('POST', '/applications', { token: A.token, body: { name: 'Secret Analytics', teamId: data.id } });
  const secret = r.data.application;
  ok('admin creates app in Data team', r.status === 201 && secret?.id);
  r = await api('GET', '/applications', { token: dev.token });
  ok('developer list hides other teams\' apps', r.data.applications.length === 1 && r.data.applications[0].id === appA.id);
  r = await api('GET', '/applications', { token: A.token });
  ok('admin sees every app in the org', r.data.applications.length === 2);
  r = await api('GET', `/applications/${secret.id}/analytics`, { token: dev.token });
  ok('developer cannot read foreign team analytics (403)', r.status === 403);
  r = await api('GET', `/applications/${secret.id}/logs`, { token: dev.token });
  ok('developer cannot read foreign team logs (403)', r.status === 403);

  r = await api('POST', '/applications', { token: viewer.token, body: { name: 'V', teamId: eng.id } });
  ok('viewer cannot create apps (403)', r.status === 403);
  r = await api('GET', '/applications', { token: viewer.token });
  ok('viewer can read own team\'s apps', r.status === 200 && r.data.applications.length === 1);
  r = await api('POST', `/applications/${appA.id}/keys`, { token: viewer.token, body: {} });
  ok('viewer cannot issue keys (403)', r.status === 403);

  // second organization
  r = await api('POST', '/auth/register', { body: { organizationName: `Org B ${run}`, name: 'Bob Admin', email: `admin+${run}@b.test`, password: 'password123' } });
  const B = r.data;
  ok('second organization registered', r.status === 201);
  r = await api('GET', `/applications/${appA.id}/analytics`, { token: B.token });
  ok('org B cannot see org A application (404)', r.status === 404);
  r = await api('GET', '/applications', { token: B.token });
  ok('org B app list is empty', r.status === 200 && r.data.applications.length === 0);
  r = await api('POST', `/teams/${B.defaultTeam.id}/members`, { token: B.token, body: { email: adminEmail } });
  ok('cannot pull another org\'s user into your team (409)', r.status === 409);
  r = await api('GET', `/teams/${eng.id}/members`, { token: B.token });
  ok('org B cannot list org A team members (404)', r.status === 404);

  // ---------------- C. BYOK & keys ----------------
  section('C. API keys & BYOK');
  r = await api('POST', `/applications/${appA.id}/keys`, { token: dev.token, body: { label: 'prod' } });
  const key = r.data.key;
  ok('developer issues gateway key (aegis_...)', r.status === 201 && key?.startsWith('aegis_'));
  const keyId = r.data.id;
  r = await api('GET', `/applications/${appA.id}/keys`, { token: dev.token });
  ok('key list shows metadata only, never plaintext', r.status === 200 && r.data.keys.length === 1 && !('key' in r.data.keys[0]) && !('keyHash' in r.data.keys[0]));

  r = await api('POST', '/provider-keys', { token: dev.token, body: { provider: 'OPENAI', apiKey: 'sk-test-0000abcd1234wxyz' } });
  ok('developer cannot add provider keys (403)', r.status === 403);
  r = await api('POST', '/provider-keys', { token: A.token, body: { provider: 'OPENAI', label: 'main', apiKey: 'sk-test-0000abcd1234wxyz' } });
  ok('admin adds OpenAI key', r.status === 201 && r.data.key.keyHint === '...wxyz');
  ok('response never echoes the key or ciphertext', !JSON.stringify(r.data).includes('sk-test') && !('encryptedKey' in r.data.key));
  r = await api('GET', '/provider-keys', { token: A.token });
  ok('provider key list is metadata only', r.status === 200 && r.data.keys.every((k) => !('encryptedKey' in k) && !('apiKey' in k)));
  r = await api('GET', '/provider-keys', { token: B.token });
  ok('org B sees none of org A\'s provider keys', r.status === 200 && r.data.keys.length === 0);

  r = await api('POST', '/v1/chat/completions', { body: { model: MODEL, messages: [{ role: 'user', content: 'hi' }] } });
  ok('gateway without API key -> 401', r.status === 401);
  r = await api('POST', '/v1/chat/completions', { key: 'aegis_' + '0'.repeat(48), body: { model: MODEL, messages: [{ role: 'user', content: 'hi' }] } });
  ok('gateway with unknown API key -> 401', r.status === 401);
  r = await chat(key, 'hello', { model: 'gemini-2.0-flash' });
  ok('BYOK: no Gemini key for org -> clear 400, no shared fallback', r.status === 400 && /No active GEMINI/.test(r.data.error), JSON.stringify(r.data));
  r = await chat(key, 'hello', { stream: true });
  ok('stream:true rejected with explanation (400)', r.status === 400);
  r = await api('POST', '/v1/chat/completions', { key, body: { model: MODEL, messages: [] } });
  ok('empty messages rejected (400)', r.status === 400);

  // ---------------- D. Gateway + semantic cache ----------------
  section(`D. Gateway + semantic cache (model: ${MODEL})`);
  const q1 = `What is semantic caching in simple words? (${run})`;
  r = await chat(key, q1);
  if (r.status !== 200) {
    skipped += 1;
    console.log(`  SKIP  model "${MODEL}" did not answer (HTTP ${r.status}: ${r.data?.error}).`);
    console.log('        Start Ollama and pull the model, or run with the mock providers (see README) and re-run.');
  } else {
    ok('first request is a cache miss', r.data.cache_hit === false);
    info(`cache_status=${r.data.cache_status}`);
    if (r.data.cache_status === 'unavailable' || r.data.cache_status === 'disabled') {
      info('Semantic cache is not active (Redis or embedding service down?). Cache checks below will fail.');
    }
    const first = r.data.content;
    r = await chat(key, q1);
    ok('identical request is a cache HIT', r.data.cache_hit === true && r.data.similarity_score >= 0.9, JSON.stringify(r.data));
    ok('cached response returns the same content', r.data.content === first);
    ok('cached response is billed $0', r.data.cost_usd === 0);

    const para = `what is semantic caching in simple terms? (${run})`;
    r = await chat(key, para);
    info(`paraphrase -> ${r.data.cache_hit ? 'HIT' : 'MISS'} ${r.data.similarity_score ?? JSON.stringify(r.data.cache_debug ?? '')}`);

    r = await chat(key, `How do I bake sourdough bread? (${run})`);
    ok('unrelated question is a MISS', r.data.cache_hit === false);

    r = await api('POST', '/v1/chat/completions', { key, body: { model: MODEL, messages: [
      { role: 'system', content: 'Answer like a pirate.' }, { role: 'user', content: q1 }] } });
    ok('same question in a different context (system prompt) is a MISS', r.data.cache_hit === false);

    // tenant isolation: org B asks the exact same thing
    const bApp = (await api('POST', '/applications', { token: B.token, body: { name: 'B app', teamId: B.defaultTeam.id } })).data.application;
    const bKey = (await api('POST', `/applications/${bApp.id}/keys`, { token: B.token, body: {} })).data.key;
    r = await chat(bKey, q1);
    ok('TENANT ISOLATION: org B never gets org A\'s cached answer', r.status === 200 && r.data.cache_hit === false, JSON.stringify(r.data));

    r = await api('GET', `/applications/${appA.id}/analytics`, { token: dev.token });
    const an = r.data;
    ok('analytics reports cache hits', r.status === 200 && an.cacheHits >= 1, JSON.stringify(an));
    ok('analytics: hit rate between 0 and 1', an.cacheHitRate > 0 && an.cacheHitRate <= 1);
    info(`requests=${an.totalRequests} hits=${an.cacheHits} hitRate=${an.cacheHitRate} savedUsd=${an.savedByCacheUsd} latency(cached/uncached)=${an.avgLatencyMs.cached}/${an.avgLatencyMs.uncached}ms`);
    r = await api('GET', `/applications/${appA.id}/logs?limit=5`, { token: dev.token });
    ok('audit logs are recorded', r.status === 200 && r.data.logs.length > 0 && r.data.logs.some((l) => l.status === 'CACHED'));
  }

  // ---------------- E. other providers (mock) ----------------
  if (ALL) {
    section('E. OpenAI / Claude / Gemini adapters (against mock-providers)');
    await api('POST', '/provider-keys', { token: A.token, body: { provider: 'CLAUDE', apiKey: 'sk-ant-test-claude9999' } });
    await api('POST', '/provider-keys', { token: A.token, body: { provider: 'GEMINI', apiKey: 'AIza-test-gemini5555' } });
    for (const [model, tag, last4] of [['gpt-4o-mini', 'MOCK-OPENAI', 'wxyz'], ['claude-sonnet-4-5', 'MOCK-CLAUDE', '9999'], ['gemini-2.0-flash', 'MOCK-GEMINI', '5555']]) {
      const q = `Name one planet (${model}) ${run}`;
      r = await chat(key, q, { model });
      ok(`${model}: routed to ${tag} using the ORG's own key (...${last4})`, r.status === 200 && r.data.content.includes(tag) && r.data.content.includes(`key=${last4}`), JSON.stringify(r.data));
      r = await chat(key, q, { model });
      ok(`${model}: repeat is a cache hit and saves money`, r.data.cache_hit === true && r.data.saved_usd > 0, JSON.stringify(r.data));
    }
  }

  // ---------------- F. revocation ----------------
  section('F. Key revocation');
  r = await api('DELETE', `/applications/${appA.id}/keys/${keyId}`, { token: dev.token });
  ok('developer revokes gateway key', r.status === 200);
  r = await chat(key, 'anything');
  ok('revoked key is rejected (401)', r.status === 401);

  console.log(`\nResult: ${passed} passed, ${failed} failed, ${skipped} section(s) skipped`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Smoke test crashed:', e.message); process.exit(2); });
