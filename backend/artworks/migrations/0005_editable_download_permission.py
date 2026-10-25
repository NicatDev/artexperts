from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('artworks', '0004_artwork_availability_mode_artwork_contact_email_and_more')]
    # Existing allow_download values already reflect the previous download policy.
    operations = [migrations.AlterField(
        model_name='artwork', name='allow_download',
        field=models.BooleanField(default=False, verbose_name='Şəkli yükləməyə icazə', help_text='Yükləmə yalnız hamıya açıq paylaşımda aktiv olur. Digər hallarda orijinal fayl bağlı saxlanılır. Görünən şəkillərin surətinin çıxarılmasına qarşı tam zəmanət verilmir.'),
    ), migrations.AlterField(
        model_name='artwork', name='availability_mode',
        field=models.CharField(choices=[('FREE', 'Hamıya açıq paylaşım'), ('CONTACT', 'Yalnız müəlliflə əlaqə'), ('PRIVATE_ACCESS', 'Tam məhdud')], db_index=True, default='PRIVATE_ACCESS', max_length=25),
    )]
