# Aegis_MajorP — Phase 1

**Aegis — Enterprise AI Gateway & Governance Platform**, phase-wise college version.
Phase 1 is backend-only (no UI) and contains exactly four features:

| # | Feature | Where it lives |
|---|---------|----------------|
| 1 | **Authentication & Authorization** — register (org + first admin), login (JWT), roles ADMIN / DEVELOPER / VIEWER, protected dashboard routes (JWT), protected gateway routes (API key) | `middleware/auth.middleware.js`, `middleware/apiKey.middleware.js`, `controllers/auth.controller.js`, `lib/jwt.js` |
| 2 | **Multi-Tenancy** — organization isolation, teams, team-scoped visibility, `assertCanAccessApplication` | `lib/authz.js`, `controllers/team.controller.js`, `controllers/application.controller.js` |
| 3 | **Gateway Core** — `POST /v1/chat/completions`, model-prefix routing, **BYOK**, AES-256-GCM key encryption, OpenAI / Claude / Gemini / Ollama | `controllers/gateway.controller.js`, `services/providers/*`, `lib/crypto.js`, `controllers/providerKey.controller.js` |
| 4 | **Semantic Caching** — hybrid (embedding + keyword) matching, Redis 24 h TTL, Python embedding service, cache-hit analytics, cost savings | `services/semanticCache.service.js`, `embedding-service/app.py`, `controllers/analytics.controller.js` |

Deliberately **not** in Phase 1: governance/PII scanning, rate limiting, streaming, UI.

```
Client app ──x-api-key──▶ POST /v1/chat/completions
                              │ 1. API-key auth
                              │ 2. validate body
                              │ 3. semantic cache  ◀──▶ Redis + embedding service (:8002)
                              │ 4. miss → provider call using the ORG's own encrypted key
                              │ 5. audit log (tokens, latency, cost, saved cost)
                              ▼
                   OpenAI | Claude | Gemini | Ollama
```

## Ports (so it can run next to the main Aegis project)

| Thing | Main Aegis | Aegis_MajorP |
|---|---|---|
| Backend | 8080 | **8081** |
| Postgres (host) | 5432 | **5433** |
| Redis (host) | 6379 | **6380** |
| Embedding service | 8001 | **8002** |

## Run it (Windows / PowerShell; macOS/Linux is the same minus the venv activate path)

```powershell
# 1) Postgres + Redis
docker compose up -d

# 2) Embedding service (separate terminal; first start downloads the model, ~400 MB)
cd embedding-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --port 8002

# 3) Backend (separate terminal)
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init      # creates the tables
npm run dev                             # http://localhost:8081

# 4) Check everything
curl http://localhost:8081/health       # database / redis / embedding should all be "up"
npm run smoke                           # ~60 end-to-end checks
```

`backend/.env` is already filled with fresh dev secrets. For anything shared, regenerate both:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (once for `JWT_SECRET`, once for `ENCRYPTION_KEY`).
If you change `ENCRYPTION_KEY`, previously stored provider keys can no longer be decrypted.

**No provider API keys live in `.env` (BYOK).** Each organization adds its own via the API (below). Ollama needs no key.

## Demo script (PowerShell)

```powershell
$base = "http://localhost:8081"
$json = "application/json"

# organization + admin (a "Default Team" is created automatically)
$reg = Invoke-RestMethod -Method Post "$base/auth/register" -ContentType $json -Body (@{
  organizationName="Demo Org"; name="Suraj"; email="suraj@demo.test"; password="password123" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($reg.token)" }

# teammate with a role, added to the Default Team
Invoke-RestMethod -Method Post "$base/teams/$($reg.defaultTeam.id)/members" -Headers $h -ContentType $json -Body (@{
  email="dev@demo.test"; name="Dev"; password="password123"; role="DEVELOPER" } | ConvertTo-Json)

# application + gateway key (the key is shown ONCE)
$app = Invoke-RestMethod -Method Post "$base/applications" -Headers $h -ContentType $json -Body (@{
  name="Chatbot"; teamId=$reg.defaultTeam.id } | ConvertTo-Json)
$key = (Invoke-RestMethod -Method Post "$base/applications/$($app.application.id)/keys" -Headers $h -ContentType $json -Body "{}").key

# BYOK: this organization's own Gemini key (any provider key works the same way)
Invoke-RestMethod -Method Post "$base/provider-keys" -Headers $h -ContentType $json -Body (@{
  provider="GEMINI"; apiKey="PASTE-YOUR-GEMINI-KEY" } | ConvertTo-Json)

# call the gateway TWICE with the same question: second one is a cache hit
$model = "gemini-2.5-flash"     # any Gemini model your key can use
$body  = @{ model=$model; messages=@(@{ role="user"; content="What is semantic caching in simple words?" }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post "$base/v1/chat/completions" -Headers @{ "x-api-key" = $key } -ContentType $json -Body $body
Invoke-RestMethod -Method Post "$base/v1/chat/completions" -Headers @{ "x-api-key" = $key } -ContentType $json -Body $body

# analytics: hit rate, tokens, cost, money saved by the cache
Invoke-RestMethod "$base/applications/$($app.application.id)/analytics" -Headers $h
```

Using a local model instead: `model = "llama3.2"` (anything not starting with gpt/claude/gemini goes to Ollama).

## API reference

| Method & path | Who | Notes |
|---|---|---|
| `POST /auth/register` | public | creates org + ADMIN + Default Team |
| `POST /auth/login` · `GET /auth/me` | public · JWT | |
| `GET /teams` | JWT | admin: all teams, others: own teams |
| `POST /teams` | ADMIN | |
| `GET /teams/:id/members` · `POST /teams/:id/members` · `DELETE /teams/:id/members/:userId` | ADMIN | POST adds an org user, or creates the account if `name` + `password` are given |
| `GET /applications` | JWT | team-filtered for non-admins |
| `POST /applications` | ADMIN, DEVELOPER | body `{name, teamId}`; developers only in their own teams |
| `POST /applications/:id/keys` · `GET …/keys` · `DELETE …/keys/:keyId` | ADMIN/DEVELOPER (issue, revoke) · team members (list) | key shown once, only a SHA-256 hash is stored |
| `GET /applications/:id/analytics` · `GET …/logs?limit=` | team members | cache hit rate, tokens, cost, savings, latency cached vs uncached |
| `GET/POST/DELETE /provider-keys` | ADMIN | `provider`: OPENAI, GEMINI, CLAUDE. Metadata only is ever returned. |
| `POST /v1/chat/completions` | API key | `{model, messages, temperature?, max_tokens?}` |
| `GET /health` | public | database / redis / embedding status |

Gateway response: `{model, provider, content, usage, latency_ms, cache_hit, cache_status, similarity_score?, cost_usd, saved_usd?}`.
`cache_status` is `hit | miss | unavailable | disabled | bypass`. `unavailable` means Redis or the embedding service is down: the request still works, just uncached.

## How the semantic cache decides

`HIT if similarity ≥ 0.90  OR  (similarity ≥ 0.65 AND keyword overlap ≥ 0.5)` — all three numbers are in `.env` (`CACHE_SIM_STRONG`, `CACHE_SIM_WEAK`, `CACHE_KEYWORD_MIN`).
Keyword overlap = Jaccard similarity of the non-stopword tokens. Entries are scoped per **organization + model + conversation context**, so one tenant can never read another tenant's cached answer. While `NODE_ENV` is not `production`, a miss includes `cache_debug` (best similarity/overlap seen) to help tune thresholds.

## Offline test doubles (optional)

`npm run mock:embedding` (port 8002, hashing-based, **not** semantic) and `npm run mock:providers` (port 9100, fakes OpenAI/Claude/Gemini/Ollama) let you run the full smoke test with no model download and no internet:

```
OPENAI_BASE_URL=http://localhost:9100 ANTHROPIC_BASE_URL=http://localhost:9100 GEMINI_BASE_URL=http://localhost:9100 OLLAMA_BASE_URL=http://localhost:9100 npm run dev
SMOKE_ALL_PROVIDERS=1 npm run smoke
```

## Known limitations (Phase 1)

No streaming · no rate limiting · no PII/governance scan · pricing table in `pricing.service.js` is illustrative (edit it) · cache lookup is a linear scan capped at 500 entries per org+model (fine for this scale; use a vector index later) · no pagination, no user-role editing UI/endpoint.
