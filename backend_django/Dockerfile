# Docker configuration for Django application
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_ROOT_USER_ACTION=ignore
ENV PIP_NO_CACHE_DIR=off
ENV PIP_DISABLE_PIP_VERSION_CHECK=on

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy project
COPY . .

# Create necessary directories
RUN mkdir -p /app/staticfiles /app/media /app/logs

# Collect static files
RUN python manage.py collectstatic --noinput

# Start server; optionally run migrations when RUN_MIGRATIONS=1 (default).
# Bind Daphne to environment port, defaulting safely to 8000.
CMD sh -c 'if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then python manage.py migrate; fi; daphne -b 0.0.0.0 -p ${PORT:-8000} hostelconnect.asgi:application'
