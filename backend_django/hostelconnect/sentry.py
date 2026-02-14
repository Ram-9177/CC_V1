"""
Error tracking integration with Sentry for production monitoring
"""

import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from decouple import config


def sentry_before_send(event, hint):
    """Filter sensitive data before sending to Sentry"""
    
    # Don't report 4xx errors
    if 'exc_info' in hint:
        exc_type, exc_value, tb = hint['exc_info']
        if hasattr(exc_value, 'status_code'):
            if 400 <= exc_value.status_code < 500:
                return None
    
    return event


# Initialize Sentry if DSN is configured
SENTRY_DSN = config('SENTRY_DSN', default='')

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(),
        ],
        # Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring
        traces_sample_rate=config('SENTRY_TRACES_SAMPLE_RATE', default=0.1, cast=float),
        
        # Set profiles_sample_rate to 1.0 to profile 100% of sampled transactions
        profiles_sample_rate=config('SENTRY_PROFILES_SAMPLE_RATE', default=0.1, cast=float),
        
        # If you wish to associate users to errors (requires `send_default_pii` to be `True`):
        send_default_pii=config('SENTRY_SEND_PII', default=False, cast=bool),
        
        # Capture breadcrumbs
        attach_stacktrace=True,
        
        # Filter 4xx errors to save Sentry quota
        before_send=sentry_before_send,
        
        # Environment
        environment=config('ENVIRONMENT', default='production'),
        
        # Release
        release=config('APP_VERSION', default='1.0.0'),
    )

