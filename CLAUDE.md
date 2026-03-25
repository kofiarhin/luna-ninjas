# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Luna Ninjas is a full-stack math education game where kids practice multiplication facts (1-12) with adaptive difficulty powered by Groq LLM (llama-3.3-70b-versatile). Monorepo with `client/` (React + Vite) and `server/` (Express + MongoDB).

## Commands

```bash
npm run dev        # Run server + client concurrently (main dev command)
npm run server     # Backend only with nodemon (port 5000)
npm run client     # Frontend only via Vite
npm test           # Jest tests with --watchAll
npm run build      # Build client (from client/ dir, outputs to client/dist/)
npm run lint       # ESLint (from client/ dir)
```

## Architecture

### Backend (`server/`)
- **server.js** → starts Express, connects MongoDB via `config/db.js`
- **app.js** → Express app setup (CORS, JSON middleware, route mounting)
- **Routes:** `/api/auth` (registration), `/api/questions` (LLM question generation)
- **Models:** User model stores Clerk auth data (`clerkUserId`, email, name, imageUrl)
- **utility/helper.js** → `generateMultiplicationQuestions(history, sessionSize)` calls Groq API
- **utility/systemPrompts.js** → LLM system prompt defining adaptive question generation rules and JSON output format

### Frontend (`client/src/`)
- **React 19 + Vite 7** with SASS styling
- **Auth:** Clerk (`@clerk/clerk-react`) handles login/register; post-signup syncs user to MongoDB
- **Routing:** React Router DOM — `/home`, `/login`, `/register`, `/post-signup`, `/game`, `/dashboard`, `/playground`
- **Core game component:** `components/MultiplicationGame/MultiplicationGame.jsx` — 3 difficulty tiers (Easy 8s, Medium 6s, Ninja 4s timer), 5 lives, streak bonuses, localStorage history
- **Constants:** `client/src/constans.js` (note: typo in filename) — `BASE_URL` switches between localhost:5000 and Heroku production API

### Auth Flow
Clerk handles authentication → post-signup redirects to `/post-signup` → POSTs user data to `/api/auth/register` → MongoDB User document created → redirect to app

### Deployment
- Frontend: Namecheap FTP via GitHub Actions (`ci.yml`) on push to main
- Backend: Heroku
- E2E: Playwright tests run post-deployment in CI
