# Generated for Module 16 Phase 1 - Fee Structure & Billing Configuration

import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0071_daily_child_report_phase1'),
    ]

    operations = [
        migrations.CreateModel(
            name='FeeStructure',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, null=True)),
                ('fee_type', models.CharField(choices=[('REGISTRATION', 'Registration Fee'), ('MONTHLY', 'Monthly Childcare Fee'), ('WEEKLY', 'Weekly Childcare Fee'), ('DAILY', 'Daily Childcare Fee'), ('HOURLY', 'Hourly Childcare Fee'), ('DEPOSIT', 'Security / Enrollment Deposit'), ('OTHER', 'Other Activity or Supply Fee')], max_length=50)),
                ('frequency', models.CharField(choices=[('ONE_TIME', 'One-Time'), ('MONTHLY', 'Monthly'), ('WEEKLY', 'Weekly'), ('DAILY', 'Daily'), ('HOURLY', 'Hourly')], max_length=50)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('currency', models.CharField(default='CAD', max_length=10)),
                ('effective_from', models.DateField()),
                ('effective_until', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('applies_to', models.CharField(choices=[('ALL', 'All Children'), ('PROGRAM', 'Specific Program'), ('BRANCH', 'Specific Branch'), ('CLASSROOM', 'Specific Classroom'), ('INDIVIDUAL', 'Individual / Custom Assignment')], default='ALL', max_length=50)),
                ('version', models.IntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fee_structures', to='core.branch')),
                ('classroom', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fee_structures', to='core.classroom')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_fee_structures', to=settings.AUTH_USER_MODEL)),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fee_structures', to='core.daycare')),
                ('parent_fee', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='historical_versions', to='core.feestructure')),
                ('program', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fee_structures', to='core.program')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_fee_structures', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-is_active', 'name', '-effective_from'],
            },
        ),
        migrations.CreateModel(
            name='DepositRecord',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('amount_charged', models.DecimalField(decimal_places=2, max_digits=12)),
                ('amount_held', models.DecimalField(decimal_places=2, default=0.0, max_digits=12)),
                ('amount_applied', models.DecimalField(decimal_places=2, default=0.0, max_digits=12)),
                ('amount_refunded', models.DecimalField(decimal_places=2, default=0.0, max_digits=12)),
                ('amount_forfeited', models.DecimalField(decimal_places=2, default=0.0, max_digits=12)),
                ('currency', models.CharField(default='CAD', max_length=10)),
                ('status', models.CharField(choices=[('CHARGED', 'Deposit Charged'), ('HELD', 'Deposit Held in Trust'), ('PARTIALLY_APPLIED', 'Partially Applied'), ('FULLY_APPLIED', 'Fully Applied to Childcare'), ('PARTIALLY_REFUNDED', 'Partially Refunded'), ('REFUNDED', 'Fully Refunded'), ('FORFEITED', 'Forfeited')], default='CHARGED', max_length=50)),
                ('received_date', models.DateField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_deposits', to=settings.AUTH_USER_MODEL)),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deposit_records', to='core.daycare')),
                ('enrollment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deposit_records', to='core.classroomstudent')),
                ('family', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deposit_records', to='core.family')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deposit_records', to='core.student')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_deposits', to=settings.AUTH_USER_MODEL)),
                ('fee_structure', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='deposit_records', to='core.feestructure')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ChildFeeAssignment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('custom_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('discount_percentage', models.DecimalField(decimal_places=2, default=0.0, max_digits=5)),
                ('discount_reason', models.CharField(blank=True, max_length=255, null=True)),
                ('currency', models.CharField(default='CAD', max_length=10)),
                ('effective_from', models.DateField()),
                ('effective_until', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_fee_assignments', to=settings.AUTH_USER_MODEL)),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='child_fee_assignments', to='core.daycare')),
                ('enrollment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fee_assignments', to='core.classroomstudent')),
                ('family', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fee_assignments', to='core.family')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fee_assignments', to='core.student')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_fee_assignments', to=settings.AUTH_USER_MODEL)),
                ('fee_structure', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='assignments', to='core.feestructure')),
            ],
            options={
                'ordering': ['-is_active', '-effective_from', 'student__first_name'],
            },
        ),
        migrations.CreateModel(
            name='RegistrationFeeRecord',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('currency', models.CharField(default='CAD', max_length=10)),
                ('status', models.CharField(choices=[('PENDING', 'Pending Invoicing'), ('INVOICED', 'Invoiced'), ('PAID', 'Paid'), ('WAIVED', 'Waived')], default='PENDING', max_length=50)),
                ('waived_reason', models.TextField(blank=True, null=True)),
                ('waived_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_registration_fees', to=settings.AUTH_USER_MODEL)),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='registration_fee_records', to='core.daycare')),
                ('enrollment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='registration_fee_records', to='core.classroomstudent')),
                ('family', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='registration_fee_records', to='core.family')),
                ('fee_structure', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='registration_records', to='core.feestructure')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='registration_fee_records', to='core.student')),
                ('waived_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='waived_registration_fees', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='feestructure',
            index=models.Index(fields=['daycare', 'is_active'], name='core_feestr_daycare_9a3d5e_idx'),
        ),
        migrations.AddIndex(
            model_name='feestructure',
            index=models.Index(fields=['daycare', 'fee_type'], name='core_feestr_daycare_63eea6_idx'),
        ),
        migrations.AddIndex(
            model_name='feestructure',
            index=models.Index(fields=['effective_from', 'effective_until'], name='core_feestr_effecti_05f8a8_idx'),
        ),
        migrations.AddIndex(
            model_name='depositrecord',
            index=models.Index(fields=['daycare', 'student', 'status'], name='core_deposi_daycare_bced69_idx'),
        ),
        migrations.AddIndex(
            model_name='childfeeassignment',
            index=models.Index(fields=['daycare', 'student', 'is_active'], name='core_childf_daycare_1e0a86_idx'),
        ),
        migrations.AddIndex(
            model_name='childfeeassignment',
            index=models.Index(fields=['effective_from', 'effective_until'], name='core_childf_effecti_893210_idx'),
        ),
        migrations.AddIndex(
            model_name='registrationfeerecord',
            index=models.Index(fields=['daycare', 'student', 'status'], name='core_regist_daycare_3f27da_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='registrationfeerecord',
            unique_together={('daycare', 'student', 'fee_structure')},
        ),
    ]
