from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0064_remove_employeedocument_created_at_and_more'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='studentpickup',
            options={'ordering': ['name']},
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='daycare',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='pickups', to='core.daycare'),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='family',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pickups', to='core.family'),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='photo',
            field=models.FileField(blank=True, null=True, upload_to='pickup_photos/'),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='authorization_status',
            field=models.CharField(choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive'), ('EXPIRED', 'Expired'), ('REVOKED', 'Revoked'), ('PENDING_VERIFICATION', 'Pending Verification')], default='ACTIVE', max_length=50),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='valid_from',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='valid_until',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='notes',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='created_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_student_pickups', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='updated_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_student_pickups', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='approval_status',
            field=models.CharField(default='Approved', max_length=50),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='id_proof_status',
            field=models.CharField(default='Verified', max_length=50),
        ),
        migrations.AddField(
            model_name='studentpickup',
            name='pending_changes',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
