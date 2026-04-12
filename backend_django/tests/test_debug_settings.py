from django.conf import settings
from django.urls import reverse
import sys

def test_print_settings():
    print(f"\nDEBUG: {settings.DEBUG}")
    print(f"IS_TESTING: {getattr(settings, 'IS_TESTING', 'N/A')}")
    print(f"SECURE_SSL_REDIRECT: {settings.SECURE_SSL_REDIRECT}")
    print(f"APPEND_SLASH: {settings.APPEND_SLASH}")
    
    url = reverse('login')
    print(f"Reverse login URL: {url}")
