from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from core.content_access import AvailabilityMode, ContactMode, public_contact
from core.validators import normalize_phone_number


class ContactDetailMixin(serializers.Serializer):
    contact = serializers.SerializerMethodField()
    contact_phone = serializers.SerializerMethodField()
    contact_email = serializers.SerializerMethodField()

    def get_contact(self, obj):
        return public_contact(obj)

    def _can_edit(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and (request.user == obj.owner or request.user.is_staff))

    def get_contact_phone(self, obj):
        return obj.contact_phone if self._can_edit(obj) else ''

    def get_contact_email(self, obj):
        return obj.contact_email if self._can_edit(obj) else ''


class ContactWriteMixin(serializers.Serializer):
    def validate_contact_phone(self, value):
        try:
            return normalize_phone_number(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        mode = attrs.get('availability_mode', getattr(self.instance, 'availability_mode', AvailabilityMode.PRIVATE_ACCESS))
        contact_mode = attrs.get('contact_mode', getattr(self.instance, 'contact_mode', ContactMode.NONE))
        if mode != AvailabilityMode.CONTACT:
            contact_mode = ContactMode.NONE
        attrs['contact_mode'] = contact_mode
        if contact_mode != ContactMode.PHONE:
            attrs['contact_phone'] = ''
        elif not attrs.get('contact_phone', getattr(self.instance, 'contact_phone', '')):
            raise serializers.ValidationError({'contact_phone': 'Telefon nömrəsini daxil edin.'})
        if contact_mode != ContactMode.EMAIL:
            attrs['contact_email'] = ''
        elif not attrs.get('contact_email', getattr(self.instance, 'contact_email', '')):
            raise serializers.ValidationError({'contact_email': 'Email ünvanını daxil edin.'})
        return attrs
