"""PDF rasterization in a short-lived process, never in a web worker."""
import json
import math
import sys


def main():
    # Limit native parser memory/CPU on the Linux production container.
    if sys.platform == 'linux':
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CPU, (12, 12))
        resource.setrlimit(resource.RLIMIT_FSIZE, (16 * 1024 * 1024, 16 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    import pypdfium2 as pdfium
    from PIL import Image, ImageDraw, ImageFont

    mode, source = sys.argv[1:3]
    pdf = pdfium.PdfDocument(source)
    try:
        count = len(pdf)
        if not 1 <= count <= 5000:
            raise ValueError('Unsupported page count')
        if mode == 'info':
            print(json.dumps({'pages': count}))
            return
        number = int(sys.argv[3])
        if not 1 <= number <= count:
            raise ValueError('Invalid page')
        page = pdf[number - 1]
        try:
            width, height = page.get_size()
            if not all(math.isfinite(v) and v > 0 for v in (width, height)):
                raise ValueError('Invalid page dimensions')
            scale = min(2.5, 2000 / max(width, height), math.sqrt(3_500_000 / (width * height)))
            # Do not initialize PDF forms, JavaScript, attachments or text extraction.
            bitmap = page.render(scale=scale, draw_annots=False, may_draw_forms=False)
            try:
                image = bitmap.to_pil().convert('RGB')
            finally:
                bitmap.close()
        finally:
            page.close()
        overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        font = ImageFont.load_default(size=max(20, min(60, image.width // 22)))
        for y in (int(image.height * .30), int(image.height * .67)):
            draw.text((image.width // 2, y), 'ART EXPERTS', font=font, fill=(120, 90, 35, 24), anchor='mm')
        image = Image.alpha_composite(image.convert('RGBA'), overlay).convert('RGB')
        image.save(sys.argv[4], 'WEBP', quality=84, method=3)
    finally:
        pdf.close()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Do not expose native parser details or private paths to a visitor.
        sys.exit(1)
