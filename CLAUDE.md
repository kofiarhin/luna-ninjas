# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Run server (port 5000) + client (port 5173) concurrently
npm run server     # Backend only with nodemon
npm run client     # Frontend only via Vite
npm test           # Jest tests with --watchAll (root level)
```

Run a single test file or by name:
```bash
npm test -- server/tests/scores.test.js
npm test -- -t "POST /api/scores returns 401"
```

Client-specific (run from `client/`):
```bash
npm run build      # Production build → client/dist/
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

## Architecture

Monorepo with `client/` (React 19 + Vite 7 + SASS) and `server/` (Express 5 + MongoDB via Mongoose).

### Backend (`server/`)

- **Auth:** Custom JWT auth via `middleware/authMiddleware.js`. Verifies Bearer token, extracts MongoDB `_id` from payload, exposes as `req.auth.userId`. Requires `JWT_SECRET` in `.env`.
- **Score submission:** `POST /api/scores` (auth-gated) recomputes score server-side using `constants/scoring.js` WEIGHT_MAP (`points = table - 1`). Accepts optional `operation` field (defaults to `"multiplication"`). Uses atomic `$inc` on the User document. Returns 404 if user not found — no auto-creation.
- **Leaderboard:** `GET /api/leaderboard` (public) returns top 20 users by `totalScore` desc. Only includes users with `totalScore > 0` and a displayable name. Never exposes `passwordHash`, `email`, or `_id`.
- **Auth routes:** `POST /api/auth/register` and `POST /api/auth/login` return `{ token, user }`. `GET /api/auth/me` (auth-gated) returns current user's safe fields — used by frontend on load to hydrate auth state. `PATCH /api/auth/profile` (auth-gated) updates `fullName`, `username`, `displayName`, `profileImage`.
- **Smart Practice (Insights):** `POST /api/insights/record` upserts fact mastery via `bulkWrite`. `GET /api/insights` returns all mastery records for a user. `GET /api/insights/smart-round?operation=<multiplication|division>&table=2..12` returns 12 adaptive facts. Facts are classified as "unseen", "learning", "weak", or "strong". If fewer than 6 facts have been attempted, a `lowData: true` flag is returned alongside random facts.
- **LLM questions:** `POST /api/questions` calls Groq API (llama-3.3-70b-versatile) for adaptive question generation. History sanitized to last 10 games. Not yet wired into the frontend game loop.

### Frontend (`client/src/`)

- **Auth context:** `context/AuthContext.jsx` — `AuthProvider` wraps the app. On mount, reads `luna_token` from `localStorage` and calls `GET /api/auth/me` to hydrate `user`. Exposes `{ user, token, login, logout, updateUser, isLoaded }` via `useAuth()`. Never decodes JWT client-side.
- **Routing:** React Router DOM. `/game` and `/profile` and `/insights` are auth-gated via `PrivateRoute` in `App.jsx`.
- **Game flow:** `Pages/Game/Game.jsx` manages table selection → `components/MultiplicationGame/MultiplicationGame.jsx` runs the round (12 questions, 8s timer, 5 lives, streak bonuses).
- **Question generation:** `utils/questionGenerator.js` — pure client-side `generateRound(table)` produces 12 shuffled questions with dynamically generated wrong answers. No server call.
- **Scoring:** `utils/scoring.js` mirrors the backend WEIGHT_MAP for UI display. Server always recomputes authoritatively.
- **Hooks:** `useSubmitScore.js`, `useLeaderboard.js`, `useUpdateProfile.js` (returns `{ update, loading, error, fieldErrors }`), `useSmartRound.js`, `useInsights.js`, `useRecordInsights.js`.
- **BASE_URL:** `constants/constans.js` (note: filename typo) switches between `localhost:5000` and Heroku prod via `import.meta.env.DEV`.

### Data Models

**User** (`models/user.model.js`): `fullName` (required), `email` (unique, required), `passwordHash` (required, `select: false`), `username` (optional, sparse unique index, lowercase), `displayName` (deprecated — use username/fullName fallback), `profileImage` (default `""`), `totalScore` (indexed), `gamesPlayed`, timestamps.

**FactMastery** (`models/factMastery.model.js`): `userId`, `factA`, `factB`, `operation` (`"multiplication"` | `"division"`), `correct`, `wrong`, `lastSeen`. Multiplication facts normalize to `factA = min(a,b), factB = max(a,b)` for commutativity. Division stores `factA = divisor (table), factB = quotient`.

### Test Patterns

- Tests live in `server/tests/` and `client/src/utils/`. Jest config picks up both.
- Backend tests use `supertest` for route testing with all models and controllers mocked (no live DB).
- Auth is mocked via custom header `x-test-user-id`.

## Required Environment Variables

Root `.env`:
```
MONGO_URI=              # MongoDB connection string
JWT_SECRET=             # Random 64-char secret for signing JWTs
GROQ_API_KEY=           # Groq API key (for LLM question generation — tests mock this)
```

## Gotchas

- `JWT_SECRET` missing from `.env` causes 401 on all protected endpoints — check server logs for the startup warning from `authMiddleware.js`.
- The constants filename is `constans.js` (typo) — imported throughout the client as `constants/constans`.
- `passwordHash` has `select: false` in the schema — login handler explicitly re-selects with `.select("+passwordHash")`.
- Route file `questionRoutres.js` also has a typo (double 'r') — keep consistent if importing.
- Username registration is deferred: `POST /api/auth/register` only requires `fullName`, `email`, `password`. Username is set later via `PATCH /api/auth/profile`. Leaderboard display falls back to `fullName` if `username` is blank.
- Deployment: frontend to Namecheap via GitHub Actions FTP (`ci.yml` on push to main), backend to Heroku.
