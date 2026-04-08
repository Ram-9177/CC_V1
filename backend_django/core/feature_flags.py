"""Feature Flag evaluation utility — Phase 11 SAAS Layer."""
from django.core.cache import cache
from apps.operations.models import SystemConfig

def feature_enabled(key: str, college=None) -> bool:
    """
    SAAS-Scale Feature Flag evaluation.
    Evaluates cleanly, with aggressive redis-backed caching.
    """
    # College-level overrides exist in future scope; currently global checks.
    cache_key = f"feature_flag_{key}_{college.id if college else 'global'}"
    cached_value = cache.get(cache_key)
    
    if cached_value is not None:
        return cached_value

    try:
        config = SystemConfig.objects.filter(key=key).first()
        is_enabled = bool(config.value) if config else False
    except Exception:
        is_enabled = False
        
    cache.set(cache_key, is_enabled, timeout=3600)  # Cache for 1 hour
    return is_enabled
