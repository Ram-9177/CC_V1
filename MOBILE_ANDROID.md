# Mobile Android Options: TWA vs Capacitor

You have two good paths to ship HostelConnect on Android:

## Option A: Trusted Web Activity (TWA) via Bubblewrap
- Fastest way to publish the PWA to the Play Store.
- Runs your web app in full-screen Chrome without a WebView wrapper.
- Shares origin storage/cookies with the PWA.

Steps:
1) Host the app on your production domain over HTTPS.
2) Update and deploy `/.well-known/assetlinks.json` with your final `package_name` and `sha256_cert_fingerprints`.
3) Install Bubblewrap: `npm i -g @bubblewrap/cli`.
4) Initialize from manifest: `bubblewrap init --manifest=https://<your-domain>/manifest.webmanifest`.
5) Build AAB: `bubblewrap build`.
6) Test (`bubblewrap run`) and upload to Play Console.

See `android-twa/README.md` for details.

## Option B: Capacitor Native Shell
- Useful when you need native plugins (camera, notifications, background tasks, biometrics, etc.).
- Embeds the built web app into a native Android project.

This repo includes initial config:
- `capacitor.config.ts` (appId `com.example.hostelconnect`, appName `HostelConnect`, webDir `build`)
- `package.json` scripts:
  - `npm run cap:add:android` → create Android project
  - `npm run cap:sync` → sync web assets and plugins
  - `npm run cap:open:android` → open Android Studio

Typical flow:
1) Install deps: `npm install` (will install Capacitor CLI/core).
2) Build web app: `npm run build` (outputs to `build/`).
3) Add Android: `npm run cap:add:android` (one-time).
4) Sync/copy: `npm run cap:sync`.
5) Open/Run: `npm run cap:open:android` (build/run in Android Studio).

Notes:
- For deep native features, add relevant Capacitor plugins and re-run `cap sync`.
- Configure app ID and signing in Android Studio/Gradle before Play upload.

## Which to choose?
- Need native APIs? Choose Capacitor.
- Web-first, fast publish, origin-sharing with your PWA? Choose TWA.

You can ship both: TWA for quick rollout, Capacitor for a future native-first build.
