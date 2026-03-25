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

- **Auth:** Clerk JWT verification via `middleware/clerkAuth.js` using `@clerk/express`. Extracts `clerkUserId` from verified token — never from request body. Requires `CLERK_SECRET_KEY` in `.env`.
- **Score submission:** `POST /api/scores` (auth-gated) recomputes score server-side using `constants/scoring.js` WEIGHT_MAP (`points = table - 1`). Uses atomic `$inc` with upsert on the User document.
- **Leaderboard:** `GET /api/leaderboard` (public) returns top 20 users by `totalScore` desc. Never exposes `clerkUserId`, `email`, or `imageUrl`.
- **Registration:** `POST /api/auth/register` creates User document with `displayName` derived from Clerk profile (fullName > firstName > "Anonymous Ninja").
- **LLM questions:** `POST /api/questions` calls Groq API (llama-3.3-70b-versatile) for adaptive question generation. History sanitized to last 10 games to limit tokens.

### Frontend (`client/src/`)

- **Routing:** React Router DOM. `/game` is auth-gated via `<SignedIn>` from Clerk. Post-signup syncs user to MongoDB via `/post-signup`.
- **Game flow:** `Pages/Game/Game.jsx` manages table selection state → `components/MultiplicationGame/MultiplicationGame.jsx` runs the round (12 questions, 8s timer, 5 lives, streak bonuses).
- **Question generation:** `utils/questionGenerator.js` — pure client-side function `generateRound(table)` produces 12 shuffled questions with dynamically generated wrong answers. No server dependency.
- **Scoring:** `utils/scoring.js` mirrors the backend WEIGHT_MAP for UI display. Server always recomputes authoritatively.
- **Hooks:** `hooks/useSubmitScore.js` attaches Clerk JWT to score POST. `hooks/useLeaderboard.js` fetches public leaderboard on mount.
- **BASE_URL:** `constants/constans.js` (note: typo in filename) switches between `localhost:5000` (dev) and Heroku (prod) via `import.meta.env.DEV`.

### Data Model

User schema (`models/user.model.js`): `clerkUserId` (unique, indexed), `email`, `firstName`, `lastName`, `imageUrl`, `displayName`, `totalScore` (indexed for leaderboard), `gamesPlayed`, timestamps.

## Required Environment Variables

Root `.env`:
```
MONGO_URI=              # MongoDB connection string
CLERK_SECRET_KEY=       # Clerk backend secret (Dashboard → Configure → API Keys)
CLERK_PUBLISHABLE_KEY=  # Clerk publishable key
GROQ_API_KEY=           # Groq API key (for LLM question generation)
```

`client/.env`:
```
VITE_CLERK_PUBLISHABLE_KEY=  # Clerk publishable key for frontend
```

## Gotchas

- `CLERK_SECRET_KEY` missing from `.env` causes silent 401 on score submission — check server logs for the warning from `clerkAuth.js`.
- The constants filename is `constans.js` (typo) — imported throughout the client as `constants/constans`.
- Score endpoint upserts users who submit before completing registration, defaulting `displayName` to "Anonymous Ninja".
- Deployment: frontend to Namecheap via GitHub Actions FTP (`ci.yml` on push to main), backend to Heroku.

## Spec

The detailed implementation spec lives in `_plan/times-table-game-refactor.md` — covers API contracts, validation rules, edge cases, phased execution plan, and acceptance criteria.
