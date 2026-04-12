#!/bin/bash
# Script to generate all Django migrations

cd /Users/ram/Desktop/SMG-Hostel/backend_django

echo "Generating migrations for all apps..."

# Run makemigrations
python manage.py makemigrations

# Show migration files created
echo ""
echo "✓ Migrations generated successfully!"
echo ""
echo "To apply migrations, run:"
echo "python manage.py migrate"
