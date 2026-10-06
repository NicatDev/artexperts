from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


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
                'message': str(exc),
                'details': response.data
            }
        }
        response.data = customized_response

    return response
