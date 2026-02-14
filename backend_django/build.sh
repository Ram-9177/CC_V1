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

echo "Build complete!"
