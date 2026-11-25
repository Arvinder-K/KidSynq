# Generated for Module 14 Phase 1 - Daily Child Reports

import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0070_remove_employeedocument_created_at_and_more'),
    ]

    operations = [
        # DailyReport fields
        migrations.AlterModelOptions(
            name='dailyreport',
            options={'ordering': ['-report_date', '-created_at']},
        ),
        migrations.AddField(
            model_name='dailyreport',
            name='branch',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='daily_reports', to='core.branch'),
        ),
        migrations.AddField(
            model_name='dailyreport',
            name='enrollment',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='daily_reports', to='core.classroomstudent'),
        ),
        migrations.AddField(
            model_name='dailyreport',
            name='updated_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_daily_reports', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='dailyreport',
            name='notes',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='dailyreport',
            name='published_at',
            field=models.DateTimeField(blank=True, null=True),
        ),

        # MealRecord fields
        migrations.AlterModelOptions(
            name='mealrecord',
            options={'ordering': ['time', 'recorded_at']},
        ),
        migrations.AddField(
            model_name='mealrecord',
            name='meal_category',
            field=models.CharField(default='Meal', max_length=50),
        ),
        migrations.AddField(
            model_name='mealrecord',
            name='time',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='mealrecord',
            name='notes',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='mealrecord',
            name='recorded_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='recorded_meals', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='mealrecord',
            name='food_provided',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='mealrecord',
            name='amount_eaten',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),

        # NapRecord fields
        migrations.AlterModelOptions(
            name='naprecord',
            options={'ordering': ['start_time', 'recorded_at']},
        ),
        migrations.AddField(
            model_name='naprecord',
            name='duration_minutes',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='naprecord',
            name='notes',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='naprecord',
            name='recorded_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='recorded_naps', to=settings.AUTH_USER_MODEL),
        ),

        # ToiletingRecord fields
        migrations.AlterModelOptions(
            name='toiletingrecord',
            options={'ordering': ['time', 'recorded_at']},
        ),
        migrations.AddField(
            model_name='toiletingrecord',
            name='assistance_level',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='toiletingrecord',
            name='time',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='toiletingrecord',
            name='notes',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='toiletingrecord',
            name='recorded_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='recorded_toileting', to=settings.AUTH_USER_MODEL),
        ),

        # ActivityRecord fields
        migrations.AlterModelOptions(
            name='activityrecord',
            options={'ordering': ['start_time', 'recorded_at']},
        ),
        migrations.AddField(
            model_name='activityrecord',
            name='activity_category',
            field=models.CharField(default='General Activity', max_length=100),
        ),
        migrations.AddField(
            model_name='activityrecord',
            name='name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='activityrecord',
            name='start_time',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='activityrecord',
            name='end_time',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='activityrecord',
            name='duration_minutes',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='activityrecord',
            name='learning_area',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='activityrecord',
            name='participation',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='activityrecord',
            name='recorded_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='recorded_activities', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='activityrecord',
            name='description',
            field=models.TextField(blank=True, null=True),
        ),

        # MoodRecord fields
        migrations.AlterModelOptions(
            name='moodrecord',
            options={'ordering': ['time', 'recorded_at']},
        ),
        migrations.AddField(
            model_name='moodrecord',
            name='time',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='moodrecord',
            name='notes',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='moodrecord',
            name='recorded_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='recorded_moods', to=settings.AUTH_USER_MODEL),
        ),

        # DailyTemperatureRecord Model
        migrations.CreateModel(
            name='DailyTemperatureRecord',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('temperature_value', models.DecimalField(decimal_places=2, max_digits=5)),
                ('unit', models.CharField(default='Celsius', max_length=20)),
                ('time', models.TimeField(blank=True, null=True)),
                ('method', models.CharField(default='Forehead', max_length=50)),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('daily_report', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='temperatures', to='core.dailyreport')),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='recorded_temperatures', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['time', 'created_at'],
            },
        ),

        # DailyNoteRecord Model
        migrations.CreateModel(
            name='DailyNoteRecord',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('time', models.TimeField(blank=True, null=True)),
                ('category', models.CharField(default='General', max_length=50)),
                ('note_text', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('daily_report', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='staff_notes', to='core.dailyreport')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_daily_notes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['time', 'created_at'],
            },
        ),

        # DailyPhotoRecord Model
        migrations.CreateModel(
            name='DailyPhotoRecord',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('file_path', models.FileField(blank=True, null=True, upload_to='daily_photos/')),
                ('photo_url', models.CharField(blank=True, max_length=2048, null=True)),
                ('caption', models.CharField(blank=True, max_length=255, null=True)),
                ('activity_context', models.CharField(blank=True, max_length=100, null=True)),
                ('file_size', models.BigIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('daily_report', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='photos', to='core.dailyreport')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_photos', to='core.student')),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_daily_photos', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
