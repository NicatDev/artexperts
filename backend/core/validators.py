from django.core.exceptions import ValidationError


MAX_PDF_SIZE_BYTES = 300 * 1024 * 1024


def validate_pdf_file(value):
    if not value or getattr(value, '_committed', False):
        return
    if value.size > MAX_PDF_SIZE_BYTES:
        raise ValidationError('PDF file must not exceed 300 MB.', code='pdf_too_large')
    position = value.tell()
    try:
        value.seek(0)
        if value.read(5) != b'%PDF-':
            raise ValidationError('Upload a valid PDF file.', code='invalid_pdf')
    finally:
        value.seek(position)
