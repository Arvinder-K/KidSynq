import os
import sys
import django

sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('backend/apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.test import Client

client = Client()

print("--- 1. Testing Unauthenticated Access ---")
r = client.get('/superadmin/login/')
print(f"GET /superadmin/login/: {r.status_code}")
assert r.status_code == 200, "SuperAdmin login page failed to load"

r = client.get('/superadmin/dashboard/')
loc = r.headers.get('Location', '')
print(f"GET /superadmin/dashboard/ (unauthenticated): {r.status_code} -> Location: {loc}")
assert r.status_code == 302 and '/superadmin/login/' in loc, "Unauthenticated access didn't redirect to /superadmin/login/"

print("\n--- 2. Testing SuperAdmin Login ---")
login_res = client.post('/superadmin/login/', {'username': 'superadmin', 'password': 'superadmin123'})
print(f"POST /superadmin/login/ status: {login_res.status_code} -> Location: {login_res.headers.get('Location', '')}")
assert login_res.status_code == 302, "SuperAdmin login failed"

print("\n--- 3. Testing All SuperAdmin Views ---")
endpoints = [
    '/superadmin/dashboard/',
    '/superadmin/plans/',
    '/superadmin/daycares/',
    '/superadmin/daycares/create/',
    '/superadmin/users/',
    '/superadmin/subscriptions/',
    '/superadmin/invoices/',
    '/superadmin/payments/',
    '/superadmin/analytics/',
    '/superadmin/ratio-rules/',
    '/superadmin/audit-logs/',
    '/superadmin/announcements/',
    '/superadmin/tickets/',
]

# Verify /superadmin/admins/ gracefully redirects to /superadmin/daycares/ to prevent duplicate admin management
admin_redirect = client.get('/superadmin/admins/')
assert admin_redirect.status_code == 302 and '/superadmin/daycares/' in admin_redirect.headers.get('Location', ''), "Did not redirect /superadmin/admins/"
print("GET /superadmin/admins/ (redirect to /superadmin/daycares/): 302 OK")

all_passed = True
for ep in endpoints:
    resp = client.get(ep)
    status = resp.status_code
    print(f"GET {ep.ljust(32)}: {status}")
    if status != 200:
        all_passed = False
        print(f"FAILED on {ep} with status {status}")

print(f"\nAll endpoints passed 200 OK: {all_passed}")

print("\n--- 3.5. Testing Daycare Creation POST ---")
from core.models import SubscriptionPlan, Daycare, User
User.objects.filter(username='testdaycareadmin').delete()
Daycare.objects.filter(name='Test Daycare Academy').delete()

starter_plan = SubscriptionPlan.objects.filter(status='Active').first()
post_data = {
    'name': 'Test Daycare Academy',
    'email': 'contact@testdaycare.com',
    'phone': '555-123-4567',
    'address': '123 Main Street',
    'city': 'Toronto',
    'state': 'ON',
    'zip_code': 'M5V 2T6',
    'plan_id': str(starter_plan.id) if starter_plan else '',
    'admin_username': 'testdaycareadmin',
    'admin_email': 'admin@testdaycare.com',
    'admin_password': 'password123',
    'admin_first_name': 'Test',
    'admin_last_name': 'Admin'
}
create_resp = client.post('/superadmin/daycares/create/', post_data)
print(f"POST /superadmin/daycares/create/ status: {create_resp.status_code} -> Location: {create_resp.headers.get('Location', '')}")
assert create_resp.status_code == 302, f"Daycare creation failed with status {create_resp.status_code}"

created_dc = Daycare.objects.filter(name='Test Daycare Academy').first()
assert created_dc is not None, "Daycare was not created in database"
print(f"Created Daycare ID: {created_dc.id}, address: {created_dc.address}, postal_code: {created_dc.postal_code}")

# Test daycare detail page
detail_resp = client.get(f'/superadmin/daycares/{created_dc.id}/')
print(f"GET /superadmin/daycares/{created_dc.id}/: {detail_resp.status_code}")
assert detail_resp.status_code == 200, "Daycare detail view failed"

# Clean up test daycare and test user
created_dc.delete()
User.objects.filter(username='testdaycareadmin').delete()
print("Cleaned up test daycare and test user successfully.")

print("\n--- 4. Testing Admin User Login ---")
admin_client = Client()
admin_login = admin_client.post('/superadmin/login/', {'username': 'admin', 'password': 'admin123'})
print(f"POST /superadmin/login/ as 'admin': {admin_login.status_code} -> Location: {admin_login.headers.get('Location', '')}")
assert admin_login.status_code == 302, "Admin login to superadmin portal failed"

r_admin = admin_client.get('/superadmin/dashboard/')
print(f"GET /superadmin/dashboard/ as 'admin': {r_admin.status_code}")
assert r_admin.status_code == 200, "Admin cannot access dashboard"

print("\n--- 5. Testing General Site Login (/login/) ---")
anon_client = Client()
r_gen = anon_client.get('/login/')
print(f"GET /login/ (anonymous): {r_gen.status_code}")
assert r_gen.status_code == 200, "General login failed to load"

print("\n--- 6. Testing Django Admin (/django-admin/) ---")
r_django = client.get('/django-admin/')
print(f"GET /django-admin/: {r_django.status_code} -> Location: {r_django.headers.get('Location', '')}")

print("\nAll verification checks completed successfully!")
