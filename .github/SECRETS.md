# GitHub Secrets Configuration

This repository uses the current workflows in `.github/workflows/` (not legacy Render-only files).

## Required Secrets (Current Pipelines)

1. `DEPLOY_HOOK_URL`
   - Used by `tests.yml` deploy job to trigger backend deployment on `main` pushes.
   - Example: DigitalOcean App Platform deploy hook URL.

2. `BACKEND_BASE_URL`
   - Used for post-deploy health checks in `tests.yml`.
   - Example: `https://api.yourdomain.com`.

3. `PERF_BASE_URL`
   - Used by `performance.yml` when no manual `base_url` is provided.
   - Should point to the environment you benchmark (staging/prod).

## Optional Secrets

- `CODECOV_TOKEN` (if your Codecov repo requires token-auth uploads).

## Where They Are Used

- `tests.yml`
  - `DEPLOY_HOOK_URL` and `BACKEND_BASE_URL`
- `performance.yml`
  - `PERF_BASE_URL` (fallback), then `BACKEND_BASE_URL` as backup

## Setup Steps

1. Repository → **Settings**
2. **Secrets and variables** → **Actions**
3. Add each secret above

## Notes

- Deploy job runs only for pushes to `main` after tests pass.
- If deploy secrets are missing, deployment is skipped (with warning).
- If `BACKEND_BASE_URL` is set, failed health checks now fail the deploy job.
