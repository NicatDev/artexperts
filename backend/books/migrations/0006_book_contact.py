from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('books', '0005_book_pdf_validator')]

    operations = [
        migrations.AddField(
            model_name='book', name='contact_mode',
            field=models.CharField(choices=[('NONE', 'Hide contact details'), ('PHONE', 'Phone and WhatsApp'), ('EMAIL', 'Email')], default='NONE', max_length=10),
        ),
        migrations.AddField(model_name='book', name='contact_phone', field=models.CharField(blank=True, default='', max_length=25)),
        migrations.AddField(model_name='book', name='contact_email', field=models.EmailField(blank=True, default='', max_length=254)),
    ]
