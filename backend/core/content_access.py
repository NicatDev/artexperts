"""Shared download policy for books and gallery items."""
from django.core.exceptions import ValidationError
from django.db import models
from core.validators import normalize_phone_number


class AvailabilityMode(models.TextChoices):
    FREE = 'FREE', 'Hamıya açıq — endirmək olar'
    CONTACT = 'CONTACT', 'Yalnız müəlliflə əlaqə'
    PRIVATE_ACCESS = 'PRIVATE_ACCESS', 'Tam məhdud'


class ContactMode(models.TextChoices):
    NONE = 'NONE', 'Heç biri'
    PHONE = 'PHONE', 'Telefon və WhatsApp'
    EMAIL = 'EMAIL', 'Email'


def public_contact(obj):
    if obj.availability_mode != AvailabilityMode.CONTACT:
        return None
    if obj.contact_mode == ContactMode.PHONE and obj.contact_phone:
        return {'mode': 'PHONE', 'value': obj.contact_phone}
    if obj.contact_mode == ContactMode.EMAIL and obj.contact_email:
        return {'mode': 'EMAIL', 'value': obj.contact_email}
    return None


def clean_contact(obj):
    # Hidden channels are cleared so they cannot accidentally be published later.
    if obj.availability_mode != AvailabilityMode.CONTACT:
        obj.contact_mode = ContactMode.NONE
    if obj.contact_mode != ContactMode.PHONE:
        obj.contact_phone = ''
    if obj.contact_mode != ContactMode.EMAIL:
        obj.contact_email = ''
    if obj.contact_mode == ContactMode.PHONE:
        try:
            obj.contact_phone = normalize_phone_number(obj.contact_phone)
        except ValidationError as exc:
            raise ValidationError({'contact_phone': exc.messages})
        if not obj.contact_phone:
            raise ValidationError({'contact_phone': 'Telefon nömrəsini daxil edin.'})
    if obj.contact_mode == ContactMode.EMAIL and not obj.contact_email:
        raise ValidationError({'contact_email': 'Email ünvanını daxil edin.'})
