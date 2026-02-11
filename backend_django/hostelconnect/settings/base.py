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

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
APPS_DIR = BASE_DIR / 'apps'

# Security
SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me-in-production')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())
if not DEBUG and RENDER:
    # Explicitly add your render URL here via env var for production
    pass

# Render/Free-tier deployments
RENDER = config('RENDER', default=False, cast=bool)
if RENDER:
    # Disable debug toolbar and extensions on free tier
    DEBUG = False

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
    'corsheaders',
    'channels',
    'django_extensions',
    
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
]

# ...
MIDDLEWARE = [
    'django.middleware.gzip.GZipMiddleware',  # 1. Compress responses
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Serve static files efficiently
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

# Performance & Limits
DATA_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5 MB max request body (Prevents memory crash)
FILE_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5 MB

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
            conn_max_age=0,  # Close connections immediately (Crucial for free tier limits)
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
            },
            'ATOMIC_REQUESTS': False,  # CRITICAL: Prevent connection holding on free-tier
            'AUTOCOMMIT': True,
        }
    }

# Connection pooling for free tier (if using pgBouncer on Render)
if RENDER and not USE_SQLITE:
    DATABASES['default']['CONN_MAX_AGE'] = 0  # Force close for free tier
    DATABASES['default'].setdefault('OPTIONS', {})
    DATABASES['default']['OPTIONS'].update(
        {
            'connect_timeout': 5,
            'keepalives': 1,
            'keepalives_idle': 5,
        }
    )

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static'] if (BASE_DIR / 'static').exists() else []

USE_WHITENOISE = RENDER or config('USE_WHITENOISE', default=True, cast=bool)
WHITENOISE_USE_FINDERS = True

# Django 4.2+: use STORAGES instead of deprecated STATICFILES_STORAGE.
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': (
            'whitenoise.storage.CompressedManifestStaticFilesStorage'
            if USE_WHITENOISE
            else 'django.contrib.staticfiles.storage.StaticFilesStorage'
        ),
    },
}

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
    }
}

# Add Request Performance Logging
MIDDLEWARE.insert(0, 'core.middleware.RequestLogMiddleware')

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=5),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
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
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', 
    default='http://localhost:5173,http://localhost:3000', cast=Csv())
CORS_ALLOW_CREDENTIALS = True

# Channels Configuration
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [config('REDIS_URL', default='redis://localhost:6379/0')],
            'capacity': 1500,
            'expiry': 10,
            'group_expiry': 86400,
            'connection_kwargs': {
                'socket_connect_timeout': 5,
                'socket_timeout': 5,
            },
        },
    },
}

# Fallback for in-memory if Redis unavailable
# Use in-memory channel layer by default in DEBUG unless explicitly overridden.
if config('USE_IN_MEMORY_CHANNEL_LAYER', default=DEBUG, cast=bool):
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'
        }
    }

# Cache Configuration - Supports both Upstash and local Redis
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': config('REDIS_URL', default='redis://localhost:6379/0'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'PARSER_KWARGS': {},
            'CONNECTION_POOL_KWARGS': {
                'socket_connect_timeout': 5,
                'socket_timeout': 5,
                'max_connections': 20,  # Reduced to 20 for free-tier limits
            },
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
        }
    }
}

# Session backend - use signed cookies for performance/free-tier (removes DB query per request)
SESSION_ENGINE = 'django.contrib.sessions.backends.signed_cookies'
SESSION_CACHE_ALIAS = 'default'

# Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
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
# Disable debug toolbar for now to avoid URL issues
if DEBUG and False:  # Temporarily disabled
    INSTALLED_APPS.append('debug_toolbar')
    MIDDLEWARE.append('debug_toolbar.middleware.DebugToolbarMiddleware')
    INTERNAL_IPS = ['127.0.0.1']

# Security headers for production
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_SECURITY_POLICY = {
    'default-src': ("'self'",),
}
X_FRAME_OPTIONS = 'DENY'
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_HTTPONLY = True

# Performance optimizations
if not DEBUG:
    # Cache template loaders - Must disable APP_DIRS when loaders is set
    TEMPLATES[0]['APP_DIRS'] = False
    TEMPLATES[0]['OPTIONS']['loaders'] = [
        ('django.template.loaders.cached.Loader', [
            'django.template.loaders.filesystem.Loader',
            'django.template.loaders.app_directories.Loader',
        ]),
    ]
    
    # Enable persistent connections - DISABLED for free tier to prevent "too many clients"
    CONN_MAX_AGE = 0
    
    # Optimize ORM queries
    TEMPLATE_DEBUG = False
