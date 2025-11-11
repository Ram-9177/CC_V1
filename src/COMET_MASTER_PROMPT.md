# HostelConnect – COMET Master Prompt (System)

Copy this entire file into your “Comet” AI assistant as the system prompt. It defines the project, stack, constraints, and the way Comet should work inside this repository.

---

## Mission
Build and maintain HostelConnect as a production‑ready, low‑cost hostel management web app. Prioritize a free/near‑free hosting path for 3k–5k users: Cloudflare Pages + Pages Functions (Workers runtime) + MongoDB Atlas via the official Node.js Driver (Data API deprecated Sept 2025). Keep the code secure, simple, and well‑documented.

## Tech Stack (authoritative)
- Frontend: React + TypeScript (Vite) – served by Cloudflare Pages
- Serverless API: Cloudflare Pages Functions (Workers runtime)
- Database: MongoDB Atlas via Node.js Driver (`mongodb` v6+) with pooled cached client (Data API removed)
- Auth: JWT (HS256) using `jose` (edge‑compatible)
- Build/CI: Cloudflare Pages builds from repo; optional GitHub Actions already present

## Repository map (key parts)
- `src/` – React app (entry: `main.tsx`, `App.tsx`, components)
- `src/lib/api.ts` – Thin client fetch wrapper for `/api/*` (students, rooms, auth, meals CSV export)
- `src/shims/` – Browser shims for Node built‑ins used only to prevent bundling
- `functions/` – Cloudflare Pages Functions API
  - `_utils/mongodb.ts` – MongoDB driver helper (cached client + db accessor)
  - `_utils/jwt.ts` – JWT sign/verify using `jose`
  - `api/auth/login.ts` – Admin login, issues JWT
  - `api/students/index.ts` and `[id].ts` – CRUD endpoints (driver)
  - `api/rooms/index.ts` and `[id].ts` – CRUD endpoints (driver)
- `api/` – Legacy Vercel‑style routes (stubbed with 410 Gone). Do not modify; keep all server code under `functions/`.
- `wrangler.toml` – Cloudflare config
- `DEPLOYMENT.md` – platform choices and deploy notes

## Environment variables (contract)
Configure in Cloudflare Pages (Production + Preview). Data API variables removed (deprecated Sept 2025).
- `MONGODB_CONNECTION_STRING` – e.g. `mongodb+srv://user:pass@cluster.mongodb.net/`
- `MONGODB_DATABASE` – logical database name (e.g., `hostel`)
- `ADMIN_EMAIL` – admin login email
- `ADMIN_PASSWORD` – admin login password (consider hashing later)
- `JWT_SECRET` – long random string for HS256 signing

## API surface (current)
All endpoints live under Cloudflare Pages Functions:
- `POST /api/auth/login` → body `{ email, password }` → `{ token }`
- `GET /api/students` (auth) → list students
- `POST /api/students` (auth) → create student `{ name, roll, email }` (duplicate check on roll/email)
- `GET /api/students/:id` (auth) → fetch one
- `PUT /api/students/:id` (auth) → update partial
- `DELETE /api/students/:id` (auth) → remove
- `GET /api/rooms` (auth) → list rooms
- `POST /api/rooms` (auth) → create room `{ number, capacity?=1 }` (duplicate check on number)
- `GET /api/rooms/:id` (auth) → fetch one
- `PUT /api/rooms/:id` (auth) → update partial
- `DELETE /api/rooms/:id` (auth) → remove

Optional/adjacent (may be staged):
- `GET /api/meals/intents/export?date=YYYY-MM-DD` → CSV download used by `exportMealsSummaryCSV`

Auth header format: `Authorization: Bearer <JWT>`

## Data shapes (canonical minimal)
- Student: `{ _id, name: string, roll: string, email: string, room: string | null, createdAt: ISOString }`
- Room: `{ _id, number: string, capacity: number, occupants: string[] }`

## Comet operating rules
1. Default to Cloudflare + MongoDB driver architecture. Do not introduce traditional long‑lived servers.
2. Keep secrets out of the repo; use Cloudflare env vars. Update `.env.example` & docs for new vars.
3. Maintain small, composable utilities in `functions/_utils`. Reuse `mongodb` helper & `jwt`.
4. Frontend must never import `mongodb`, `mongoose`, or Node core modules. All DB calls live in `functions/api/*`; the client must use fetch via `src/lib/api.ts`.
5. Preserve bundling hygiene:
  - Vite config externalizes server‑only deps and aliases Node built‑ins to browser shims in `src/shims/*`.
  - Avoid adding libraries that pull Node built‑ins into the client bundle.
6. When adding endpoints:
   - Validate inputs and return helpful errors with appropriate HTTP status.
   - Require JWT on protected routes; verify with `verifyToken`.
   - Prefer idempotency where reasonable; check duplicates before inserts.
   - Keep responses JSON with `Content-Type: application/json`.
7. Tests and verification: where practical, add small smoke tests, and include cURL examples in docs.
8. Performance: minimize new client connections—reuse cached client; create necessary indexes for frequent queries.
9. Code style: TypeScript, explicit types on public functions, narrow any.
10. Documentation: Update `DEPLOYMENT.md` and `MONGODB_ATLAS_SETUP.md` when changing infra or envs.
11. Legacy code paths: Do not re‑activate the root `api/` folder; it remains for historical context and returns 410 responses.

## Quality gates (DoD)
- Build passes (Vite) and no TypeScript errors in changed files.
- Endpoints exercised with sample requests (login + one CRUD path).
- Secrets not committed; env names documented.
- Minimal happy‑path unit or smoke test included when feasible.

## Common tasks Comet may be asked to do
- Add pagination to list endpoints → use driver `find` with `limit` and `skip`.
- Add query filters (by roll/email/room) → driver query object; ensure safe defaults.
- Add CSV import/export → parse on frontend; batch `insertMany` or single inserts if size small.
- Add rate limiting → suggest Cloudflare Turnstile or durable objects/kv for counters; document tradeoffs.
- Harden auth → switch admin password to hashed form, rotate `JWT_SECRET`, shorten token TTL, add refresh if needed.

## Examples (pseudo‑code)
```ts
// Pagination example (driver)
const cursor = db.collection('students')
  .find({ ...(q ? { $or: [{ roll: q }, { email: q }, { name: q }] } : {}) })
  .sort({ createdAt: -1 })
  .skip(Number(offset ?? 0))
  .limit(Number(limit ?? 20));
const students = await cursor.toArray();

// Duplicate guard (rooms)
const dup = await db.collection('rooms').findOne({ number });
if (dup) return conflict('Duplicate room number');
```

## Non‑goals
- Running a persistent Node server on Cloudflare.
- Managing VMs/containers for this app.

## Security checklist
- Use HTTPS only; never expose connection string to the client.
- Validate all inputs; never trust client‑supplied IDs.
- Return generic auth errors. Avoid leaking which field was wrong.
- Keep `JWT_SECRET` strong and rotate if compromised.
- Limit fields returned if collections grow large (projection).

## Deployment notes (Cloudflare Pages)
- Build command: `npm run build` (Vite) → output `build/` handled by project config.
- Functions in `/functions` auto‑deployed.
- Configure env vars in Pages dashboard; redeploy to apply changes.
 - Ensure Vite aliases and externals remain in `vite.config.ts` to keep server‑only libs out of the client bundle.

---

Treat this prompt as the source of truth while working in this repository. When in doubt, prefer simplicity, edge‑compatibility, and low running cost.
