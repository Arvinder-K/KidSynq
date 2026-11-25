# Generated for Module 16 Phase 4 - Payment Processing, Receipts, Subsidies & Annual Tax Receipts

import datetime
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0076_remove_employeedocument_created_at_and_more'),
    ]

    operations = [
        # 1. Update Payment model
        migrations.AlterModelOptions(
            name='payment',
            options={'ordering': ['-payment_date', '-created_at']},
        ),
        migrations.AddField(
            model_name='payment',
            name='family',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payments', to='core.family'),
        ),
        migrations.AddField(
            model_name='payment',
            name='receipt_number',
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='payment',
            name='currency',
            field=models.CharField(default='CAD', max_length=10),
        ),
        migrations.AddField(
            model_name='payment',
            name='status',
            field=models.CharField(choices=[('COMPLETED', 'Completed / Cleared'), ('PENDING', 'Pending Verification'), ('FAILED', 'Failed / Declined'), ('REFUNDED', 'Fully Refunded'), ('PARTIALLY_REFUNDED', 'Partially Refunded'), ('BOUNCED', 'Bounced / NSF')], default='COMPLETED', max_length=50),
        ),
        migrations.AddField(
            model_name='payment',
            name='payer_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='payment',
            name='payer_email',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='payment',
            name='refunded_amount',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=12),
        ),
        migrations.AddField(
            model_name='payment',
            name='refund_reason',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='payment',
            name='refunded_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='payment',
            name='created_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='recorded_payments', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='payment',
            name='updated_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_payments', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='payment',
            name='payment_method',
            field=models.CharField(choices=[('CASH', 'Cash'), ('ETRANSFER', 'Interac e-Transfer'), ('CREDIT_CARD', 'Credit Card'), ('DEBIT_CARD', 'Debit / POS'), ('CHEQUE', 'Cheque'), ('BANK_TRANSFER', 'Direct Bank Transfer / ACH / EFT'), ('SUBSIDY_DIRECT', 'Direct Government Subsidy Remittance'), ('OTHER', 'Other / Manual')], default='ETRANSFER', max_length=100),
        ),
        migrations.AddIndex(
            model_name='payment',
            index=models.Index(fields=['daycare', 'payment_date'], name='core_paymen_daycare_ef45ab_idx'),
        ),
        migrations.AddIndex(
            model_name='payment',
            index=models.Index(fields=['invoice', 'status'], name='core_paymen_invoice_9a8712_idx'),
        ),
        migrations.AddIndex(
            model_name='payment',
            index=models.Index(fields=['receipt_number'], name='core_paymen_receipt_1234ab_idx'),
        ),
        migrations.AddIndex(
            model_name='payment',
            index=models.Index(fields=['family', 'payment_date'], name='core_paymen_family__3456cd_idx'),
        ),

        # 2. Create ChildSubsidyProfile
        migrations.CreateModel(
            name='ChildSubsidyProfile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('program_name', models.CharField(default='CWELCC Fee Reduction', max_length=255)),
                ('subsidy_type', models.CharField(choices=[('PERCENTAGE', 'Percentage Fee Reduction (e.g. CWELCC 52.75%)'), ('FIXED_MONTHLY', 'Fixed Monthly Subsidy Amount'), ('FIXED_DAILY', 'Fixed Daily Subsidy Amount'), ('CUSTOM_RATE', 'Custom / Flat Parent Portion Co-Pay')], default='PERCENTAGE', max_length=50)),
                ('subsidy_rate', models.DecimalField(decimal_places=2, default=52.75, max_digits=10)),
                ('currency', models.CharField(default='CAD', max_length=10)),
                ('government_case_number', models.CharField(blank=True, max_length=100, null=True)),
                ('parent_co_pay_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('approved_days_per_week', models.IntegerField(default=5)),
                ('effective_from', models.DateField(blank=True, default=datetime.date.today, null=True)),
                ('effective_until', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_subsidy_profiles', to=settings.AUTH_USER_MODEL)),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subsidy_profiles', to='core.daycare')),
                ('family', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='subsidy_profiles', to='core.family')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subsidy_profiles', to='core.student')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_subsidy_profiles', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-is_active', '-effective_from', 'student__first_name'],
            },
        ),
        migrations.AddIndex(
            model_name='childsubsidyprofile',
            index=models.Index(fields=['daycare', 'student', 'is_active'], name='core_childs_daycare_5f12ab_idx'),
        ),
        migrations.AddIndex(
            model_name='childsubsidyprofile',
            index=models.Index(fields=['effective_from', 'effective_until'], name='core_childs_effecti_7890cd_idx'),
        ),

        # 3. Create TaxReceipt
        migrations.CreateModel(
            name='TaxReceipt',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tax_year', models.IntegerField(default=2025)),
                ('receipt_number', models.CharField(max_length=100, unique=True)),
                ('recipient_name', models.CharField(max_length=255)),
                ('recipient_address', models.TextField(blank=True, null=True)),
                ('daycare_legal_name', models.CharField(max_length=255)),
                ('daycare_business_number', models.CharField(blank=True, max_length=100, null=True)),
                ('daycare_address', models.TextField(blank=True, null=True)),
                ('total_eligible_fees_paid', models.DecimalField(decimal_places=2, max_digits=12)),
                ('total_subsidies_deducted', models.DecimalField(decimal_places=2, default=0.0, max_digits=12)),
                ('net_claimable_amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('currency', models.CharField(default='CAD', max_length=10)),
                ('service_period_start', models.DateField()),
                ('service_period_end', models.DateField()),
                ('issued_date', models.DateField(default=datetime.date.today)),
                ('status', models.CharField(choices=[('DRAFT', 'Draft'), ('ISSUED', 'Issued / Official'), ('VOID', 'Voided')], default='ISSUED', max_length=50)),
                ('void_reason', models.TextField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_tax_receipts', to=settings.AUTH_USER_MODEL)),
                ('daycare', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tax_receipts', to='core.daycare')),
                ('family', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tax_receipts', to='core.family')),
                ('student', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tax_receipts', to='core.student')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_tax_receipts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-tax_year', '-issued_date', 'receipt_number'],
                'unique_together': {('daycare', 'family', 'tax_year', 'receipt_number')},
            },
        ),
        migrations.AddIndex(
            model_name='taxreceipt',
            index=models.Index(fields=['daycare', 'tax_year', 'status'], name='core_taxrec_daycare_3456ef_idx'),
        ),
        migrations.AddIndex(
            model_name='taxreceipt',
            index=models.Index(fields=['family', 'tax_year'], name='core_taxrec_family__7890ab_idx'),
        ),
        migrations.AddIndex(
            model_name='taxreceipt',
            index=models.Index(fields=['receipt_number'], name='core_taxrec_receipt_cdef12_idx'),
        ),
    ]
