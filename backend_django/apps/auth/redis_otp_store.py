"""
Redis-based OTP storage (use this in production instead of in-memory)
This is more reliable and allows multiple server instances
"""

import redis
import json
from datetime import timedelta
from django.utils import timezone
from django.conf import settings

class RedisOTPStore:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
    
    def store_otp(self, hall_ticket, otp, user_id, email, expires_in_minutes=10):
        """Store OTP in Redis"""
        key = f"otp:{hall_ticket}"
        expiry = timezone.now() + timedelta(minutes=expires_in_minutes)
        
        data = {
            'otp': otp,
            'user_id': user_id,
            'email': email,
            'expires_at': expiry.isoformat()
        }
        
        # Store with TTL (automatic expiration)
        self.redis_client.setex(
            key,
            expires_in_minutes * 60,
            json.dumps(data)
        )
    
    def get_otp(self, hall_ticket):
        """Retrieve OTP from Redis"""
        key = f"otp:{hall_ticket}"
        data = self.redis_client.get(key)
        
        if data:
            return json.loads(data)
        return None
    
    def delete_otp(self, hall_ticket):
        """Delete used OTP"""
        key = f"otp:{hall_ticket}"
        self.redis_client.delete(key)
    
    def exists(self, hall_ticket):
        """Check if OTP exists"""
        key = f"otp:{hall_ticket}"
        return self.redis_client.exists(key)


# ============================================================================
# DJANGO SETTINGS.PY ADDITIONS FOR REDIS
# ============================================================================
#
# REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
# REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
# REDIS_DB = int(os.getenv('REDIS_DB', 0))
#
# Or use caching backend:
# CACHES = {
#     'default': {
#         'BACKEND': 'django_redis.cache.RedisCache',
#         'LOCATION': 'redis://127.0.0.1:6379/0',
#         'OPTIONS': {
#             'CLIENT_CLASS': 'django_redis.client.DefaultClient',
#         }
#     }
# }
