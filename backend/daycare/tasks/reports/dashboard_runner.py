import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import Daycare
from django.test import RequestFactory
from daycare.views.dashboard import DaycareDashboardView

d = Daycare.objects.first()
print(f"Testing for daycare: {d.name}")
user = d.users.first()
if not user:
    print("No user found for daycare")
else:
    from rest_framework.test import force_authenticate
    request = RequestFactory().get('/daycare/dashboard/')
    force_authenticate(request, user=user)
    view = DaycareDashboardView.as_view()
    try:
        response = view(request)
        print("Status:", response.status_code)
        print("Data:", response.data)
    except Exception as e:
        print("Error:", e)
