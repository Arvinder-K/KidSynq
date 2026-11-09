import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import DaycareSubscription

count = 0
for sub in DaycareSubscription.objects.all():
    if not sub.expiry_date or not sub.renewal_date or not sub.start_date:
        sub.save()
        count += 1
        print(f"Updated subscription {sub.id}: Start={sub.start_date}, Expiry={sub.expiry_date}, Renewal={sub.renewal_date}")

print(f"Finished updating {count} subscriptions.")
