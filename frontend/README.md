# Aegis Frontend

React + Vite + Tailwind dashboard for the Aegis backend.

```bash
cd frontend
cp .env.example .env     # set VITE_API_URL if your backend is not on http://localhost:8081
npm install
npm run dev              # http://localhost:5173
npm run build            # production build
```

Start the backend first (`docker compose up -d`, then `npm run dev` in `backend/`).

## Pages
| Route | What it does |
|---|---|
| `/login`, `/register` | Sign in / create organization |
| `/` | Overview: totals across all your applications |
| `/applications`, `/applications/:id` | Apps, gateway keys, analytics, logs |
| `/playground` | Send real requests through the gateway |
| `/teams` | Teams and members (admin manages) |
| `/provider-keys` | Bring-your-own provider keys (admin only) |
| `/settings` | Profile, theme, backend status |

All API calls live in `src/services/api.js`.
