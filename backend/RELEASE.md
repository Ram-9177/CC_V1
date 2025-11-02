# Release checklist

This document lists the minimal steps to prepare and release the backend service.

1. Build and run migrations

   - Ensure you have a Postgres instance available (Docker is recommended):

     export DB_HOST=<host>
     export DB_PORT=<port>
     export DB_USERNAME=<user>
     export DB_PASSWORD=<pass>
     export DB_NAME=<db>

   - Generate migrations locally if you changed entities:

     npm run migrate:generate -- <MigrationName>

   - Apply migrations:

     npm run migrate:run

2. Environment variables

   Required (production):
   - NODE_ENV=production
   - DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
   - JWT_SECRET

   Optional (notifications):
   - FIREBASE_SERVICE_ACCOUNT (base64-encoded JSON) OR FIREBASE_CRED_PATH (filesystem path)

3. FCM credentials

   - Store `FIREBASE_SERVICE_ACCOUNT` in GitHub Actions secrets or platform secrets manager. Avoid checking raw JSON into repo.

4. Deploy

   - Build Docker image:
     docker build -t hostel-backend:latest .
   - Push to registry and deploy to your environment.

5. Post-deploy

   - Run health checks and smoke tests against key endpoints (auth, create gate pass, join attendance session).
