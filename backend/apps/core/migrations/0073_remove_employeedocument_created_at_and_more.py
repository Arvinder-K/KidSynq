# Generated for Module 16 Phase 2 - Discounts, Sibling Discounts, Credits & Late Fees

import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0072_fee_structure_and_billing_phase1'),
    ]

    operations = [
        migrations.CreateModel(
            name='CreditTransaction',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('currency', models.CharField(default='CAD', max_length=10)),
                ('transaction_type', models.CharField(choices=[('CREDIT', 'Credit Grant / Deposit / Overpayment'), ('CREDIT_APPLIED', 'Credit Applied to Invoicing'), ('CREDIT_ADJUSTMENT', 'Administrative Balance Adjustment'), ('CREDIT_REVERSAL', 'Credit Reversal')], max_length=50)),
                ('reason', models.CharField(max_length=255)),
                ('reference', models.CharField(blank=True, max_length=100, null=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('REVERSED', 'Reversed'), ('VOID', 'Voided')], default='ACTIVE', max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_credit_transactions', to=settings.AUTH_USER_MODEL)),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='credit_transactions', to='core.daycare')),
                ('enrollment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='credit_transactions', to='core.classroomstudent')),
                ('family', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='credit_transactions', to='core.family')),
                ('reversed_transaction', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reversals', to='core.credittransaction')),
                ('student', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='credit_transactions', to='core.student')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='DiscountRule',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, null=True)),
                ('discount_type', models.CharField(choices=[('PERCENTAGE', 'Percentage Discount'), ('FIXED', 'Fixed Amount Discount')], default='PERCENTAGE', max_length=50)),
                ('value', models.DecimalField(decimal_places=2, max_digits=10)),
                ('currency', models.CharField(default='CAD', max_length=10)),
                ('applies_to', models.CharField(choices=[('ALL', 'Daycare Wide / All Children'), ('STUDENT', 'Specific Child / Student'), ('FAMILY', 'Specific Family'), ('ENROLLMENT', 'Specific Classroom Enrollment'), ('PROGRAM', 'Specific Program'), ('CLASSROOM', 'Specific Classroom'), ('BRANCH', 'Specific Branch'), ('FEE_TYPE', 'Specific Fee Type')], default='ALL', max_length=50)),
                ('target_fee_type', models.CharField(blank=True, choices=[('REGISTRATION', 'Registration Fee'), ('MONTHLY', 'Monthly Childcare Fee'), ('WEEKLY', 'Weekly Childcare Fee'), ('DAILY', 'Daily Childcare Fee'), ('HOURLY', 'Hourly Childcare Fee'), ('DEPOSIT', 'Security / Enrollment Deposit'), ('OTHER', 'Other Activity or Supply Fee')], max_length=50, null=True)),
                ('eligibility_criteria', models.JSONField(blank=True, default=dict)),
                ('priority', models.IntegerField(default=10)),
                ('effective_from', models.DateField()),
                ('effective_until', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('version', models.IntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='discount_rules', to='core.branch')),
                ('classroom', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='discount_rules', to='core.classroom')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_discount_rules', to=settings.AUTH_USER_MODEL)),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='discount_rules', to='core.daycare')),
                ('enrollment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='discount_rules', to='core.classroomstudent')),
                ('family', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='discount_rules', to='core.family')),
                ('parent_rule', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='historical_versions', to='core.discountrule')),
                ('program', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='discount_rules', to='core.program')),
                ('student', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='discount_rules', to='core.student')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_discount_rules', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-is_active', 'priority', 'name', '-effective_from'],
            },
        ),
        migrations.CreateModel(
            name='LateFeeRule',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, null=True)),
                ('fee_type', models.CharField(choices=[('FIXED', 'Fixed Amount Fee'), ('PERCENTAGE', 'Percentage of Overdue Balance')], default='FIXED', max_length=50)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('currency', models.CharField(default='CAD', max_length=10)),
                ('grace_period_days', models.IntegerField(default=5)),
                ('frequency', models.CharField(choices=[('ONE_TIME', 'One-Time Late Fee'), ('DAILY', 'Daily Recurring Late Fee'), ('WEEKLY', 'Weekly Recurring Late Fee'), ('MONTHLY', 'Monthly Recurring Late Fee')], default='ONE_TIME', max_length=50)),
                ('max_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('effective_from', models.DateField()),
                ('effective_until', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('version', models.IntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_late_fee_rules', to=settings.AUTH_USER_MODEL)),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='late_fee_rules', to='core.daycare')),
                ('parent_rule', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='historical_versions', to='core.latefeerule')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_late_fee_rules', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-is_active', 'name', '-effective_from'],
            },
        ),
        migrations.CreateModel(
            name='SiblingDiscountRule',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(default='Sibling Discount Policy', max_length=255)),
                ('description', models.TextField(blank=True, null=True)),
                ('discount_type', models.CharField(choices=[('PERCENTAGE', 'Percentage Discount'), ('FIXED', 'Fixed Amount Discount')], default='PERCENTAGE', max_length=50)),
                ('value', models.DecimalField(decimal_places=2, default=10.0, max_digits=10)),
                ('currency', models.CharField(default='CAD', max_length=10)),
                ('applies_to_target', models.CharField(choices=[('SECOND_CHILD', 'Second Child Only'), ('SUBSEQUENT_CHILDREN', 'Second and Subsequent Children (2nd, 3rd, 4th, etc.)'), ('ALL_SIBLINGS', 'All Enrolled Siblings in Family')], default='SUBSEQUENT_CHILDREN', max_length=50)),
                ('target_fee_selection', models.CharField(choices=[('LOWEST_FEE', 'Lowest Fee Child'), ('HIGHEST_FEE', 'Highest Fee Child'), ('EQUAL_APPLY', 'Apply Configured Discount to Eligible Siblings')], default='LOWEST_FEE', max_length=50)),
                ('ordering_criteria', models.CharField(choices=[('AGE_DESCENDING', 'Birth Date (Eldest is 1st child, Younger is 2nd+ child)'), ('FEE_DESCENDING', 'Fee Amount (Highest fee is 1st child, Lower is 2nd+ child)'), ('ENROLLMENT_DATE', 'Enrollment Date (First enrolled is 1st child)')], default='AGE_DESCENDING', max_length=50)),
                ('min_enrolled_siblings', models.IntegerField(default=2)),
                ('effective_from', models.DateField()),
                ('effective_until', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('version', models.IntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_sibling_discount_rules', to=settings.AUTH_USER_MODEL)),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sibling_discount_rules', to='core.daycare')),
                ('parent_rule', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='historical_versions', to='core.siblingdiscountrule')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_sibling_discount_rules', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-is_active', '-effective_from'],
            },
        ),
    ]
