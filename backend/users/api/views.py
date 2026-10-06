import secrets
from django.db import transaction, IntegrityError
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from rest_framework import views, generics, status, permissions
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from drf_spectacular.utils import extend_schema

from users.models import User, ArtistProfile, EmailVerificationToken
from users.services.email import email_service
from core.pagination import StandardResultsSetPagination
from users.api.serializers import (
    UserSerializer,
    ArtistProfileSerializer,
    RequestVerificationCodeSerializer,
    VerifyAndRegisterSerializer,
    LoginSerializer,
    UserLookupSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)


class RegisterThrottle(AnonRateThrottle):
    rate = '5/minute'


class LookupThrottle(UserRateThrottle):
    rate = '30/minute'


class RequestVerificationCodeView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterThrottle]

    @extend_schema(request=RequestVerificationCodeSerializer, responses={200: dict})
    def post(self, request):
        serializer = RequestVerificationCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        # Rate-limiting per email: check if a token was sent within the last 60 seconds
        recent_token = EmailVerificationToken.objects.filter(
            email=email,
            created_at__gte=timezone.now() - timedelta(seconds=60)
        ).first()
        if recent_token:
            return Response(
                {"error": {"message": "Please wait at least 60 seconds before requesting another code."}},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        # Generate 6-digit code
        code = f"{secrets.randbelow(1000000):06d}"
        expires_at = timezone.now() + timedelta(minutes=15)

        EmailVerificationToken.objects.create(
            email=email,
            code=code,
            token_type='REGISTER',
            expires_at=expires_at
        )

        email_sent = email_service.send_verification_code(email, code)
        if not email_sent:
            EmailVerificationToken.objects.filter(email=email, code=code, is_used=False).delete()
            return Response(
                {"error": {"message": "Verification email could not be delivered. Please try again later."}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        response_data = {
            "success": True,
            "message": "Verification code dispatched." if email_sent else "Email delivery is not configured; use the development code shown in the backend log.",
            "email": email,
            "expires_in_seconds": 900,
        }
        # Local development can verify registration without a configured email provider.
        if email_service.is_development_mode:
            response_data['development_code'] = code
        response = Response(response_data, status=status.HTTP_200_OK)
        response['Cache-Control'] = 'no-store'
        return response


@method_decorator(csrf_protect, name='dispatch')
class VerifyAndRegisterView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterThrottle]

    @extend_schema(request=VerifyAndRegisterSerializer, responses={201: UserSerializer})
    def post(self, request):
        serializer = VerifyAndRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        code = serializer.validated_data['code']
        password = serializer.validated_data['password']
        full_name = serializer.validated_data['full_name']
        username = serializer.validated_data['username']

        try:
            with transaction.atomic():
                token = EmailVerificationToken.objects.select_for_update().filter(
                    email=email, is_used=False, token_type='REGISTER',
                ).order_by('-created_at').first()
                if not token or not token.is_valid():
                    return Response({"error": {"message": "Invalid or expired verification code."}}, status=400)
                if not secrets.compare_digest(token.code, code):
                    token.attempts += 1
                    token.save(update_fields=['attempts'])
                    return Response({"error": {"message": "Incorrect verification code."}}, status=400)
                user = User.objects.create_user(email=email, password=password, is_artist=True, is_verified=True)
                ArtistProfile.objects.create(user=user, full_name=full_name, username=username)
                EmailVerificationToken.objects.filter(email=email, token_type='REGISTER', is_used=False).update(is_used=True)
        except IntegrityError:
            return Response({"error": {"message": "Email or username is already registered."}}, status=400)

        login(request, user)
        response = Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        response['Cache-Control'] = 'no-store'
        get_token(request)
        return response


@method_decorator(csrf_protect, name='dispatch')
class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterThrottle]

    @extend_schema(request=LoginSerializer, responses={200: UserSerializer})
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        login(request, user)
        response = Response(UserSerializer(user).data, status=status.HTTP_200_OK)
        response['Cache-Control'] = 'no-store'
        get_token(request)
        return response


class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: dict})
    def post(self, request):
        logout(request)
        response = Response({"success": True, "message": "Logged out successfully."}, status=status.HTTP_200_OK)
        response['Cache-Control'] = 'no-store'
        return response


class CsrfTokenView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        response = Response({"csrfToken": get_token(request)})
        response['Cache-Control'] = 'no-store'
        return response


class PasswordResetRequestView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterThrottle]

    @extend_schema(request=PasswordResetRequestSerializer, responses={200: dict})
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        result = {'success': True, 'message': 'Hesab mövcuddursa, şifrə bərpa kodu email ünvanınıza göndərildi.', 'expires_in_seconds': 900}
        if User.objects.filter(email=email, is_active=True, is_verified=True).exists():
            if EmailVerificationToken.objects.filter(email=email, token_type='PASSWORD_RESET', created_at__gte=timezone.now() - timedelta(seconds=60)).exists():
                return Response(result)
            code = f'{secrets.randbelow(1000000):06d}'
            token = EmailVerificationToken.objects.create(email=email, code=code, token_type='PASSWORD_RESET', expires_at=timezone.now() + timedelta(minutes=15))
            if not email_service.send_password_reset_code(email, code):
                token.delete()
                return Response({'error': {'message': 'Email göndərilə bilmədi. Bir qədər sonra yenidən cəhd edin.'}}, status=503)
            if email_service.is_development_mode:
                result['development_code'] = code
        response = Response(result)
        response['Cache-Control'] = 'no-store'
        return response


@method_decorator(csrf_protect, name='dispatch')
class PasswordResetConfirmView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterThrottle]

    @extend_schema(request=PasswordResetConfirmSerializer, responses={200: dict})
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            user = User.objects.select_for_update().filter(email=data['email'], is_active=True, is_verified=True).first()
            token = EmailVerificationToken.objects.select_for_update().filter(email=data['email'], token_type='PASSWORD_RESET', is_used=False).order_by('-created_at').first()
            if not user or not token or not token.is_valid():
                return Response({'error': {'message': 'Kod yanlışdır və ya vaxtı bitib.'}}, status=400)
            if not secrets.compare_digest(token.code, data['code']):
                token.attempts += 1
                token.save(update_fields=['attempts'])
                return Response({'error': {'message': 'Kod yanlışdır və ya vaxtı bitib.'}}, status=400)
            user.set_password(data['new_password'])
            user.save(update_fields=['password'])
            EmailVerificationToken.objects.filter(email=data['email'], token_type='PASSWORD_RESET', is_used=False).update(is_used=True)
        # Password changes invalidate existing Django sessions via their auth hash.
        logout(request)
        response = Response({'success': True, 'message': 'Şifrəniz yeniləndi. Yeni şifrə ilə daxil olun.'})
        response['Cache-Control'] = 'no-store'
        return response


class CurrentUserView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: UserSerializer})
    def get(self, request):
        response = Response(UserSerializer(request.user).data)
        response['Cache-Control'] = 'no-store'
        return response

    @extend_schema(request=ArtistProfileSerializer, responses={200: UserSerializer})
    def patch(self, request):
        profile = getattr(request.user, 'artist_profile', None)
        if not profile:
            return Response({"error": {"message": "Artist profile not found."}}, status=status.HTTP_404_NOT_FOUND)

        serializer = ArtistProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        response = Response(UserSerializer(request.user).data)
        response['Cache-Control'] = 'no-store'
        return response


class ArtistListView(generics.ListAPIView):
    """
    Public directory of artists with search and pagination.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = ArtistProfileSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = ArtistProfile.objects.filter(user__is_active=True, user__deleted_at__isnull=True)
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(full_name__icontains=search) | qs.filter(specialties__icontains=search) | qs.filter(location__icontains=search)
        return qs.order_by('-is_founder', '-is_featured', '-created_at')


class ArtistDetailView(generics.RetrieveAPIView):
    """
    Public profile of an individual artist.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = ArtistProfileSerializer
    lookup_field = 'username'

    def get_queryset(self):
        return ArtistProfile.objects.filter(user__is_active=True, user__deleted_at__isnull=True)


class UserLookupView(views.APIView):
    """
    Protected email existence check for granting book access.
    Rate-limited, does not expose full user lists.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [LookupThrottle]

    @extend_schema(responses={200: dict})
    def get(self, request):
        email = request.query_params.get('email', '').lower().strip()
        if not email:
            return Response({"error": {"message": "Email parameter is required."}}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email, is_active=True).first()
        if not user:
            return Response({"exists": False}, status=status.HTTP_200_OK)

        profile = getattr(user, 'artist_profile', None)
        return Response({
            "exists": True,
            "id": str(user.id),
            "email": user.email,
            "full_name": profile.full_name if profile else user.email.split('@')[0],
            "username": profile.username if profile else "",
            "avatar_thumbnail": profile.avatar_thumbnail.url if profile and profile.avatar_thumbnail else None
        }, status=status.HTTP_200_OK)
