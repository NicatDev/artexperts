from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def first_error(value):
    if isinstance(value, dict):
        return first_error(value.get('non_field_errors') or value.get('detail') or next(iter(value.values()), ''))
    if isinstance(value, (list, tuple)):
        return first_error(value[0]) if value else ''
    return str(value)


def custom_exception_handler(exc, context):
    """
    Standardizes all API exception responses across the platform:
    {
      "error": {
        "status_code": 400,
        "code": "validation_error",
        "message": "Human readable error description",
        "details": {...}
      }
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        customized_response = {
            'error': {
                'status_code': response.status_code,
                'code': getattr(exc, 'default_code', 'error'),
                'message': first_error(response.data) or 'Request failed.',
                'details': response.data
            }
        }
        response.data = customized_response

    return response
