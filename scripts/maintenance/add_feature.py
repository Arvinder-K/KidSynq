import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import SubscriptionFeature

feature, created = SubscriptionFeature.objects.get_or_create(
    code='branches',
    defaults={
        'name': 'Branch Management',
        'description': 'Manage multiple daycare branches/locations'
    }
)

if created:
    print("Created Branch Management feature!")
else:
    print("Feature already exists.")
