from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings

class CookieJWTAuthentication(JWTAuthentication):
    """
    Authenticate against cookies as well as traditional headers.
    This satisfies institutional security requirements by moving tokens
    away from localStorage (susceptible to XSS) and into HttpOnly cookies.
    """
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            # Fallback to cookies if header is missing
            raw_token = request.COOKIES.get(settings.SIMPLE_JWT.get('AUTH_COOKIE'))
        else:
            raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
