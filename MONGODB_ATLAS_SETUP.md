# MongoDB Atlas & Driver Setup (HostelConnect)

Data API was deprecated September 30, 2025. This guide uses the official MongoDB Node.js Driver inside Cloudflare Pages Functions.

---
## 1. Create Atlas Account & Project
1. Sign up (https://www.mongodb.com/cloud/atlas) or log in.
2. Create a new Project: name `HostelConnect` (any name acceptable).
3. Choose free M0 tier cluster; select a region close to majority of users (e.g., `aws-ap-south-1` for India). Cluster name defaults to `Cluster0`.

## 2. Network & Access Security
Atlas wizard asks for IP allow list & DB user (for driver):
1. IP Allow List: add `0.0.0.0/0` initially (broad) or restrict later.
2. DB User: Create one (e.g., `hostel_admin`) and note the password.

## 3. Obtain Connection String
When the modal shows Drivers / Compass / Shell etc., choose Drivers → Node.js and copy the `mongodb+srv://` connection string. Replace `<password>` with your DB user password.

## 4. (Skip Data API)
No action needed; we use the driver directly. Remove any old Data API keys if present.

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
Add these in Project → Settings → Environment Variables (Production & Preview):
| Name | Value Example |
|------|---------------|
| MONGODB_CONNECTION_STRING | mongodb+srv://user:pass@cluster.mongodb.net/ |
| MONGODB_DATABASE | hostel |
| ADMIN_EMAIL | admin@hostelconnect.local |
| ADMIN_PASSWORD | (choose strong pass) |
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
| Connection auth error | Bad credentials in `MONGODB_CONNECTION_STRING` | Recreate user; update env |
| DNS/timeout | Network or region issue | Verify cluster health/region |
| Insert duplicate error | Unique index triggered | Use new roll/email/number |

## 10. Future Enhancements
- Hash admin password (store bcrypt hash in env or move to a collection).
- Pagination (`limit` + `skip`) for list endpoints.
- Add `insertMany` for bulk import.
- Rate limiting via Cloudflare KV or Durable Objects.
- Backup strategy: scheduled monthly export using driver + GitHub Actions artifact.

## 11. Quick Reference
| Task | Location |
|------|----------|
| MongoDB driver helper | `functions/_utils/mongodb.ts` |
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
