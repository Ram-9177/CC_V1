# HostelConnect – Cursor Workspace Rules

These are the project rules Cursor should follow when proposing or applying code changes in this repository.

## Mission
Build and maintain HostelConnect as a production‑ready, low‑cost hostel management web app. Target free/near‑free hosting for 3k–5k users using:
- Cloudflare Pages (frontend) + Pages Functions (Workers runtime)
- MongoDB Atlas via official Node.js Driver (mongodb v6+) – NOT the Data API (deprecated Sept 2025)

## Architecture boundaries
- Frontend: React + TypeScript (Vite), source in `src/`, built to `build/`.
- Serverless API: Cloudflare Pages Functions in `functions/api/*` (Workers runtime).
- Database: MongoDB Atlas accessed ONLY from `functions/_utils/mongodb.ts` and functions under `functions/api/*`.
- Auth: JWT (HS256) using `jose` in `functions/_utils/jwt.ts`.

## Do and Don’t (strict)
- DO keep all database and sensitive logic in `functions/api/*`; DO reuse `functions/_utils/mongodb.ts` & `functions/_utils/jwt.ts`.
- DO keep the Vite client bundle free of Node built‑ins and server‑only libraries.
- DO use the thin fetch wrapper `src/lib/api.ts` from client code to call `/api/*` endpoints.
- DO add new endpoints under `functions/api/...` with clear input validation and JWT checks.
- DO update docs (`DEPLOYMENT.md`, `MONGODB_ATLAS_SETUP.md`, and `src/COMET_MASTER_PROMPT.md`) when infra/envs change.

- DON’T import `mongodb`, `mongoose`, `fs`, `net`, `tls`, `http`, `https`, `stream`, `dns`, `os`, `path`, or any Node core module from `src/`.
- DON’T import from `functions/` in client code. `functions/` is deployed by Cloudflare and is not part of the Vite bundle.
- DON’T re‑activate or expand the legacy root `api/` folder; it’s stubbed with 410 responses.
- DON’T introduce long‑lived servers or non‑edge backends.

## Vite and bundling hygiene
- `vite.config.ts` externalizes server‑only deps and aliases Node built‑ins to shims in `src/shims/*`.
- `server.watch.ignored` ignores `**/functions/**`. Rollup `input` is locked to `index.html`. Output is `build/`.
- If you add a dependency, ensure it doesn’t pull Node core into the client bundle. Favor ESM, browser‑safe libs.

## Environment variables (Cloudflare Pages)
- `MONGODB_CONNECTION_STRING`
- `MONGODB_DATABASE`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` (hashing may be introduced)
- `JWT_SECRET`

Never expose secrets to the client. Do not reference these from `src/`.

## Current API surface
- `POST /api/auth/login` → `{ token }`
- `GET /api/students`, `POST /api/students`
- `GET /api/students/:id`, `PUT /api/students/:id`, `DELETE /api/students/:id`
- `GET /api/rooms`, `POST /api/rooms`
- `GET /api/rooms/:id`, `PUT /api/rooms/:id`, `DELETE /api/rooms/:id`
- Optional: `GET /api/meals/intents/export?date=YYYY-MM-DD` → CSV

Auth header: `Authorization: Bearer <JWT>`

## Data shapes (minimal)
- Student: `{ _id, name, roll, email, room, createdAt }`
- Room: `{ _id, number, capacity, occupants }`

## Implementation rules for new endpoints
- Validate body/query (types, required fields). Return proper HTTP codes.
- Require JWT on protected routes via `verifyToken` in `_utils/jwt.ts`.
- Use MongoDB driver with duplicate checks before insert where applicable.
- Prefer indexed queries for frequent access; suggest index creation when patterns emerge.

## Client code rules
- Use `src/lib/api.ts` to call endpoints; keep functions small and typed.
- Do not import server code. Do not import Node core. Keep UI responsive and accessible.

## Tests & verification
- At minimum, run a smoke test locally:
  - `npm run build` should succeed.
  - Exercise one auth flow + one CRUD path (manual or small script).
- When possible, add lightweight tests (unit/integration) appropriate to the code touched.

## Style
- TypeScript throughout. Explicit types on public functions. Narrow `any`.
- Small, composable utilities; avoid over‑abstraction.

## Deployment notes
- Frontend build: `npm run build` → outputs to `build/`.
- Cloudflare Pages deploys `build/` and functions under `/functions` automatically.
- Set environment variables for both Production and Preview.

## Guardrails
- If a change would cause the client bundle to include `mongodb` or Node core, STOP and propose an alternative.
- If asked to re‑use legacy `api/` code, decline and migrate the logic to `functions/api/*`.

---
Use these rules as the authoritative guide when helping in this repository. Prefer simplicity, edge‑compatibility, and low running cost.
