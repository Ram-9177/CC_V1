# GitHub Education / Pro Benefits Setup

Use GitHub Student Developer Pack (or Teacher) to reduce infra costs and enhance tooling.

## 1) Get verified
- Apply at: https://education.github.com/pack
- Use your institutional email and submit proof.
- Once approved, your account gains Student benefits (similar to Pro for many features).

## 2) What you get (highlights)
- GitHub Actions: increased minutes and storage for private repos.
- GitHub Codespaces: free monthly credits for cloud dev environments.
- GitHub Container Registry (GHCR): host Docker images in `ghcr.io/<org>/<repo>`.
- Cloud credits via partners (DigitalOcean, Azure for Students, etc.).
- Domains & SSL from partners (Namecheap, etc.).

## 3) Configure this repo to leverage benefits

### Actions & CI
- Already included:
  - `.github/workflows/backend-ci.yml` → backend build + unit/e2e tests on push/PR.
  - `.github/workflows/android-debug.yml` → builds a debug APK via Capacitor & Gradle.
  - `.github/workflows/release-pwa.yml` → builds/attaches PWA zip on tagged releases.
- Recommended:
  - Protect `main` with required checks (backend CI passing).
  - Add `CODEOWNERS` to enforce reviews.

### Container Registry (optional)
- Enable GHCR: https://github.com/settings/packages
- Login in Actions using the default `GITHUB_TOKEN` (repo permissions → packages: write).
- Add a workflow to build/push backend Docker images to GHCR (left to your chosen release flow).

### Cloud credits (DigitalOcean)
- Claim credits via Student Pack.
- Use provided `.do/app.yaml` to create a DO App with frontend+backend+database.
- Set secrets in DO App Platform (DATABASE_URL, JWT_SECRET).

### Domain
- Claim a student domain (Namecheap/Name.com offer). Point DNS to your host (Vercel/Netlify/DO). Ensure PWA manifest + asset links for TWA.

## 4) Team & Access
- Create a private org; add teammates as members.
- Use Branch Protection and least-privilege for deployment keys/secrets.
