# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Run server (port 5000) + client (port 5173) concurrently
npm run server     # Backend only with nodemon
npm run client     # Frontend only via Vite
npm test           # Jest tests with --watchAll (root level)
```

Client-specific (run from `client/`):
```bash
npm run build      # Production build → client/dist/
npm run lint       # ESLint
```

## Architecture

Monorepo with `client/` (React 19 + Vite 7) and `server/` (Express 5 + MongoDB via Mongoose).

### Backend (`server/`)

- **Auth:** Custom JWT auth via `middleware/authMiddleware.js` using `jsonwebtoken`. Verifies Bearer token, extracts MongoDB `_id` from payload, exposes as `req.auth.userId`. Requires `JWT_SECRET` in `.env`.
- **Score submission:** `POST /api/scores` (auth-gated) recomputes score server-side using `constants/scoring.js` WEIGHT_MAP (`points = table - 1`). Uses atomic `$inc` on the User document. Returns 404 if user not found — no auto-creation.
- **Leaderboard:** `GET /api/leaderboard` (public) returns top 20 users by `totalScore` desc. Never exposes `passwordHash`, `email`, or `_id`.
- **Registration:** `POST /api/auth/register` creates User document. `displayName` is derived from `fullName`. Returns `{ token, user }`.
- **Login:** `POST /api/auth/login` verifies email + bcrypt password. Returns `{ token, user }`.
- **Me:** `GET /api/auth/me` (auth-gated) returns the current user's safe fields. Used by the frontend on app load to hydrate auth state.
- **LLM questions:** `POST /api/questions` calls Groq API (llama-3.3-70b-versatile) for adaptive question generation. History sanitized to last 10 games to limit tokens.

### Frontend (`client/src/`)

- **Auth context:** `context/AuthContext.jsx` — `AuthProvider` wraps the app. On mount, reads `luna_token` from `localStorage` and calls `GET /api/auth/me` to hydrate `user`. Exposes `{ user, token, login, logout, isLoaded }` via `useAuth()`.
- **Routing:** React Router DOM. `/game` is auth-gated via a `PrivateRoute` component that reads from `AuthContext`. Redirects to `/login` if unauthenticated.
- **Game flow:** `Pages/Game/Game.jsx` manages table selection state → `components/MultiplicationGame/MultiplicationGame.jsx` runs the round (12 questions, 8s timer, 5 lives, streak bonuses).
- **Question generation:** `utils/questionGenerator.js` — pure client-side function `generateRound(table)` produces 12 shuffled questions with dynamically generated wrong answers. No server dependency.
- **Scoring:** `utils/scoring.js` mirrors the backend WEIGHT_MAP for UI display. Server always recomputes authoritatively.
- **Hooks:** `hooks/useSubmitScore.js` reads JWT from `AuthContext` and attaches it to score POST. `hooks/useLeaderboard.js` fetches public leaderboard on mount.
- **BASE_URL:** `constants/constans.js` (note: typo in filename) switches between `localhost:5000` (dev) and Heroku (prod) via `import.meta.env.DEV`.

### Data Model

User schema (`models/user.model.js`): `fullName` (required), `email` (unique, required), `passwordHash` (required, never returned in queries by default — `select: false`), `username` (optional, sparse unique index, stored lowercase), `displayName`, `totalScore` (indexed for leaderboard), `gamesPlayed`, timestamps.

## Required Environment Variables

Root `.env`:
```
MONGO_URI=              # MongoDB connection string
JWT_SECRET=             # Random 64-char secret for signing JWTs
                        # Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
GROQ_API_KEY=           # Groq API key (for LLM question generation)
```

`client/.env`:
```
# No variables required.
```

## Gotchas

- `JWT_SECRET` missing from `.env` causes 401 on all protected endpoints — check server logs for the startup warning from `authMiddleware.js`.
- The constants filename is `constans.js` (typo) — imported throughout the client as `constants/constans`.
- `passwordHash` has `select: false` in the schema — it is never returned by default. The login handler explicitly re-selects it with `.select("+passwordHash")`.
- Deployment: frontend to Namecheap via GitHub Actions FTP (`ci.yml` on push to main), backend to Heroku. Update `JWT_SECRET` in Heroku config vars.

## Spec

The detailed auth migration spec lives in `_plan/custom-auth-replace-clerk.md` — covers API contracts, validation rules, edge cases, and acceptance criteria.
