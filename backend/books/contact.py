from django.core.exceptions import ValidationError
from core.validators import normalize_phone_number as normalize_contact_phone


def validate_contact(mode, phone, email):
    if mode == 'PHONE' and not phone:
        raise ValidationError({'contact_phone': 'A phone number is required for phone contact.'})
    if mode == 'EMAIL' and not email:
        raise ValidationError({'contact_email': 'An email address is required for email contact.'})
