import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.test import Client
from core.models import User

daycare_admin = User.objects.filter(daycare__isnull=False).first()
if daycare_admin:
    print(f"Testing with Daycare Admin: {daycare_admin.email}")
    client = Client()
    client.force_login(daycare_admin)
    
    payload = {
        "timezone": "America/Chicago",
        "currency": "USD",
        "date_format": "MM/DD/YYYY",
        "time_format": "24h",
        "default_language": "en",
        "week_start_day": "Monday",
        "default_operating_start": None,
        "default_operating_end": None,
        "allow_parent_notifications": True,
        "allow_staff_notifications": True
    }
    
    response = client.patch('/api/daycare/settings/', payload, content_type='application/json', HTTP_HOST='127.0.0.1:8000')
    print("Status:", response.status_code)
    print("Response:", response.content)
else:
    print("No Daycare Admin found.")
