# Generated for Module 13 Phase 4 - Provincial Configuration & Compliance History

import datetime
import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0066_remove_employeedocument_created_at_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='daycare',
            name='province',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='daycares', to='core.province'),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='effective_from',
            field=models.DateField(default=datetime.date.today),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='effective_to',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='is_system_rule',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='program',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ratio_rules', to='core.program'),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='program_type',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='province',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ratio_rules', to='core.province'),
        ),
        migrations.AddField(
            model_name='ratiorule',
            name='qualification_requirement',
            field=models.CharField(default='Certified ECE', max_length=255),
        ),
        migrations.CreateModel(
            name='RatioManualOverride',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('override_status', models.CharField(choices=[('COMPLIANT', 'Compliant'), ('WARNING', 'Warning'), ('NON_COMPLIANT', 'Non-Compliant'), ('EXEMPT', 'Exempt')], max_length=50)),
                ('reason', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('classroom', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ratio_overrides', to='core.classroom')),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='created_ratio_overrides', to=settings.AUTH_USER_MODEL)),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ratio_overrides', to='core.daycare')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='RatioComplianceHistory',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('evaluated_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('children_present', models.IntegerField(default=0)),
                ('qualified_staff_present', models.IntegerField(default=0)),
                ('total_staff_present', models.IntegerField(default=0)),
                ('required_staff', models.IntegerField(default=0)),
                ('calculated_ratio', models.CharField(default='0:0', max_length=50)),
                ('calculated_status', models.CharField(default='COMPLIANT', max_length=50)),
                ('rule_snapshot', models.JSONField(blank=True, default=dict)),
                ('override_applied', models.BooleanField(default=False)),
                ('override_status', models.CharField(blank=True, max_length=50, null=True)),
                ('override_reason', models.TextField(blank=True, null=True)),
                ('final_status', models.CharField(default='COMPLIANT', max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('classroom', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ratio_compliance_history', to='core.classroom')),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ratio_compliance_history', to='core.daycare')),
                ('override_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='applied_ratio_overrides', to=settings.AUTH_USER_MODEL)),
                ('rule_used', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='compliance_logs', to='core.ratiorule')),
            ],
            options={
                'ordering': ['-evaluated_at', '-created_at'],
                'indexes': [models.Index(fields=['daycare', 'classroom', 'evaluated_at'], name='core_ratioc_daycare_20e1c4_idx'), models.Index(fields=['daycare', 'final_status'], name='core_ratioc_daycare_67f04d_idx'), models.Index(fields=['evaluated_at'], name='core_ratioc_evaluat_88a7ca_idx')],
            },
        ),
    ]
