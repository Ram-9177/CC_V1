"""
Django settings for hostelconnect project.
"""

import os
from pathlib import Path
from datetime import timedelta
from decouple import config, Csv
import dj_database_url

# Initialize Sentry before other imports
try:
    from hostelconnect.sentry import sentry_before_send
except ImportError:
    pass

"""Base Django settings for CampusCore.

This module is used for all environments (dev, CI, production). Some
security-related settings such as HTTPS redirects are relaxed when running
tests so that API tests can talk to the local HTTP test server without
being redirected to HTTPS, which caused 301 responses and SSL errors in CI.
"""

import sys

# Detect when tests are running: if the pytest module is imported, we are in
# a test context (either via ``pytest`` or ``manage.py test`` importing
# pytest-powered tests).
IS_TESTING = "pytest" in sys.modules or (len(sys.argv) > 1 and sys.argv[1] == "test")

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
APPS_DIR = BASE_DIR / 'apps'

# Security
# Use an explicit non-Django-generated fallback to avoid accidental insecure defaults.
SECRET_KEY = config(
    'SECRET_KEY',
    default='local-dev-secret-key-change-before-production-please-rotate-1f7a9c3d6b8e2a4f'
)
DEBUG = config('DEBUG', default=False, cast=bool)
ENABLE_SETUP_ADMIN_ENDPOINT = config('ENABLE_SETUP_ADMIN_ENDPOINT', default=False, cast=bool)
SETUP_ADMIN_TOKEN = config('SETUP_ADMIN_TOKEN', default='').strip()
ALLOWED_HOSTS = ["hostel.samuraitechpark.in", "www.samuraitechpark.in", "api.samuraitechpark.in", "www.api.samuraitechpark.in", ".onrender.com", "localhost", "127.0.0.1", "0.0.0.0"]

# Always allow Render hostnames by default; specific external hostname can be
# added via RENDER_EXTERNAL_HOSTNAME.
if '.onrender.com' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('.onrender.com')

# Render/Free-tier deployments
RENDER = config('RENDER', default=False, cast=bool)
if RENDER:
    # Disable debug toolbar and extensions on free tier
    DEBUG = False

if not DEBUG and RENDER:
    # Add Render hostname for production deployments when provided.
    render_host = config('RENDER_EXTERNAL_HOSTNAME', default='').strip()
    if render_host and render_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(render_host)

FLY_APP_NAME = config('FLY_APP_NAME', default='').strip()
if FLY_APP_NAME:
    fly_host = f'{FLY_APP_NAME}.fly.dev'
    if fly_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(fly_host)

# ── Custom domain support ─────────────────────────────────────────────────────
# Primary production domain: samuraitechpark.in
# Always trusted so the subdomain works without extra env-var configuration.
_SAMURAI_HOSTS = ['samuraitechpark.in', '.samuraitechpark.in']
for _h in _SAMURAI_HOSTS:
    if _h not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_h)

# Additional custom domains can be added without a code deploy by setting:
#   CUSTOM_DOMAIN=my.domain.com,other.domain.com   in Render env vars
_custom_domains = [
    d.strip()
    for d in config('CUSTOM_DOMAIN', default='').split(',')
    if d.strip()
]
for _d in _custom_domains:
    if _d not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_d)

# Application definition
INSTALLED_APPS = [
    # Django
    'daphne',  # Must be first for async support
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'channels',
    'django_extensions',
    'django_filters',
    'drf_spectacular',
    'anymail',
    'cloudinary_storage',
    'cloudinary',
    
    # Local apps
    'core',
    'apps.auth',
    'apps.users',
    'apps.colleges',
    'apps.rooms',
    'apps.meals',
    'apps.attendance',
    'apps.gate_passes',
    'apps.gate_scans',
    'apps.events',
    'apps.sports',
    'apps.placements',
    'apps.alumni',
    'apps.operations',
    'apps.analytics',
    'apps.notices',
    'apps.notifications',
    'apps.messages',
    'apps.reports',
    'apps.metrics',
    'apps.health',
    'apps.web',
    'apps.complaints',
    'apps.visitors',
    'apps.disciplinary',
    'apps.hall_booking',
    'apps.leaves',
    'apps.audit',
    'apps.rbac',
    'apps.resume_builder',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'core.middleware.security.SecurityHeadersMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.gzip.GZipMiddleware',
    'django.middleware.http.ConditionalGetMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.TenantMiddleware', # Multi-tenant isolation
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.rbac.ModuleRBACMiddleware',
    'core.middleware.perf_logging.PerformanceLoggingMiddleware',
    'core.middleware.slow_query.SlowQueryLoggingMiddleware',
    'core.middleware.RequestLogMiddleware',
    'core.middleware.college_access.CollegeAccessMiddleware',
    'core.middleware.college_module.CollegeModuleMiddleware',
]

# Authentication
AUTH_USER_MODEL = 'hostelconnect_auth.User'

ROOT_URLCONF = 'hostelconnect.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
            'loaders': [
                ('django.template.loaders.cached.Loader', [
                    'django.template.loaders.filesystem.Loader',
                    'django.template.loaders.app_directories.Loader',
                ]),
            ] if not DEBUG else [
                'django.template.loaders.filesystem.Loader',
                'django.template.loaders.app_directories.Loader',
            ],
        },
    },
]

WSGI_APPLICATION = 'hostelconnect.wsgi.application'
ASGI_APPLICATION = 'hostelconnect.asgi.application'

# ...

# Database
DATABASE_URL = config('DATABASE_URL', default='')
USE_SQLITE = config('USE_SQLITE', default=False, cast=bool)
DB_CONN_MAX_AGE = config('DB_CONN_MAX_AGE', default=60, cast=int)
USE_PGBOUNCER = config('USE_PGBOUNCER', default=False, cast=bool)
DATABASE_SSL_REQUIRE = config(
    'DATABASE_SSL_REQUIRE',
    default=(not DEBUG and not IS_TESTING),
    cast=bool,
)

# Performance & Limits
DATA_UPLOAD_MAX_MEMORY_SIZE = 15728640  # 15 MB max request body (Prevents memory crash)
FILE_UPLOAD_MAX_MEMORY_SIZE = 15728640  # 15 MB

if USE_SQLITE:
    # SQLite — optimized for concurrent reads on single-core / low-end devices
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
            'CONN_MAX_AGE': 0,  # SQLite doesn't support persistent connections
            'OPTIONS': {
                'timeout': 20,  # Wait up to 20s if DB is locked (not 5s default)
            },
        }
    }
    # Enable WAL journal mode via Django's connection_created signal.
    # WAL allows concurrent reads while a write is in progress, preventing
    # "database is locked" crashes on low-end single-core devices.
    from django.db.backends.signals import connection_created
    def _set_sqlite_pragmas(sender, connection, **kwargs):
        if connection.vendor == 'sqlite':
            cursor = connection.cursor()
            cursor.execute('PRAGMA journal_mode=WAL;')
            cursor.execute('PRAGMA synchronous=NORMAL;')
            cursor.execute('PRAGMA cache_size=2000;')
            cursor.execute('PRAGMA temp_store=MEMORY;')
    connection_created.connect(_set_sqlite_pragmas)
elif DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=DB_CONN_MAX_AGE,
            ssl_require=DATABASE_SSL_REQUIRE,
        )
    }
    DATABASES['default']['ATOMIC_REQUESTS'] = False  # CRITICAL: Prevent connection holding on free-tier
    DATABASES['default']['AUTOCOMMIT'] = True
else:
    # PostgreSQL
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DB_NAME', default='hostelconnect'),
            'USER': config('DB_USERNAME', default='postgres'),
            'PASSWORD': config('DB_PASSWORD', default='password'),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='5432'),
            'CONN_MAX_AGE': 60,
            'OPTIONS': {
                'connect_timeout': 10,
                'keepalives': 1,
                'keepalives_idle': 30,
                # Hard cap on any single query to prevent runaway scans from
                # blocking the entire free-tier DB (max 3 connections).
                # Adjust via DB_STATEMENT_TIMEOUT_MS env var (default 5000 ms).
                'options': f"-c statement_timeout={config('DB_STATEMENT_TIMEOUT_MS', default=5000, cast=int)}",
            },
            'ATOMIC_REQUESTS': False,  # CRITICAL: Prevent connection holding on free-tier
            'AUTOCOMMIT': True,
        }
    }
    if DATABASE_SSL_REQUIRE:
        DATABASES['default']['OPTIONS']['sslmode'] = 'require'

# Connection pooling for free tier (if using pgBouncer on Render)
if RENDER and not USE_SQLITE:
    DATABASES['default']['CONN_MAX_AGE'] = DB_CONN_MAX_AGE
    DATABASES['default'].setdefault('OPTIONS', {})
    DATABASES['default']['OPTIONS'].update(
        {
            'connect_timeout': 5,
            'keepalives': 1,
            'keepalives_idle': 5,
            # 5-second statement timeout on free tier to prevent blocking
            'options': f"-c statement_timeout={config('DB_STATEMENT_TIMEOUT_MS', default=5000, cast=int)}",
        }
    )

if not USE_SQLITE:
    DATABASES['default']['CONN_HEALTH_CHECKS'] = True
    if USE_PGBOUNCER:
        # PgBouncer transaction pooling requires server-side cursors disabled.
        DATABASES['default']['DISABLE_SERVER_SIDE_CURSORS'] = True

    # Disable strict statement timeout during tests or migrations
    # otherwise testing schemas and CI runserver prep will crash if they take >5s.
    _is_management_cmd = len(sys.argv) > 1 and sys.argv[1] in [
        "migrate", "makemigrations", "test", "runserver", "shell", "check"
    ]
    if IS_TESTING or _is_management_cmd:
        if 'OPTIONS' in DATABASES['default'] and 'options' in DATABASES['default']['OPTIONS']:
            DATABASES['default']['OPTIONS'].pop('options', None)

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'

# Web Push VAPID keys
VAPID_PUBLIC_KEY = config('VAPID_PUBLIC_KEY', default='BDeljqv6rsFCaNrz7uUY-oB3OAvCc_6AMTBI9pMeJYMSISdUUcRjkwa9bBHJYXi9WVY3bTeSG-N2HMlv_OZSLSU')
VAPID_PRIVATE_KEY = config('VAPID_PRIVATE_KEY', default='xsjAqdBTg-4EYW2izIxvCV-RKBwMkwPyeWrij5UiT5o')
VAPID_ADMIN_EMAIL = config('VAPID_ADMIN_EMAIL', default='mailto:admin@smg-hostel.com')
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static'] if (BASE_DIR / 'static').exists() else []

USE_WHITENOISE = RENDER or config('USE_WHITENOISE', default=True, cast=bool)
WHITENOISE_USE_FINDERS = True

# Cloudinary configuration
CLOUDINARY_URL = config('CLOUDINARY_URL', default='')
if CLOUDINARY_URL:
    os.environ['CLOUDINARY_URL'] = CLOUDINARY_URL

# Django 4.2+: use STORAGES instead of deprecated STATICFILES_STORAGE.
STORAGES = {
    'default': {
        'BACKEND': 'cloudinary_storage.storage.MediaCloudinaryStorage' if CLOUDINARY_URL else 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': (
            'whitenoise.storage.CompressedManifestStaticFilesStorage'
            if USE_WHITENOISE
            else 'django.contrib.staticfiles.storage.StaticFilesStorage'
        ),
    },
}

# STATICFILES_STORAGE is intentionally NOT set here.
# Django 4.2+ uses the STORAGES dict above exclusively.
# Setting both raises ImproperlyConfigured.

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'core.authentication_backends.CookieJWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardCursorPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'core.errors.standardized_exception_handler',
    
    # ── RATE LIMITING / THROTTLING ───────────────────────────────────────────────
    # Prevent abuse and brute force. Highly critical for SAAS.
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'user': '150/minute',          # CX33 profile baseline rate limit
        'anon': '30/minute',           # Anonymous baseline
        'login': '5/minute',           # Brute-force protection
        'password_change': '10/minute', # Password security
        'bulk_operation': '15/minute',  # Batch creates/mark-all
        'export': '2/minute',           # Heavy CSV/PDF exports
        'role_change': '10/minute',     # Role/activation changes
        'notification_bulk': '10/minute', # Mark-all-as-read
        'complaint_create': '8/minute',
        'leave_create': '6/minute',
        'meal_attendance_mark': '12/minute',
        'attendance_mark': '10/minute',
        'attendance_mark_all': '4/minute',
        'attendance_sync_missing': '2/minute',
        'visitor_prereg_create': '8/minute',
        'resume_generate': '10/day',       # AI resume generation
        'dashboard_read': '60/minute',
        'activity_feed': '30/minute',
        'user_list': '40/minute',
        'tenant_list': '40/minute',
    },
}

# Middleware order is defined explicitly in MIDDLEWARE above.

# Slow query detection configuration
# Queries exceeding this threshold are logged to 'performance.slow_query'
# Optimized to 200ms for production (Hetzner CX33 performance profiling)
SLOW_QUERY_THRESHOLD_MS = config('SLOW_QUERY_THRESHOLD_MS', default=200, cast=int)
# Enabled in DEBUG by default; Forced to True on Render for production monitoring.
SLOW_QUERY_ENABLED = config('SLOW_QUERY_ENABLED', default=(DEBUG or RENDER), cast=bool)

# drf-spectacular configuration for Swagger/OpenAPI
SPECTACULAR_SETTINGS = {
    'TITLE': 'CampusCore API',
    'DESCRIPTION': 'Complete API documentation for CampusCore hostel management system',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SERVERS': [
        {'url': 'http://localhost:8000', 'description': 'Local Development'},
        {'url': config('API_BASE_URL', default='https://your-api.onrender.com'), 'description': 'Production'},
    ],
    'TAGS': [
        {'name': 'Auth', 'description': 'Authentication endpoints'},
        {'name': 'Users', 'description': 'User management'},
        {'name': 'Rooms', 'description': 'Room management'},
        {'name': 'Meals', 'description': 'Meal management'},
        {'name': 'Attendance', 'description': 'Attendance tracking'},
        {'name': 'Gate Passes', 'description': 'Gate pass management'},
        {'name': 'Notifications', 'description': 'Notification system'},
        {'name': 'Health', 'description': 'Health check endpoints'},
    ],
    'CONTACT': {
        'name': 'API Support',
        'email': 'api@hostelconnect.com',
    },
    'SCHEMA_PATH_PREFIX': '/api/v[0-9]',
    'DEFAULT_GENERATOR_CLASS': 'drf_spectacular.generators.SchemaGenerator',
    'ENUM_ADD_UNDERSCORE_SUFFIX': False,
    'ENABLE_BULK_OPERATIONS': True,
    'SORT_OPERATION_PARAMETERS': False,
}

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),  # Short-lived for security
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_CLAIM': 'user_id',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',
    
    # ADVANCED COOKIE AUTH (Institutional Requirement)
    'AUTH_COOKIE': 'access_token',      # Cookie name
    'AUTH_COOKIE_REFRESH': 'refresh_token', # Refresh cookie name
    'AUTH_COOKIE_DOMAIN': config('AUTH_COOKIE_DOMAIN', default=None),
    'AUTH_COOKIE_SECURE': not (DEBUG or IS_TESTING),    # HTTPS only in prod/stage, disabled for tests/local
    'AUTH_COOKIE_HTTP_ONLY': True,      # Prevent XSS
    'AUTH_COOKIE_PATH': '/',
    'AUTH_COOKIE_SAMESITE': 'Lax',
}

# ── Cross-Subdomain Authentication (Institutional/Production) ────────────────
# Use a leading dot so cookies are shared across www. and www.api.
AUTH_COOKIE_DOMAIN = config('AUTH_COOKIE_DOMAIN', default=None)
SESSION_COOKIE_DOMAIN = AUTH_COOKIE_DOMAIN
CSRF_COOKIE_DOMAIN = AUTH_COOKIE_DOMAIN

# Trust Render's Load Balancer / Proxy
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

# ── CACHING (REDIS) ───────────────────────────────────────────────────────────
# Use Redis for high-speed dashboard state, sessions, and rate limiting.
# django-redis allows for pattern-based deletion (used in cache invalidation).
REDIS_URL = config('REDIS_URL', default='redis://localhost:6379/1')

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# CORS Configuration
# ── Canonical origins (env-var overrides this default in production) ─────────────

# Default includes local dev origins AND the production custom domain,
# so a plain deploy with no env-var override still works correctly.
CORS_ALLOWED_ORIGINS = [
    "https://hostel.samuraitechpark.in",
    "https://www.samuraitechpark.in",
    "http://localhost:3000",
    "http://localhost:5173"
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False

CSRF_TRUSTED_ORIGINS = [
    origin.rstrip('/')
    for origin in config(
        'CSRF_TRUSTED_ORIGINS',
        default=','.join(CORS_ALLOWED_ORIGINS),
        cast=Csv(),
    )
    if origin
]

# Ensure CUSTOM_DOMAIN entries are always CSRF-trusted
for _d in _custom_domains:
    _co = f'https://{_d}'
    if _co not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(_co)

# ============================================================================
# CHANNELS CONFIGURATION - Optimized for Free Tier, Ready for Pro Upgrade
# ============================================================================
# Free Tier: 5000 capacity, 4 workers (~300 concurrent users)
# Pro Tier: 20000 capacity, 16+ workers (~1500+ concurrent users)
# NOTE: Channels uses Redis DB 0; Cache uses Redis DB 1 (separate keyspaces).

_REDIS_BASE = config('REDIS_URL', default='redis://localhost:6379')
# Ensure clean base URL without trailing DB (we append /0 and /1 ourselves)
_REDIS_BASE = _REDIS_BASE.rstrip('/').rstrip('/0').rstrip('/1').rstrip('/')

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            # DB 0 reserved for Channels (WebSocket groups)
            'hosts': [f'{_REDIS_BASE}/0'],
            'capacity': config('CHANNELS_CAPACITY', default=5000, cast=int),  # Free: 5000, Pro: 20000+
            'expiry': 10,           # message expiry in seconds
            'group_expiry': 86400,  # group membership expiry
        },
    },
}

# Fallback for in-memory if Redis unavailable
# Use in-memory channel layer ONLY if explicitly requested
if config('USE_IN_MEMORY_CHANNEL_LAYER', default=False, cast=bool):
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'
        }
    }


# =============================
# Redis Cache Configuration
# DB 1 reserved for Django Cache (separate from Channels DB 0)
# =============================
CACHE_VERSION = config('CACHE_VERSION', default=1, cast=int)
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        # DB 1: cache operations isolated from Channels WebSocket groups (DB 0)
        'LOCATION': f'{_REDIS_BASE}/1',
        'TIMEOUT': 300,   # 5-minute default TTL (forecast overrides to 300s too)
        'KEY_PREFIX': f'hc_v{CACHE_VERSION}',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'COMPRESSOR': 'django_redis.compressors.zlib.ZlibCompressor',
            'IGNORE_EXCEPTIONS': True,  # Cache miss is better than 500
            # Keep connection pool small on free tier
            'CONNECTION_POOL_KWARGS': {'max_connections': 20},
        }
    }
}

# Session backend - cache-backed session storage on Redis.
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'

# Logging Configuration
# ─────────────────────────────────────────────────────────────────────────────
# Loggers:
#   performance              – per-request timing (ms) from PerformanceLoggingMiddleware
#   performance.slow_query   – individual DB queries > SLOW_QUERY_THRESHOLD_MS
#   django.db.backends       – raw SQL (only when DEBUG=True; very verbose!)
# ─────────────────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'request_context': {
            '()': 'core.logging_filters.RequestContextFilter',
        },
    },
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} [college={college_id}] [user={user_id}] {process:d} {thread:d} {message}',
            'style': '{',
        },
        'slow_query': {
            # Compact format for slow-query lines – easier to grep in Render logs
            'format': '[SLOW_QUERY] {asctime} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'filters': ['request_context'],
        },
        'slow_query_console': {
            'class': 'logging.StreamHandler',
            'formatter': 'slow_query',
        },
    },
    'loggers': {
        # General request timing
        'performance': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        # Suppress 4xx log spam from Django (like 401 Unauthorized / 404 Not Found)
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        # Individual slow DB query warnings (>SLOW_QUERY_THRESHOLD_MS)
        'performance.slow_query': {
            'handlers': ['slow_query_console'],
            'level': 'WARNING',
            'propagate': False,
        },
        # Raw SQL logging – enable only in local debug sessions, never in prod!
        # Set LOG_DB_QUERIES=true in your local .env to activate.
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG' if config('LOG_DB_QUERIES', default=False, cast=bool) else 'WARNING',
            'propagate': False,
        },
    },
}
# Firebase Configuration
FIREBASE_CONFIG = {
    'type': config('FIREBASE_TYPE', default='service_account'),
    'project_id': config('FIREBASE_PROJECT_ID', default=''),
    'private_key_id': config('FIREBASE_PRIVATE_KEY_ID', default=''),
    'private_key': config('FIREBASE_PRIVATE_KEY', default=''),
    'client_email': config('FIREBASE_CLIENT_EMAIL', default=''),
    'client_id': config('FIREBASE_CLIENT_ID', default=''),
    'auth_uri': config('FIREBASE_AUTH_URI', default='https://accounts.google.com/o/oauth2/auth'),
    'token_uri': config('FIREBASE_TOKEN_URI', default='https://oauth2.googleapis.com/token'),
}

# Application Settings
# Debug toolbar is in requirements but disabled in production
# To enable in development, set DEBUG=True and uncomment the lines below
# if DEBUG:
#     INSTALLED_APPS.append('debug_toolbar')
#     MIDDLEWARE.append('debug_toolbar.middleware.DebugToolbarMiddleware')
#     INTERNAL_IPS = ['127.0.0.1']

# Security headers for production
# Institutional-Grade Security Headers (OWASP Optimized)
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

SECURE_CONTENT_SECURITY_POLICY = {
    'default-src': ("'self'",),
    'script-src': ("'self'", "https://static.cloudflareinsights.com"),
    'style-src': ("'self'", "'unsafe-inline'", "https://fonts.googleapis.com"),
    'img-src': ("'self'", "data:", "https://res.cloudinary.com"),
    'font-src': ("'self'", "https://fonts.gstatic.com"),
    'connect-src': ("'self'", "wss://hostel.samuraitechpark.in", "https://hostel.samuraitechpark.in"),
    'object-src': ("'none'",),
    'frame-ancestors': ("'none'",),
}

SECURE_SSL_REDIRECT = not (DEBUG or IS_TESTING)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

SESSION_COOKIE_SECURE = not (DEBUG or IS_TESTING)
CSRF_COOKIE_SECURE = not (DEBUG or IS_TESTING)
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'
SECURE_CROSS_ORIGIN_RESOURCE_POLICY = 'same-origin'

SECURE_HSTS_SECONDS = 0 if IS_TESTING else 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = not IS_TESTING
SECURE_HSTS_PRELOAD = not IS_TESTING

# Production Performance Settings
# Database connection reuse is handled in the DATABASES setting above.
# (Managed via DB_CONN_MAX_AGE env var).

if not DEBUG:
    # Cache template loaders (Step 6)
    TEMPLATES[0]['APP_DIRS'] = False
    TEMPLATES[0]['OPTIONS']['loaders'] = [
        ('django.template.loaders.cached.Loader', [
            'django.template.loaders.filesystem.Loader',
            'django.template.loaders.app_directories.Loader',
        ]),
    ]
    TEMPLATE_DEBUG = False



# Password Reset
PASSWORD_RESET_TIMEOUT = 900  # 15 minutes

# Email Configuration (env-overridable, with safe defaults for free tier)
ANYMAIL = {
    'SENDGRID_API_KEY': config('SENDGRID_API_KEY', default=''),
}

EMAIL_BACKEND = config(
    'EMAIL_BACKEND',
    default=(
        'django.core.mail.backends.console.EmailBackend'
        if DEBUG
        else 'django.core.mail.backends.smtp.EmailBackend'
    ),
)
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_TIMEOUT = config('EMAIL_TIMEOUT', default=5, cast=int)
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='webmaster@localhost')

# Frontend URL for password reset links, etc.
FRONTEND_URL = config('FRONTEND_URL', default=CORS_ALLOWED_ORIGINS[0] if CORS_ALLOWED_ORIGINS else 'http://localhost:5173')

# ── AI Resume Builder ─────────────────────────────────────────────────────────
# Set OPENAI_API_KEY in .env to enable AI generation.
# Leave blank to use the structured passthrough (no AI, no cost).
OPENAI_API_KEY = config('OPENAI_API_KEY', default='')
OPENAI_MODEL = config('OPENAI_MODEL', default='gpt-4o-mini')
OPENAI_BASE_URL = config('OPENAI_BASE_URL', default='https://api.openai.com/v1')

# ============================================================================
# CELERY CONFIGURATION — Hetzner CX33 optimized (4 vCPU, 8 GB RAM)
# ============================================================================
# Broker: Redis DB 2 (isolated from Channels DB 0 and Cache DB 1)
# Result backend: Redis DB 3
from celery.schedules import crontab  # noqa: E402

CELERY_BROKER_URL = f'{_REDIS_BASE}/2'
CELERY_RESULT_BACKEND = f'{_REDIS_BASE}/3'

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True

# Reliability settings
CELERY_TASK_ACKS_LATE = True           # Ack only after task completes (safe retries)
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # Prevent one worker hoarding tasks
CELERY_WORKER_MAX_TASKS_PER_CHILD = 200  # Recycle workers to prevent memory leaks
CELERY_TASK_DEFAULT_MAX_RETRIES = config('CELERY_TASK_DEFAULT_MAX_RETRIES', default=3, cast=int)
CELERY_TASK_RETRY_BACKOFF_MAX = config('CELERY_TASK_RETRY_BACKOFF_MAX', default=60, cast=int)

# Soft/hard time limits (seconds) — prevent runaway tasks on constrained host
CELERY_TASK_SOFT_TIME_LIMIT = 30
CELERY_TASK_TIME_LIMIT = 60

# Result expiry — keep results for 1 hour only
CELERY_RESULT_EXPIRES = 3600

# Queue split: lightweight notifications/default work vs heavy reporting/analytics jobs.
CELERY_TASK_DEFAULT_QUEUE = 'default'
CELERY_TASK_ROUTES = {
    'apps.notifications.tasks.*': {'queue': 'default'},
    'apps.reports.tasks.*': {'queue': 'heavy'},
    'apps.analytics.tasks.*': {'queue': 'heavy'},
}

# Beat schedule — periodic tasks
CELERY_BEAT_SCHEDULE = {
    # Expire stale gate passes every 15 minutes
    'auto-expire-gate-passes': {
        'task': 'apps.gate_passes.tasks.auto_expire_gate_passes',
        'schedule': crontab(minute='*/15'),
    },
    # Clean up old read notifications daily at 3 AM IST
    'cleanup-old-notifications': {
        'task': 'apps.notifications.tasks.cleanup_old_notifications',
        'schedule': crontab(hour=3, minute=0),
    },
    # ── Phase 0: SLA Automation ───────────────────────────────────────────────
    # Scan all open complaints every 5 minutes; flag newly breached ones
    'check-complaint-sla': {
        'task': 'apps.complaints.tasks.check_complaint_sla',
        'schedule': 300.0,   # every 5 minutes
    },
    # Escalate already-overdue complaints every 30 minutes to head_warden
    'escalate-overdue-complaints': {
        'task': 'apps.complaints.tasks.escalate_overdue_complaints',
        'schedule': crontab(minute='*/30'),
    },
}

# (crontab imported at top of CELERY block above)
