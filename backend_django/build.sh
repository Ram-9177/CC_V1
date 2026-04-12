#!/bin/bash
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --noinput

# Create necessary directories
mkdir -p staticfiles
mkdir -p media
mkdir -p logs

# Apply Migrations
python manage.py migrate

# Optional RBAC seed for fresh environments
if [ "${RUN_RBAC_SEED:-0}" = "1" ]; then
	python manage.py seed_rbac
fi

# Optional one-time bootstrap commands. These are intentionally opt-in so
# deployments do not recreate privileged accounts with predictable settings.
if [ "${RUN_CORE_ROLE_BOOTSTRAP:-0}" = "1" ]; then
	: "${CORE_ROLE_BOOTSTRAP_PASSWORD:?CORE_ROLE_BOOTSTRAP_PASSWORD must be set when RUN_CORE_ROLE_BOOTSTRAP=1}"
	if [ "${RUN_CORE_ROLE_INCLUDE_DEMO_STUDENT:-0}" = "1" ]; then
		python manage.py setup_core_roles --bootstrap-password "$CORE_ROLE_BOOTSTRAP_PASSWORD" --include-demo-student
	else
		python manage.py setup_core_roles --bootstrap-password "$CORE_ROLE_BOOTSTRAP_PASSWORD"
	fi
fi

if [ "${RUN_ADMIN_BOOTSTRAP:-0}" = "1" ]; then
	: "${SUPERADMIN_PASSWORD:?SUPERADMIN_PASSWORD must be set when RUN_ADMIN_BOOTSTRAP=1}"
	: "${ADMIN_PASSWORD:?ADMIN_PASSWORD must be set when RUN_ADMIN_BOOTSTRAP=1}"
	python manage.py seed_admins --superadmin-password "$SUPERADMIN_PASSWORD" --admin-password "$ADMIN_PASSWORD"
fi

echo "Build complete!"
