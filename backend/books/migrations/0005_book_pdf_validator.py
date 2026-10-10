from django.db import migrations, models
from core.validators import validate_pdf_file


class Migration(migrations.Migration):
    dependencies = [('books', '0004_bookcategory')]

    operations = [
        migrations.AlterField(
            model_name='book',
            name='digital_file',
            field=models.FileField(blank=True, null=True, upload_to='private/books/files/', validators=[validate_pdf_file]),
        ),
    ]
