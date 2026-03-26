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
npm run preview    # Preview production build locally
```

## Architecture

Monorepo with `client/` (React 19 + Vite 7 + SASS) and `server/` (Express 5 + MongoDB via Mongoose).

### Backend (`server/`)

- **Auth:** Custom JWT auth via `middleware/authMiddleware.js`. Verifies Bearer token, extracts MongoDB `_id` from payload, exposes as `req.auth.userId`. Requires `JWT_SECRET` in `.env`.
- **Score submission:** `POST /api/scores` (auth-gated) recomputes score server-side using `constants/scoring.js` WEIGHT_MAP (`points = table - 1`). Uses atomic `$inc` on the User document. Returns 404 if user not found — no auto-creation.
- **Leaderboard:** `GET /api/leaderboard` (public) returns top 20 users by `totalScore` desc. Never exposes `passwordHash`, `email`, or `_id`.
- **Auth routes:** `POST /api/auth/register` and `POST /api/auth/login` return `{ token, user }`. `GET /api/auth/me` (auth-gated) returns current user's safe fields — used by frontend on load to hydrate auth state.
- **LLM questions:** `POST /api/questions` calls Groq API (llama-3.3-70b-versatile) for adaptive question generation. History sanitized to last 10 games. Infrastructure is prepared but not yet wired into the frontend game loop.

### Frontend (`client/src/`)

- **Auth context:** `context/AuthContext.jsx` — `AuthProvider` wraps the app. On mount, reads `luna_token` from `localStorage` and calls `GET /api/auth/me` to hydrate `user`. Exposes `{ user, token, login, logout, isLoaded }` via `useAuth()`.
- **Routing:** React Router DOM. `/game` is auth-gated via `PrivateRoute` in `App.jsx` that reads from `AuthContext`. Redirects to `/login` if unauthenticated.
- **Game flow:** `Pages/Game/Game.jsx` manages table selection → `components/MultiplicationGame/MultiplicationGame.jsx` runs the round (12 questions, 8s timer, 5 lives, streak bonuses).
- **Question generation:** `utils/questionGenerator.js` — pure client-side `generateRound(table)` produces 12 shuffled questions with dynamically generated wrong answers. No server call.
- **Scoring:** `utils/scoring.js` mirrors the backend WEIGHT_MAP for UI display. Server always recomputes authoritatively.
- **Hooks:** `useSubmitScore.js` attaches JWT from `AuthContext` to score POST. `useLeaderboard.js` fetches public leaderboard on mount.
- **BASE_URL:** `constants/constans.js` (note: filename typo) switches between `localhost:5000` and Heroku prod via `import.meta.env.DEV`.

### Data Model

User schema (`models/user.model.js`): `fullName` (required), `email` (unique, required), `passwordHash` (required, `select: false`), `username` (optional, sparse unique index, lowercase), `displayName`, `totalScore` (indexed for leaderboard), `gamesPlayed`, timestamps.

## Required Environment Variables

Root `.env`:
```
MONGO_URI=              # MongoDB connection string
JWT_SECRET=             # Random 64-char secret for signing JWTs
GROQ_API_KEY=           # Groq API key (for LLM question generation)
```

## Gotchas

- `JWT_SECRET` missing from `.env` causes 401 on all protected endpoints — check server logs for the startup warning from `authMiddleware.js`.
- The constants filename is `constans.js` (typo) — imported throughout the client as `constants/constans`.
- `passwordHash` has `select: false` in the schema — login handler explicitly re-selects with `.select("+passwordHash")`.
- Route file `questionRoutres.js` also has a typo (double 'r') — keep consistent if importing.
- Deployment: frontend to Namecheap via GitHub Actions FTP (`ci.yml` on push to main), backend to Heroku.
