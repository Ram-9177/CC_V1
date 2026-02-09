#!/bin/bash
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --noinput

# Create necessary directories
mkdir -p /var/tmp/hostelconnect/staticfiles

# Apply Migrations
python manage.py migrate

echo "Build complete!"
