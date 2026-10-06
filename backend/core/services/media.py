import io
import os
import uuid
from PIL import Image, ImageOps
from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError

ALLOWED_IMAGE_MIMES = {
    b'\xff\xd8\xff': 'jpeg',
    b'\x89PNG\r\n\x1a\n': 'png',
    b'RIFF': 'webp',
}

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25MB
MAX_DIMENSION = 10000  # 10,000 px max dimension


class MediaProcessingService:
    @staticmethod
    def validate_image(uploaded_file):
        """
        Validates actual file type by inspecting magic header bytes, checks file size,
        and ensures image dimensions are within safe bounds.
        """
        if uploaded_file.size > MAX_FILE_SIZE_BYTES:
            raise ValidationError("File size exceeds maximum allowed limit of 25MB.")

        # Read first 16 bytes for magic bytes sniffing
        initial_pos = uploaded_file.tell()
        header = uploaded_file.read(16)
        uploaded_file.seek(initial_pos)

        is_valid_type = False
        for magic, fmt in ALLOWED_IMAGE_MIMES.items():
            if header.startswith(magic) or (magic == b'RIFF' and len(header) >= 12 and header[8:12] == b'WEBP'):
                is_valid_type = True
                break

        if not is_valid_type:
            raise ValidationError("Unsupported file format. Please upload JPEG, PNG, or WebP images.")

        try:
            with Image.open(uploaded_file) as img:
                img.verify()
            uploaded_file.seek(initial_pos)
        except Exception:
            raise ValidationError("Uploaded file is corrupted or not a valid image.")

        with Image.open(uploaded_file) as img:
            width, height = img.size
            if width > MAX_DIMENSION or height > MAX_DIMENSION:
                raise ValidationError(f"Image dimensions ({width}x{height}) exceed maximum allowed {MAX_DIMENSION}px.")

        uploaded_file.seek(initial_pos)
        return True

    @staticmethod
    def process_artwork_derivatives(uploaded_file, apply_watermark=False, watermark_text="Art Expert"):
        """
        Processes an uploaded image:
        1. Strips private EXIF GPS metadata.
        2. Produces an optimized detail image (max 2048px, WebP format).
        3. Produces a gallery thumbnail (max 600px, WebP format).
        Returns:
            detail_content_file, thumbnail_content_file
        """
        uploaded_file.seek(0)
        with Image.open(uploaded_file) as original_img:
            # Handle orientation from EXIF before stripping metadata
            img = ImageOps.exif_transpose(original_img)

            # Convert to RGB (in case of CMYK, RGBA, P palette)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Transparent or palette
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                rgb_img.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
                img = rgb_img
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # 1. Detail version (max 2048px)
            detail_img = img.copy()
            detail_img.thumbnail((2048, 2048), Image.Resampling.LANCZOS)

            detail_io = io.BytesIO()
            detail_img.save(detail_io, format='WEBP', quality=85, method=6)
            detail_file = ContentFile(detail_io.getvalue(), name=f"detail_{uuid.uuid4().hex}.webp")

            # 2. Thumbnail version (max 600px)
            thumb_img = img.copy()
            thumb_img.thumbnail((600, 600), Image.Resampling.LANCZOS)

            thumb_io = io.BytesIO()
            thumb_img.save(thumb_io, format='WEBP', quality=80, method=6)
            thumb_file = ContentFile(thumb_io.getvalue(), name=f"thumb_{uuid.uuid4().hex}.webp")

        return detail_file, thumb_file


media_service = MediaProcessingService()
