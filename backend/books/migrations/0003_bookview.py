import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('books', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='BookView',
            fields=[
                ('id', models.UUIDField(default=__import__('uuid').uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('visitor_id', models.CharField(db_index=True, max_length=64)),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='unique_views', to='books.book')),
            ],
            options={'abstract': False},
        ),
        migrations.AddConstraint(
            model_name='bookview',
            constraint=models.UniqueConstraint(fields=('book', 'visitor_id'), name='unique_book_visitor_view'),
        ),
    ]
