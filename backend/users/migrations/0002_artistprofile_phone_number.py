from django.db import migrations, models
from core.validators import validate_phone_number


class Migration(migrations.Migration):
    dependencies = [('users', '0001_initial')]
    operations = [
        migrations.AddField(
            model_name='artistprofile', name='phone_number',
            field=models.CharField(blank=True, default='', max_length=25, validators=[validate_phone_number]),
        ),
    ]
