# MongoDB Atlas & Data API Setup (HostelConnect)

This guide walks you from zero → working Cloudflare Pages Functions API backed by MongoDB Atlas (Data API). Follow in order. Skip driver connection dialogs; we’re using HTTP Data API only.

---
## 1. Create Atlas Account & Project
1. Sign up (https://www.mongodb.com/cloud/atlas) or log in.
2. Create a new Project: name `HostelConnect` (any name acceptable).
3. Choose free M0 tier cluster; select a region close to majority of users (e.g., `aws-ap-south-1` for India). Cluster name defaults to `Cluster0`.

## 2. Network & Access Security
Atlas wizard asks for IP allow list & DB user. For Data API only:
1. IP Allow List: add `0.0.0.0/0` initially (broad) or restrict to known build hosts later.
2. DB User: Create one (e.g., `hostel_admin`). Password is NOT used by Data API endpoints in our current design, but keep it stored in a password manager; you may need it if you ever switch to a driver.

## 3. Skip “Choose a connection method”
When the modal shows Drivers / Compass / Shell etc., close it. We won’t copy the `mongodb+srv://` string here.

## 4. Enable Data API
1. Left sidebar: Data Services (or Build & Deploy) → Data API.
2. Click Enable.
3. Select the Data Source: your cluster (e.g., `Cluster0`).
4. Create API Key → name `hostel-connect-key`.
5. Copy:
   - Base URL → becomes `MONGODB_DATA_API_URL`
   - API Key → becomes `MONGODB_API_KEY`

Do NOT share the API key publicly.

## 5. Create Database & Collections
1. Browse Collections → “Add My Own Data”.
2. Database name: `hostel`
3. Collection: `students`
4. Add another collection: `rooms`
5. Optional sample docs:
```json
// students
{ "name": "Test User", "roll": "S001", "email": "test@example.com", "room": null, "createdAt": "2025-01-01T00:00:00.000Z" }
// rooms
{ "number": "101", "capacity": 2, "occupants": [] }
```

## 6. Recommended Indexes
Open each collection → Indexes tab → Create Index:
| Collection | Fields | Type | Notes |
|------------|--------|------|-------|
| students | roll (asc) | Single | Unique: ON (enforces no duplicate roll) |
| students | email (asc) | Single | Unique: ON (optional if email used) |
| rooms | number (asc) | Single | Unique: ON |
| students | createdAt (desc) | Single | For sort/pagination |

If Atlas asks for an index name, use `roll_1`, `email_1`, `number_1`, `createdAt_-1`.

## 7. Cloudflare Pages Environment Variables
Add these in Project → Settings → Environment Variables (both Production & Preview):
| Name | Value Example |
|------|---------------|
| MONGODB_DATA_API_URL | https://data.mongodb-api.com/app/<app-id>/endpoint/data/v1 |
| MONGODB_API_KEY | (the long key you copied) |
| MONGODB_DATA_SOURCE | Cluster0 |
| MONGODB_DATABASE | hostel |
| ADMIN_EMAIL | admin@hostelconnect.local |
| ADMIN_PASSWORD | (choose strong pass; current placeholder) |
| JWT_SECRET | paste a 64+ char random string |

Generate a strong secret (macOS):
```bash
openssl rand -hex 48
```

## 8. Verifying the Setup (Manual cURL)
After a deploy, test endpoints (replace `<domain>` and `<token>`):
```bash
# 1. Login
curl -X POST https://<domain>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@hostelconnect.local","password":"YOUR_ADMIN_PASSWORD"}'

# Response: { "token": "..." }

# 2. List students
curl https://<domain>/api/students \
  -H "Authorization: Bearer <token>"

# 3. Create student
curl -X POST https://<domain>/api/students \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Alice","roll":"S002","email":"alice@example.com"}'

# 4. List rooms
curl https://<domain>/api/rooms \
  -H "Authorization: Bearer <token>"
```

## 9. Common Errors & Fixes
| Issue | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized everywhere | Missing/incorrect JWT_SECRET or token not passed | Confirm env var + pass `Authorization: Bearer <token>` |
| 500 Server not configured (login) | ADMIN_EMAIL/PASSWORD/JWT_SECRET not set | Add env vars & redeploy |
| Data API 401 | Bad `MONGODB_API_KEY` | Re-create key; update Cloudflare env |
| Data API 404 dataSource | Wrong `MONGODB_DATA_SOURCE` | Use exact cluster name (e.g., Cluster0) |
| Insert duplicate error | Unique index triggered | Use new roll/email/number |

## 10. Future Enhancements
- Hash admin password (store bcrypt hash in env or move to a collection).
- Pagination (`limit` + `skip`) for list endpoints.
- Add `insertMany` for bulk import (enable Data API action if plan supports).
- Rate limiting via Cloudflare KV or Durable Objects.
- Backup strategy: scheduled monthly export using `Data API` + GitHub Actions artifact.

## 11. Quick Reference
| Task | Location |
|------|----------|
| Data API wrapper | `functions/_utils/dataApi.ts` |
| JWT helper | `functions/_utils/jwt.ts` |
| Auth endpoint | `functions/api/auth/login.ts` |
| Students CRUD | `functions/api/students/*` |
| Rooms CRUD | `functions/api/rooms/*` |

## 12. Clean‑up / Maintenance Checklist
- Rotate `MONGODB_API_KEY` quarterly.
- Rotate `JWT_SECRET` when admin password changes.
- Review index performance (Atlas Performance Advisor) monthly.
- Remove any test docs from production.

---
You’re done. Proceed to deploy and run smoke tests.
