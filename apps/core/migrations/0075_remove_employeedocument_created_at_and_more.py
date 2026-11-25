import datetime
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0074_invoice_recurring_billing_phase3'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='terms',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='recurringbillingprofile',
            name='profile_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='invoiceitem',
            name='rate_snapshot',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name='recurringbillingprofile',
            name='start_date',
            field=models.DateField(blank=True, default=datetime.date.today, null=True),
        ),
    ]

