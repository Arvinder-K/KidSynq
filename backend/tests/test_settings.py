import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import DaycareSettings, Daycare
from core.serializers import DaycareSettingsSerializer

# Get any daycare settings
settings = DaycareSettings.objects.first()
if not settings:
    daycare = Daycare.objects.first()
    if daycare:
        settings = DaycareSettings.objects.create(daycare=daycare)

if settings:
    data = {
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
    serializer = DaycareSettingsSerializer(settings, data=data, partial=True)
    if serializer.is_valid():
        print("Valid!")
    else:
        print("Errors:", serializer.errors)
else:
    print("No daycare found to test.")
