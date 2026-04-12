"""
Redis-based OTP storage (use this in production instead of in-memory)
This is more reliable and allows multiple server instances.

NOTE: Keys now follow the structured namespacing from core.cache_keys:
  hc:auth:otp:password_reset:<user_id>
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
    
    def _key(self, hall_ticket: str) -> str:
        """Return a namespaced key for the given hall ticket."""
        return f"hc:auth:otp:password_reset:{hall_ticket}"

    def store_otp(self, hall_ticket, otp, user_id, email, expires_in_minutes=10):
        """Store OTP in Redis"""
        key = self._key(hall_ticket)
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
        key = self._key(hall_ticket)
        data = self.redis_client.get(key)
        
        if data:
            return json.loads(data)
        return None
    
    def delete_otp(self, hall_ticket):
        """Delete used OTP"""
        key = self._key(hall_ticket)
        self.redis_client.delete(key)
    
    def exists(self, hall_ticket):
        """Check if OTP exists"""
        key = self._key(hall_ticket)
        return self.redis_client.exists(key)

