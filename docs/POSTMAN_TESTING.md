# 🛡️ Aegis — Postman API Testing Guide

> **Base URL:** `http://localhost:8081`
> Test every endpoint in order — each step gives you the IDs and tokens needed for the next step.

---

## Prerequisites

1. Docker containers running → `docker compose up -d`
2. Embedding service running → `uvicorn app:app --port 8002`
3. Backend running → `npm run dev`
4. Verify → `GET http://localhost:8081/health` should show database `"up"`

---

## Step 1 — Health Check

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8081/health` |
| **Headers** | None |
| **Body** | None |

**✅ Check:**
- Status: `200`
- `database` is `"up"`
- `redis` is `"up"`
- `embedding` is `"up"`
- `semanticCache` is `"active"`

---

## Step 2 — Register (Creates Org + Admin + Default Team)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8081/auth/register` |
| **Headers** | `Content-Type: application/json` |

**Body:**
```json
{
    "organizationName": "Acme Corp",
    "name": "Suraj",
    "email": "admin@acme.com",
    "password": "MyPass1234"
}
```

**✅ Check:**
- Status: `201`
- 📋 Copy `token` → use as `ADMIN_TOKEN` everywhere
- 📋 Copy `organization.id` → `ORG_ID`
- 📋 Copy `defaultTeam.id` → `DEFAULT_TEAM_ID`
- `user.role` is `"ADMIN"`

**❌ Error tests:**
- Same request again → `409` (duplicate email)
- Remove `name` field → `400` (validation error)
- `"password": "hi"` → `400` (too short, min 8 chars)
- `"email": "not-an-email"` → `400`

---

## Step 3 — Login

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8081/auth/login` |
| **Headers** | `Content-Type: application/json` |

**Body:**
```json
{
    "email": "admin@acme.com",
    "password": "MyPass1234"
}
```

**✅ Check:**
- Status: `200`
- Returns `token` and `user`

**❌ Error tests:**
- Wrong password → `401` — "Invalid email or password"
- Non-existent email → `401` — same generic error (no info leak)

---

## Step 4 — Get My Profile

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8081/auth/me` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**✅ Check:**
- Status: `200`
- Shows `user`, `organization`, `teams` array

**❌ Error tests:**
- No Authorization header → `401` — "Missing Authorization: Bearer <token>"
- Random/fake token → `401` — "Invalid or expired token"

---

## Step 5 — Create a Team

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8081/teams` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**Body:**
```json
{
    "name": "Backend Team"
}
```

**✅ Check:**
- Status: `201`
- 📋 Copy `team.id` → `SECOND_TEAM_ID`

**❌ Error tests:**
- Same name again → `409` (unique per org)
- Empty name `""` → `400`

---

## Step 6 — List Teams

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8081/teams` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**✅ Check:**
- Status: `200`
- Array with "Default Team" and "Backend Team"
- Each team has `_count.members` and `_count.applications`

---

## Step 7 — Add a Member to a Team (creates their account)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8081/teams/DEFAULT_TEAM_ID/members` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**Body:**
```json
{
    "email": "dev@acme.com",
    "name": "Dev User",
    "password": "DevPass1234",
    "role": "DEVELOPER"
}
```

**✅ Check:**
- Status: `201`
- `created: true` (new account was made)
- 📋 Copy `member.id` → `DEV_USER_ID`
- Now login as dev (`POST /auth/login` with dev@acme.com) → 📋 Copy token → `DEV_TOKEN`

**❌ Error tests:**
- Same request again → `409` (already a member)
- New email but no `name`/`password` → `400` ("Provide name and password to create one")
- Email from another org → `409` ("belongs to an account in another organization")

---

## Step 8 — List Team Members

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8081/teams/DEFAULT_TEAM_ID/members` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**✅ Check:**
- Status: `200`
- Members array with `id`, `email`, `name`, `role`, `joinedAt`

---

## Step 9 — Remove a Member

| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `http://localhost:8081/teams/SECOND_TEAM_ID/members/DEV_USER_ID` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

> Only try this if you added the dev to the second team first.

**✅ Check:**
- Status: `200`
- `removed: true`

**❌ Error tests:**
- Same DELETE again → `404` (not a member anymore)

---

## Step 10 — Create an Application

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8081/applications` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**Body:**
```json
{
    "name": "My AI App",
    "teamId": "DEFAULT_TEAM_ID"
}
```

**✅ Check:**
- Status: `201`
- 📋 Copy `application.id` → `APP_ID`
- `team.id` matches your `DEFAULT_TEAM_ID`

**❌ Error tests:**
- Missing `teamId` → `400` ("teamId is required")
- Fake/random `teamId` → `404` ("Team not found")

---

## Step 11 — Issue an API Key

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8081/applications/APP_ID/keys` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**Body:**
```json
{
    "label": "my-key"
}
```

**✅ Check:**
- Status: `201`
- ⚠️ **COPY the `key` value** (starts with `aegis_`) — shown only once!
- 📋 `key` → `API_KEY`
- 📋 `id` → `KEY_ID`
- `warning` says "shown only once"

---

## Step 12 — List API Keys

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8081/applications/APP_ID/keys` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**✅ Check:**
- Status: `200`
- Shows `keyPrefix`, `label`, `isActive`
- **Never shows** the raw key or hash

---

## Step 13 — Revoke an API Key

> Issue a second key first (repeat Step 11 with `"label": "temp-key"`), then revoke that one. Keep your main `API_KEY` alive for gateway tests.

| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `http://localhost:8081/applications/APP_ID/keys/KEY_ID_TO_REVOKE` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**✅ Check:**
- Status: `200`
- `revoked: true`

**❌ Error tests:**
- Non-existent keyId → `404`

---

## Step 14 — Add a Provider Key (BYOK)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8081/provider-keys` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**Body:**
```json
{
    "provider": "OPENAI",
    "label": "My OpenAI Key",
    "apiKey": "sk-proj-your-real-openai-key-here"
}
```

Valid `provider` values: `OPENAI`, `GEMINI`, `CLAUDE`

**✅ Check:**
- Status: `201`
- `keyHint` shows `"...here"` (last 4 chars)
- Raw key is **never** returned
- 📋 Copy `key.id` → `PROVIDER_KEY_ID`

**❌ Error tests:**
- Use `DEV_TOKEN` instead → `403` (admin only)
- `"provider": "HUGGINGFACE"` → `400` (invalid enum)
- `"apiKey": "short"` → `400` (too short)

---

## Step 15 — List Provider Keys

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8081/provider-keys` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**✅ Check:**
- Status: `200`
- Shows metadata only — no encrypted key, no raw key

---

## Step 16 — Delete a Provider Key

| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `http://localhost:8081/provider-keys/PROVIDER_KEY_ID` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**✅ Check:**
- Status: `200`
- `deleted: true`

**❌ Error tests:**
- Non-existent ID → `404`

---

## Step 17 — Gateway: Chat Completion 🚀

> ⚠️ Use the `aegis_` API key here, **NOT** the JWT token!
> Make sure you have an active provider key (Step 14) for the model's provider.

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8081/v1/chat/completions` |
| **Headers** | `x-api-key: API_KEY` and `Content-Type: application/json` |

**Body:**
```json
{
    "model": "gpt-4o-mini",
    "messages": [
        { "role": "user", "content": "What is 2+2?" }
    ]
}
```

**✅ Check (first call — cache miss):**
- Status: `200`
- `provider` is `"OPENAI"`
- `content` has the AI response
- `cache_hit` is `false`
- `cache_status` is `"miss"`
- `cost_usd` is > 0

**✅ Send the exact same request again (cache hit):**
- `cache_hit` is `true`
- `cache_status` is `"hit"`
- `cost_usd` is `0`
- `saved_usd` is > 0
- `similarity_score` is >= 0.9

**❌ Error tests:**
- No `x-api-key` header → `401` — "Missing x-api-key header"
- Fake API key → `401` — "Invalid or revoked API key"
- `"stream": true` → `400` — "Streaming is not supported in Phase 1"
- `"messages": []` → `400` — validation error
- No provider key configured for the model → `400` — tells admin to add one

**Optional body fields:**
```json
{
    "model": "gpt-4o-mini",
    "messages": [{ "role": "user", "content": "Hello" }],
    "temperature": 0.7,
    "max_tokens": 100
}
```

---

## Step 18 — Model Routing Tests

Use Step 17's setup but change the `model` field. Each routes to a different provider:

| `model` value | Routes to | Needs provider key? |
|---|---|---|
| `gpt-4o-mini` | OPENAI | Yes |
| `gpt-4.1` | OPENAI | Yes |
| `o4-mini` | OPENAI | Yes |
| `claude-sonnet-4-20250514` | CLAUDE | Yes |
| `gemini-2.5-flash` | GEMINI | Yes |
| `llama3.2` | OLLAMA | No (local) |
| `mistral` | OLLAMA | No (local) |

Add the matching provider key (Step 14) before testing each provider.

---

## Step 19 — View Analytics

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8081/applications/APP_ID/analytics` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**✅ Check:**
- Status: `200`
- `totalRequests` — how many calls
- `cacheHits` / `cacheMisses` / `cacheHitRate`
- `costUsd` — total money spent
- `savedByCacheUsd` — money saved
- `tokens.prompt`, `tokens.completion`, `tokens.total`
- `avgLatencyMs.cached` vs `avgLatencyMs.uncached`
- `byProvider` — breakdown per provider

---

## Step 20 — View Audit Logs

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8081/applications/APP_ID/logs?limit=10` |
| **Headers** | `Authorization: Bearer ADMIN_TOKEN` |

**✅ Check:**
- Status: `200`
- Each log has: `provider`, `model`, `status` (SUCCESS/CACHED/ERROR), `latencyMs`, `costUsd`, `cacheHit`

---

## Step 21 — RBAC Tests (Role-Based Access)

Login as the DEVELOPER user from Step 7:
```
POST /auth/login → { "email": "dev@acme.com", "password": "DevPass1234" }
```

Use the dev's token for these:

| Action | Expected Result |
|---|---|
| `GET /teams` | `200` — sees only teams they belong to |
| `POST /teams` | `403` — cannot create teams |
| `GET /teams/:id/members` | `403` — cannot list members |
| `POST /provider-keys` | `403` — cannot manage provider keys |
| `GET /provider-keys` | `403` — cannot view provider keys |
| `DELETE /provider-keys/:id` | `403` — cannot delete provider keys |
| `POST /applications` (own team) | `201` — allowed |
| `POST /applications` (other team) | `403` — "not a member of this application's team" |
| `GET /applications` | `200` — sees only own team's apps |

Create a VIEWER user the same way (Step 7 with `"role": "VIEWER"`) and test:

| Action | Expected Result |
|---|---|
| `POST /applications` | `403` — viewers can't create |
| `POST /applications/:id/keys` | `403` — viewers can't issue keys |
| `GET /applications/:id/keys` | `200` — can view (if on the team) |

---

## Step 22 — Cross-Org Isolation

1. Register a **second organization** (`POST /auth/register` with a new email)
2. Using the second org's token, try to access the first org's resources:

| Action | Expected |
|---|---|
| `GET /applications/FIRST_ORG_APP_ID/keys` | `404` — hidden, not `403` |
| `GET /teams/FIRST_ORG_TEAM_ID/members` | `404` — hidden |
| `DELETE /provider-keys/FIRST_ORG_PROVIDER_KEY_ID` | `404` — hidden |

The system returns `404` (not `403`) so it doesn't even reveal that the resource **exists**.

---

## Step 23 — Edge Cases

| Test | How | Expected |
|---|---|---|
| Invalid JSON body | Send `{bad` as raw body to any POST | `400` — "Request body is not valid JSON" |
| Route not found | `GET /nonexistent` | `404` — "Route not found: GET /nonexistent" |
| Revoked key at gateway | Revoke a key (Step 13), then use it at Step 17 | `401` — "Invalid or revoked API key" |
| Temperature out of range | `"temperature": 5.0` in gateway body | `400` — validation |
| Negative max_tokens | `"max_tokens": -1` | `400` — validation |
| Gateway auth via Bearer | `Authorization: Bearer aegis_xxx` instead of `x-api-key` | `200` — works too |

---

## Quick Reference — All Endpoints

| # | Method | URL | Auth Type | Who Can Use |
|---|---|---|---|---|
| 1 | `GET` | `/health` | None | Anyone |
| 2 | `POST` | `/auth/register` | None | Anyone |
| 3 | `POST` | `/auth/login` | None | Anyone |
| 4 | `GET` | `/auth/me` | JWT | All roles |
| 5 | `GET` | `/teams` | JWT | All roles (scoped) |
| 6 | `POST` | `/teams` | JWT | ADMIN |
| 7 | `GET` | `/teams/:id/members` | JWT | ADMIN |
| 8 | `POST` | `/teams/:id/members` | JWT | ADMIN |
| 9 | `DELETE` | `/teams/:id/members/:userId` | JWT | ADMIN |
| 10 | `GET` | `/applications` | JWT | All roles (scoped) |
| 11 | `POST` | `/applications` | JWT | ADMIN, DEVELOPER |
| 12 | `POST` | `/applications/:id/keys` | JWT | ADMIN, DEVELOPER |
| 13 | `GET` | `/applications/:id/keys` | JWT | All roles (team) |
| 14 | `DELETE` | `/applications/:id/keys/:keyId` | JWT | ADMIN, DEVELOPER |
| 15 | `GET` | `/applications/:id/analytics` | JWT | All roles (team) |
| 16 | `GET` | `/applications/:id/logs?limit=` | JWT | All roles (team) |
| 17 | `GET` | `/provider-keys` | JWT | ADMIN |
| 18 | `POST` | `/provider-keys` | JWT | ADMIN |
| 19 | `DELETE` | `/provider-keys/:id` | JWT | ADMIN |
| 20 | `POST` | `/v1/chat/completions` | API Key (`x-api-key`) | Any valid `aegis_` key |

---

## Values to Save As You Go

| Variable | Where You Get It | Used In |
|---|---|---|
| `ADMIN_TOKEN` | Step 2 (register) or Step 3 (login) | All JWT-protected endpoints |
| `DEV_TOKEN` | Step 7 → login as dev | RBAC tests |
| `ORG_ID` | Step 2 response | Reference |
| `DEFAULT_TEAM_ID` | Step 2 response | Steps 7, 8, 10 |
| `SECOND_TEAM_ID` | Step 5 response | Step 9, RBAC tests |
| `DEV_USER_ID` | Step 7 response | Step 9 |
| `APP_ID` | Step 10 response | Steps 11–16, 19, 20 |
| `API_KEY` | Step 11 response (`aegis_...`) | Step 17 (gateway) |
| `KEY_ID` | Step 11 response | Step 13 |
| `PROVIDER_KEY_ID` | Step 14 response | Step 16 |

> 💡 **Tip:** In Postman, create an Environment called "Aegis Local" and save these as variables. Then use `{{ADMIN_TOKEN}}`, `{{APP_ID}}` etc. in your requests instead of pasting manually.
