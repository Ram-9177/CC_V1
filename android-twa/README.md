# Android TWA (Trusted Web Activity) - HostelConnect

This guide helps you wrap the PWA into an Android app for the Play Store using Bubblewrap (TWA).

## Prerequisites
- Production HTTPS origin for your PWA (e.g., https://app.yourdomain.com)
- Web App Manifest accessible at https://app.yourdomain.com/manifest.webmanifest
- Node.js + Java 17 + Android SDK/CLI installed locally
- Google Play Console account and signing configuration

## 1) Digital Asset Links (hosted)
Host this file at your production origin:

Path: `https://<your-domain>/.well-known/assetlinks.json`

We’ve added a placeholder in this repo at `public/.well-known/assetlinks.json` which will be deployed with the site.

Update these fields before deploy:
- `package_name`: e.g., `com.yourorg.hostelconnect`
- `sha256_cert_fingerprints`: your app signing SHA-256 fingerprint (from Play App Signing or your keystore)

## 2) Install Bubblewrap
```bash
npm i -g @bubblewrap/cli
```

## 3) Initialize project from your manifest
```bash
bubblewrap init --manifest=https://<your-domain>/manifest.webmanifest
```
Answer prompts:
- Package ID: e.g., com.yourorg.hostelconnect.twa
- Application name: HostelConnect
- Host: <your-domain>
- Signing key: you can create one or use Play App Signing later

## 4) Build the Android App Bundle
```bash
bubblewrap build
```
This produces an `.aab` in the generated Android project.

## 5) Test locally
- `bubblewrap run` to install and run on a connected device.
- Check that it opens full-screen and uses your PWA origin.

## 6) Upload to Play Console
- Create app listing, upload the `.aab`, fill content forms.
- Ensure the Digital Asset Links file is live and correct.

## Notes
- Keep your manifest/icons up-to-date; Bubblewrap pulls from the manifest.
- Maskable icons recommended (already added in `public/manifest.webmanifest`).
- If Lighthouse complains about PNG icons, add 192/512 PNGs and list them in the manifest too.
