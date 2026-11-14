import os
import sys
import django

sys.path.insert(0, os.path.abspath('.'))
sys.path.insert(0, os.path.abspath('apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.test import Client
from core.models import SubscriptionPlan

plan = SubscriptionPlan.objects.filter(id='3f33f1f2-dc10-47dc-a6a4-4affea8220fe').first()
if plan:
    print(f"Found plan: {plan.name}, mb: {plan.max_storage_mb}, gb: {plan.max_storage_gb}")
else:
    print("Listing all plans:")
    for p in SubscriptionPlan.objects.all():
        print(f"{p.id} - {p.name} - mb: {p.max_storage_mb} - gb: {p.max_storage_gb}")

client = Client()
client.post('/superadmin/login/', {'username': 'superadmin', 'password': 'superadmin123'})

target_plan = plan or SubscriptionPlan.objects.first()
edit_url = f"/superadmin/plans/{target_plan.id}/edit/"

post_data = {
    'name': target_plan.name,
    'price': '49.00',
    'billing_frequency': 'monthly',
    'max_students': '30',
    'max_staff': '8',
    'max_classrooms': '3',
    'max_storage_gb': '5.0',  # The exact input that triggered the error
    'is_active': 'on'
}

resp = client.post(edit_url, post_data)
print(f"POST {edit_url} status: {resp.status_code} -> Location: {resp.headers.get('Location', '')}")
assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}"

target_plan.refresh_from_db()
print(f"After update: {target_plan.name}, max_storage_mb: {target_plan.max_storage_mb}, max_storage_gb: {target_plan.max_storage_gb}")
assert target_plan.max_storage_mb == 5120, f"Expected 5120 MB, got {target_plan.max_storage_mb}"

# Also test GET on the edit page to verify rendered HTML
get_resp = client.get(edit_url)
print(f"GET {edit_url} status: {get_resp.status_code}")
assert get_resp.status_code == 200
html = get_resp.content.decode('utf-8')
assert 'value="5"' in html, f"Expected value=\"5\" in HTML, got:\n{html}"

print("\nALL PLAN EDIT CHECKS PASSED SUCCESSFULLY!")

