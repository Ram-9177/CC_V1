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

"""Base Django settings for HostelConnect.

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
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

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
    'apps.leaves',
]

# ...
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Serve static files efficiently
    'django.middleware.gzip.GZipMiddleware',  # Compress responses
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'hostelconnect.urls'

# Authentication
AUTH_USER_MODEL = 'hostelconnect_auth.User'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
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
DB_CONN_MAX_AGE = config('DB_CONN_MAX_AGE', default=(0 if RENDER else 60), cast=int)
USE_PGBOUNCER = config('USE_PGBOUNCER', default=False, cast=bool)

# Performance & Limits
DATA_UPLOAD_MAX_MEMORY_SIZE = 15728640  # 15 MB max request body (Prevents memory crash)
FILE_UPLOAD_MAX_MEMORY_SIZE = 15728640  # 15 MB

if USE_SQLITE:
    # SQLite
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
elif DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=DB_CONN_MAX_AGE,
            ssl_require=RENDER,
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
            'CONN_MAX_AGE': 0,  # Close connections immediately (Crucial for free tier limits)
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

# Connection pooling for free tier (if using pgBouncer on Render)
if RENDER and not USE_SQLITE:
    # CONN_MAX_AGE=0 on Render free tier: Render Postgres hard-limits connections
    # to 3. Persistent connections would exhaust this with just 3 Daphne workers.
    # When upgrading to a paid plan, set DB_CONN_MAX_AGE=60 (or higher) via env.
    DATABASES['default']['CONN_MAX_AGE'] = DB_CONN_MAX_AGE  # 0 by default on RENDER
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
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
        'core.permissions.PasswordChangeRequired',
    ),
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
    'DEFAULT_THROTTLE_RATES': {
        'user': '120/minute',  # 2 requests per second (Allow dashboard bursts)
        'anon': '30/minute',   # 1 request every 2s per IP (Better for NAT)
        'login_scope': '5/minute',  # Strict for login attempts
        'export_scope': '2/minute',  # Heavy exports
        'bulk_scope': '15/minute', # Fast allocations
        'password_change': '10/minute', # Password change security
    },
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# ── Performance & Observability Middleware ──────────────────────────────────
# ORDER matters: slowest (outermost) wraps must be inserted at index 0 LAST.
# Execution order at runtime (top to bottom in MIDDLEWARE list):
#   PerformanceLoggingMiddleware → SlowQueryLoggingMiddleware → RequestLogMiddleware
#   → SecurityMiddleware → WhiteNoiseMiddleware → GZipMiddleware → ...
MIDDLEWARE.insert(0, 'core.middleware.RequestLogMiddleware')
MIDDLEWARE.insert(0, 'core.middleware.slow_query.SlowQueryLoggingMiddleware')
MIDDLEWARE.insert(0, 'core.middleware.perf_logging.PerformanceLoggingMiddleware')

# Slow query detection configuration
# Queries exceeding this threshold are logged to 'performance.slow_query'
SLOW_QUERY_THRESHOLD_MS = config('SLOW_QUERY_THRESHOLD_MS', default=300, cast=int)
# Enabled in DEBUG by default; can be forced on in prod via env var for auditing.
SLOW_QUERY_ENABLED = config('SLOW_QUERY_ENABLED', default=DEBUG, cast=bool)

# drf-spectacular configuration for Swagger/OpenAPI
SPECTACULAR_SETTINGS = {
    'TITLE': 'HostelConnect API',
    'DESCRIPTION': 'Complete API documentation for HostelConnect hostel management system',
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
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
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
    
    # COOKIE SETTINGS (Recommended for security)
    # Note: Frontend must be updated to use withCredentials: true
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_DOMAIN': None,
    'AUTH_COOKIE_SECURE': not DEBUG,
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_PATH': '/',
    'AUTH_COOKIE_SAMESITE': 'Lax',
}

# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    origin.rstrip('/')
    for origin in config(
        'CORS_ALLOWED_ORIGINS',
        default='http://localhost:5173,http://localhost:3000',
        cast=Csv(),
    )
    if origin
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

# ============================================================================
# CHANNELS CONFIGURATION - Optimized for Free Tier, Ready for Pro Upgrade
# ============================================================================
# Free Tier: 5000 capacity, 4 workers (~300 concurrent users)
# Pro Tier: 20000 capacity, 16+ workers (~1500+ concurrent users)

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [config('REDIS_URL', default='redis://localhost:6379/0')],
            'capacity': config('CHANNELS_CAPACITY', default=5000, cast=int),  # Free: 5000, Pro: 20000+
            'expiry': 10,
            'group_expiry': 86400,
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
# Redis Cache Configuration (OPTION B)
# =============================
CACHE_VERSION = 1
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
        'TIMEOUT': 300,  # 5 minutes
        'KEY_PREFIX': f"app_cache_v{CACHE_VERSION}",
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'COMPRESSOR': 'django_redis.compressors.zlib.ZlibCompressor',
            'IGNORE_EXCEPTIONS': True,
        }
    }
}

# Session backend - use signed cookies for performance/free-tier (removes DB query per request)
SESSION_ENGINE = 'django.contrib.sessions.backends.signed_cookies'
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
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
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
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_SECURITY_POLICY = {
    'default-src': ("'self'",),
}
X_FRAME_OPTIONS = 'DENY'

# In tests we disable HTTPS redirect so the Django test client and the
# pytest-django live server (which serve HTTP only) don't get redirected to
# https://testserver/..., which was causing 301 responses and SSL errors in CI.
SECURE_SSL_REDIRECT = not DEBUG and not IS_TESTING
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'
SECURE_CROSS_ORIGIN_RESOURCE_POLICY = 'same-origin'
SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=(31536000 if not DEBUG else 0), cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = config('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=not DEBUG, cast=bool)
SECURE_HSTS_PRELOAD = config('SECURE_HSTS_PRELOAD', default=not DEBUG, cast=bool)

# Performance optimizations
if not DEBUG:
    # Cache template loaders – Must disable APP_DIRS when loaders is set.
    # Cached.Loader wraps filesystem+app_dirs loaders and caches the result
    # in memory so template parsing only happens once per process lifecycle.
    # Impact: removes 2-5ms of template I/O overhead per request.
    TEMPLATES[0]['APP_DIRS'] = False
    TEMPLATES[0]['OPTIONS']['loaders'] = [
        ('django.template.loaders.cached.Loader', [
            'django.template.loaders.filesystem.Loader',
            'django.template.loaders.app_directories.Loader',
        ]),
    ]

    # CONN_MAX_AGE note:
    # Set to 0 (close-immediately) on Render free tier to respect the 3-connection
    # hard limit. Individual DB_CONN_MAX_AGE env var overrides this at startup.
    # Upgrading to Render Pro: set DB_CONN_MAX_AGE=60 for ~40ms TTFB improvement.
    CONN_MAX_AGE = 0

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
