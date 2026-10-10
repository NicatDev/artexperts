from django.urls import path
from users.api.views import (
    RequestVerificationCodeView,
    VerifyAndRegisterView,
    LoginView,
    LogoutView,
    CsrfTokenView,
    CurrentUserView,
    ArtistListView,
    ArtistDetailView,
    UserLookupView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    RegistrationValidationView,
)

urlpatterns = [
    # Auth endpoints
    path('auth/register/validate/', RegistrationValidationView.as_view(), name='register-validate'),
    path('auth/register/request-code/', RequestVerificationCodeView.as_view(), name='register-request-code'),
    path('auth/register/verify/', VerifyAndRegisterView.as_view(), name='register-verify'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/password-reset/request-code/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/csrf/', CsrfTokenView.as_view(), name='csrf-token'),
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),

    # Artist directory & profiles
    path('artists/', ArtistListView.as_view(), name='artist-list'),
    path('artists/<slug:username>/', ArtistDetailView.as_view(), name='artist-detail'),

    # Protected user search for book access
    path('users/lookup/', UserLookupView.as_view(), name='user-lookup'),
]
