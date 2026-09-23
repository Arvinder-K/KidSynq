# Generated for Module 13 Phase 1 - RatioRule Fields

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0069_remove_employeedocument_created_at_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='ratiorule',
            name='minimum_children',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='maximum_children',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='required_staff',
            field=models.IntegerField(default=1),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='qualified_staff_required',
            field=models.IntegerField(default=1),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='created_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_ratio_rules', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='updated_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_ratio_rules', to=settings.AUTH_USER_MODEL),
        ),
    ]
