import re
from django.core.exceptions import ValidationError


def normalize_contact_phone(value):
    value = re.sub(r'[\s().-]', '', value.strip())
    if value and not re.fullmatch(r'\+[1-9]\d{6,14}', value):
        raise ValidationError('Enter a valid international phone number, e.g. +994501234567.')
    return value


def validate_contact(mode, phone, email):
    if mode == 'PHONE' and not phone:
        raise ValidationError({'contact_phone': 'A phone number is required for phone contact.'})
    if mode == 'EMAIL' and not email:
        raise ValidationError({'contact_email': 'An email address is required for email contact.'})
