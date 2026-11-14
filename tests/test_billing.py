import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import Daycare
from django.test import RequestFactory
from daycare.views.billing import SubscriptionPlanListView

d = Daycare.objects.first()
print(f"Testing for daycare: {d.name}")
user = d.users.first()
if not user:
    print("No user found for daycare")
else:
    from rest_framework.test import force_authenticate
    request = RequestFactory().get('/billing/subscriptions/')
    force_authenticate(request, user=user)
    view = SubscriptionPlanListView.as_view()
    try:
        response = view(request)
        print("Status:", response.status_code)
        print("Data:", response.data.get('current_subscription'))
    except Exception as e:
        print("Error:", e)
