from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('artworks', '0005_editable_download_permission')]

    operations = [
        migrations.AddField(
            model_name='artwork',
            name='gallery_order',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                verbose_name='Qalereyada sıra',
                help_text='Kiçik rəqəm öndə göstərilir. Sırasız əsərlər baxış sayına görə sonra gəlir.',
            ),
        ),
    ]
