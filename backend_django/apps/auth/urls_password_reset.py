from django.urls import path
from .views_password_reset import (
    password_reset_request,
    password_reset_confirm,
    otp_request,
    otp_verify,
)

urlpatterns = [
    # Email-based password reset
    path('password-reset/', password_reset_request, name='password_reset_request'),
    path('password-reset-confirm/', password_reset_confirm, name='password_reset_confirm'),
    
    # OTP-based password reset (email)
    path('otp-request/', otp_request, name='otp_request'),
    path('otp-verify/', otp_verify, name='otp_verify'),
]
