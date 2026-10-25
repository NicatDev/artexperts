from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('books', '0007_alter_book_availability_mode_alter_book_contact_mode')]
    operations = [migrations.AddField(
        model_name='book', name='allow_online_reading',
        field=models.BooleanField(default=False, verbose_name='Saytda oxumağa icazə', help_text='Standart olaraq bağlıdır. Səhifələr qorunan oxuyucuda göstərilir. Kopyalama və yükləməni məhdudlaşdıran tədbirlər görülür, lakin tam qorunmaya zəmanət verilmir.'),
    )]
