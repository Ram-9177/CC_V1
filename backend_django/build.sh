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

# Establish Core Roles Automatically
python manage.py setup_core_roles

# Seed default admin accounts (idempotent)
python manage.py seed_admins

echo "Build complete!"
