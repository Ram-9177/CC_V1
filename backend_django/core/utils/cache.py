"""Caching utilities for high-performance dashboards."""
import functools
import hashlib
import json
import logging
from django.core.cache import cache
from rest_framework.response import Response

logger = logging.getLogger(__name__)

def get_cache_key(user_id, prefix, params=None):
    """Generate a unique cache key for a user and optional params."""
    key_base = f"{prefix}:{user_id}"
    if params:
        param_str = json.dumps(params, sort_keys=True)
        param_hash = hashlib.md5(param_str.encode()).hexdigest()
        key_base = f"{key_base}:{param_hash}"
    return key_base

def cache_dashboard_response(timeout=60, prefix='dash'):
    """
    Decorator for cached ViewSet dashboard actions.
    Example:
        @action(detail=False)
        @cache_dashboard_response(timeout=300)
        def overview(self, request):
            ...
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(self, request, *args, **kwargs):
            # Only cache for GET requests
            if request.method != 'GET':
                return func(self, request, *args, **kwargs)
            
            user = request.user
            if not user.is_authenticated:
                return func(self, request, *args, **kwargs)
            
            # Context-aware key: user role + college + query params
            key = get_cache_key(
                user.id, 
                f"{prefix}:{getattr(user, 'role', 'anon')}:{getattr(user, 'college_id', 0)}", 
                request.query_params.dict()
            )
            
            # Check cache
            cached_data = cache.get(key)
            if cached_data is not None:
                # logger.debug(f"Cache hit: {key}")
                return Response(cached_data)
            
            # logger.debug(f"Cache miss: {key}")
            response = func(self, request, *args, **kwargs)
            
            # Only cache 2xx responses
            if 200 <= response.status_code < 300:
                cache.set(key, response.data, timeout)
            
            return response
        return wrapper
    return decorator

def invalidate_user_cache(user_id, prefix='dash'):
    """Manual invalidation helper when state changes."""
    # This is a broad invalidation (might need glob support in Redis)
    # Using django-redis, we can do cache.delete_pattern()
    try:
        cache.delete_pattern(f"*{prefix}:*:{user_id}*")
    except Exception as e:
        logger.error(f"Failed to invalidate cache for user {user_id}: {e}")
        # Fallback: conventional delete if pattern is not supported
        pass
