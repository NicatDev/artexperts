import re
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from users.models import User, ArtistProfile, EmailVerificationToken


class ArtistProfileSerializer(serializers.ModelSerializer):
    remove_avatar = serializers.BooleanField(write_only=True, required=False)
    class Meta:
        model = ArtistProfile
        fields = [
            'id', 'full_name', 'username', 'avatar', 'avatar_thumbnail',
            'short_bio', 'artist_statement', 'website', 'social_links',
            'location', 'specialties', 'is_featured', 'is_founder', 'created_at', 'remove_avatar'
        ]
        read_only_fields = ['id', 'avatar_thumbnail', 'is_featured', 'is_founder', 'created_at']

    def validate_username(self, value):
        value = value.lower().strip()
        if not re.fullmatch(r'[a-z0-9_-]+', value):
            raise serializers.ValidationError('Use lowercase letters, numbers, hyphens and underscores.')
        existing = ArtistProfile.objects.filter(username=value)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_social_links(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('Social links must be an object.')
        for key, url in value.items():
            if not isinstance(key, str) or len(key) > 50:
                raise serializers.ValidationError('Invalid social network name.')
            serializers.URLField().run_validation(url)
        return value

    def update(self, instance, validated_data):
        from core.services.media import media_service
        remove_avatar = validated_data.pop('remove_avatar', False)
        avatar = validated_data.get('avatar')
        if remove_avatar and avatar:
            raise serializers.ValidationError({'avatar': 'Choose replacement or removal.'})
        if remove_avatar:
            validated_data['avatar'] = None
            validated_data['avatar_thumbnail'] = None
        elif avatar:
            try:
                media_service.validate_image(avatar)
                _, thumbnail = media_service.process_artwork_derivatives(avatar)
            except ValidationError as exc:
                raise serializers.ValidationError({'avatar': exc.messages})
            avatar.seek(0)
            validated_data['avatar_thumbnail'] = thumbnail
        return super().update(instance, validated_data)


class UserSerializer(serializers.ModelSerializer):
    artist_profile = ArtistProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'is_artist', 'is_verified', 'is_staff', 'artist_profile', 'created_at']
        read_only_fields = ['id', 'is_verified', 'is_staff', 'created_at']


class RequestVerificationCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        value = value.lower().strip()
        if User.all_objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value


class RegistrationDetailsSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=128, trim_whitespace=False)
    full_name = serializers.CharField(max_length=200, min_length=2)
    username = serializers.SlugField(max_length=100, min_length=3)

    def validate_email(self, value):
        value = value.lower().strip()
        if User.all_objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('This email is already registered.')
        return value

    def validate_username(self, value):
        value = value.lower().strip()
        if not re.match(r'^[a-z0-9_-]+$', value):
            raise serializers.ValidationError("Username can only contain lowercase letters, numbers, hyphens and underscores.")
        if ArtistProfile.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_password(self, value):
        # These attributes let Django's similarity validator check all signup details.
        user = User(email=str(self.initial_data.get('email', '')).strip().lower())
        user.username = str(self.initial_data.get('username', '')).strip().lower()
        name = str(self.initial_data.get('full_name', '')).strip()
        parts = name.split()
        user.first_name = parts[0] if parts else ''
        user.last_name = ' '.join(parts[1:])
        try:
            validate_password(value, user)
        except ValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class VerifyAndRegisterSerializer(RegistrationDetailsSerializer):
    code = serializers.RegexField(r'^\d{6}$')


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email', '').lower().strip()
        password = attrs.get('password')

        user = authenticate(username=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated.")
        if not user.is_verified:
            raise serializers.ValidationError("This account has not been verified.")

        attrs['user'] = user
        return attrs


class UserLookupSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetConfirmSerializer(PasswordResetRequestSerializer):
    code = serializers.RegexField(r'^\d{6}$')
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        user = User.objects.filter(email=attrs['email'], is_active=True).first()
        try:
            validate_password(attrs['new_password'], user)
        except ValidationError as exc:
            raise serializers.ValidationError({'new_password': list(exc.messages)})
        return attrs
