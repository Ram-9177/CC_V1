# CampusCore Infra Rebrand Patch Plan

## Objective
Rename infrastructure resource names from legacy hostelconnect-style identifiers to CampusCore-style identifiers with minimal downtime and a safe rollback path.

This plan is intentionally scoped to deployment/infrastructure naming only.

## In-Scope Renames
- Render backend service: hostelconnect-api -> campuscore-api
- Render frontend service: hostelconnect-web -> campuscore-web
- Render database: hostelconnect-db -> campuscore-db
- Fly app: hostelconnect-api -> campuscore-api
- Onrender host examples in docs/scripts:
  - hostelconnect-api.onrender.com -> campuscore-api.onrender.com
  - hostelconnect-web.onrender.com -> campuscore-web.onrender.com

## Out-of-Scope (Do Not Rename In This Change)
- Python/Django module package names such as hostelconnect.asgi, hostelconnect.settings, hostelconnect_auth
- DB table names and migration labels
- Internal service names in compiled artifacts and coverage outputs

Reason: package and schema renames are application refactors, not infrastructure renames.

## Patch Set 1: Config Files (Repo)

### 1) Root Render blueprint
File: render.yaml

Apply these replacements:
- name: hostelconnect-api -> name: campuscore-api
- fromDatabase.name: hostelconnect-db -> fromDatabase.name: campuscore-db
- ALLOWED_HOSTS value host: hostelconnect-api.onrender.com -> campuscore-api.onrender.com
- CORS_ALLOWED_ORIGINS host: https://hostelconnect-web.onrender.com -> https://campuscore-web.onrender.com
- CSRF_TRUSTED_ORIGINS host: https://hostelconnect-web.onrender.com -> https://campuscore-web.onrender.com
- name: hostelconnect-web -> name: campuscore-web
- fromService.name: hostelconnect-api -> fromService.name: campuscore-api
- databases.name: hostelconnect-db -> databases.name: campuscore-db

### 2) Backend Render blueprint
File: backend_django/render.yaml

Apply these replacements:
- name: hostelconnect-api -> name: campuscore-api
- fromDatabase.name: hostelconnect-db -> fromDatabase.name: campuscore-db
- databases.name: hostelconnect-db -> databases.name: campuscore-db

### 3) Fly app name
File: backend_django/fly.toml

Apply this replacement:
- app = "hostelconnect-api" -> app = "campuscore-api"

Note: Keep process command host package path unchanged (hostelconnect.asgi:application).

## Patch Set 2: Docs + Script Examples

### 4) Deployment guide
File: docs/DEPLOYMENT_FULL_GUIDE.md

Replace all infra references:
- hostelconnect-api -> campuscore-api
- hostelconnect-web -> campuscore-web
- hostelconnect-db -> campuscore-db
- hostelconnect-api.onrender.com -> campuscore-api.onrender.com
- hostelconnect-web.onrender.com -> campuscore-web.onrender.com

Also add one explicit note near first mention:
- Django package names (hostelconnect.*) remain unchanged intentionally.

### 5) Backend README examples
File: backend_django/README.md

Replace example URLs:
- https://hostelconnect-api.onrender.com -> https://campuscore-api.onrender.com

### 6) Benchmark script comments
File: backend/bench_ttfb.sh

Replace commented examples:
- hostelconnect-api.onrender.com -> campuscore-api.onrender.com

### 7) Environment sample comment
File: .env

Replace comment only:
- Upload this file to Render for hostelconnect-api -> campuscore-api

## Patch Set 3: Secret + CI Cutover (No Code Rename Needed)

These workflows are already secret-driven and usually do not need code edits:
- .github/workflows/backend-deploy.yml
- .github/workflows/tests.yml
- .github/workflows/performance.yml
- .github/workflows/keep_frontend_alive.yml

Update GitHub Secrets/Variables in deployment window:
- RENDER_BACKEND_URL: https://campuscore-api.onrender.com (or your custom backend domain)
- RENDER_FRONTEND_URL: https://campuscore-web.onrender.com (or your custom frontend domain)
- RENDER_DEPLOY_HOOK: deploy hook for campuscore-api service

Keep-alive note:
- .github/workflows/keep_alive.yml currently pings custom domains and may not need edits if those domains remain unchanged.

## Deployment Sequence (Low Risk)

1. Commit and merge Patch Set 1 + Patch Set 2.
2. In Render, create new services/resources with CampusCore names.
3. Copy env vars from old services to new services.
4. Set secrets (Patch Set 3) to new service URLs/hooks.
5. Deploy new backend and run migrations.
6. Deploy new frontend and verify API wiring.
7. Switch traffic/custom domains to new services.
8. Monitor for 24-72 hours before deleting old services.

## Verification Gates

### Gate A: Config integrity
- render.yaml parses and Blueprint preview resolves all fromService/fromDatabase links.
- backend_django/render.yaml parses and points to campuscore-db.

### Gate B: Backend health
- GET /api/health/ returns 200 on new backend URL.
- Auth login works.
- WebSocket handshake succeeds.

### Gate C: Frontend health
- Home/login pages load.
- API calls succeed with no CORS/CSRF errors.
- Key flows: rooms, gate passes, notices.

### Gate D: CI health
- backend-deploy workflow can trigger and verify health.
- tests workflow deploy stage health check passes.
- performance workflow reads new RENDER_BACKEND_URL and runs bench.

## Rollback Plan

If cutover fails:
1. Repoint custom domains back to old services.
2. Restore old GitHub secrets:
   - RENDER_BACKEND_URL -> old backend URL
   - RENDER_FRONTEND_URL -> old frontend URL
   - RENDER_DEPLOY_HOOK -> old deploy hook
3. Trigger old backend deploy hook and verify /api/health/ = 200.
4. Keep new services for investigation; do not delete immediately.

## Risk Register
- High: renaming hostelconnect Python package paths by mistake.
  - Mitigation: out-of-scope lock; do not search/replace hostelconnect.* globally.
- Medium: cross-service reference mismatch in render.yaml.
  - Mitigation: validate fromService/fromDatabase links in Render Blueprint preview.
- Medium: stale CI secrets still pointing at old URLs.
  - Mitigation: rotate all three secrets in one window and run workflows immediately.

## Quick Replacement Checklist
- [ ] render.yaml service/db names and hostname strings updated
- [ ] backend_django/render.yaml service/db names updated
- [ ] backend_django/fly.toml app name updated
- [ ] docs/DEPLOYMENT_FULL_GUIDE.md infra references updated
- [ ] backend_django/README.md URL examples updated
- [ ] backend/bench_ttfb.sh comments updated
- [ ] .env comment updated
- [ ] GitHub secrets switched to CampusCore endpoints
- [ ] New Render services validated before traffic cutover
- [ ] Rollback tested (dry-run)
