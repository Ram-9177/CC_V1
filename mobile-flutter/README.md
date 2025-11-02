# HostelConnect Flutter App (Android)

This is a starter Flutter app to achieve feature parity with the web app:
- JWT login (hallticket/password)
- Per-role profile screen (basic data from /users/:id)
- Extend with modules: Gate Passes, Attendance, Rooms, Meals

## Setup

Prereqs:
- Flutter SDK 3.x
- Android Studio or command-line Android tooling

Install dependencies:

```bash
flutter pub get
```

Run (provide API URL at build-time):

```bash
# Local dev example
flutter run --dart-define=API_URL=http://10.0.2.2:3000
```

Build APK:

```bash
flutter build apk --dart-define=API_URL=https://your.api
```

## Next steps
- Add routes for each module: Gate Pass list/detail, Approvals (warden), Scan (gateman), Meals board (chef)
- Create a shared ApiClient with token from SharedPreferences
- Implement role-based navigation
- Add offline caching where relevant
