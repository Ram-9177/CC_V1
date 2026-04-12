from django.conf import settings


class RobotsTagMiddleware:
    """
    Forces X-Robots-Tag: noindex, nofollow on all responses.
    This provides an authoritative instruction to search engines that the 
    application subdomain should not be indexed, complementing robots.txt.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        # Authoritative blackout for search engines
        response["X-Robots-Tag"] = "noindex, nofollow"
        return response


class SecurityHeadersMiddleware:
    """
    Institutional-grade security headers middleware.
    
    Applies:
    - Content-Security-Policy (from SECURE_CONTENT_SECURITY_POLICY setting)
    - Permissions-Policy (restricts device APIs)
    
    Django's SecurityMiddleware does NOT natively apply CSP or Permissions-Policy,
    so this middleware bridges the gap without requiring django-csp.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        # Pre-build the CSP header string at startup for zero per-request cost
        self._csp_header = self._build_csp()
        self._permissions_policy = (
            "camera=(), microphone=(), geolocation=(), "
            "payment=(), usb=(), magnetometer=(), gyroscope=()"
        )

    def _build_csp(self):
        """Convert the SECURE_CONTENT_SECURITY_POLICY dict to a header string."""
        csp_dict = getattr(settings, 'SECURE_CONTENT_SECURITY_POLICY', None)
        if not csp_dict:
            return None
        
        directives = []
        for directive, sources in csp_dict.items():
            if isinstance(sources, (list, tuple)):
                directives.append(f"{directive} {' '.join(sources)}")
            else:
                directives.append(f"{directive} {sources}")
        return "; ".join(directives)

    def __call__(self, request):
        response = self.get_response(request)

        # Content-Security-Policy
        if self._csp_header and 'Content-Security-Policy' not in response:
            response['Content-Security-Policy'] = self._csp_header

        # Permissions-Policy (restricts device APIs like camera, mic, geolocation)
        if 'Permissions-Policy' not in response:
            response['Permissions-Policy'] = self._permissions_policy

        return response
