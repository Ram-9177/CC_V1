"""URLs for authentication."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.auth import views
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()
router.register(r'users', views.UserViewSet)

urlpatterns = [
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('setup-admin/', views.SetupAdminView.as_view(), name='setup_admin'),
    path('register/', views.RegisterView.as_view(), name='register'),
    path('token/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', views.CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', views.ProfileView.as_view(), name='profile'),
    path('password-reset/', views.RequestPasswordResetView.as_view(), name='password_reset'),
    path('password-reset-confirm/', views.PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('otp-request/', views.RequestOTPView.as_view(), name='otp_request'),
    path('otp-verify/', views.VerifyOTPAndResetView.as_view(), name='otp_verify'),
    path('', include(router.urls)),
]
