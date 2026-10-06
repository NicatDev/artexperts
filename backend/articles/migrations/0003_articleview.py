import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('articles', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ArticleView',
            fields=[
                ('id', models.UUIDField(default=__import__('uuid').uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('visitor_id', models.CharField(db_index=True, max_length=64)),
                ('article', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='unique_views', to='articles.article')),
            ],
            options={'abstract': False},
        ),
        migrations.AddConstraint(
            model_name='articleview',
            constraint=models.UniqueConstraint(fields=('article', 'visitor_id'), name='unique_article_visitor_view'),
        ),
    ]
