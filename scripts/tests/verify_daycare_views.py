import os
import sys
import django

sys.path.insert(0, os.path.abspath('.'))
sys.path.insert(0, os.path.abspath('apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.test import Client
from core.models import User, Daycare

client = Client()

# Get or create test daycare and daycare admin
daycare = Daycare.objects.filter(name='myhome').first() or Daycare.objects.first()
if not daycare:
    daycare = Daycare.objects.create(name='Sunny Days Academy', email='admin@sunnydays.com', status='Active')

dc_user = User.objects.filter(daycare=daycare).first()
if not dc_user:
    dc_user = User.objects.create_user(
        username='daycaremanager',
        email='manager@daycare.com',
        password='password123',
        daycare=daycare,
        is_staff=True
    )
else:
    dc_user.set_password('password123')
    dc_user.save()

# Login as daycare admin
login_res = client.post('/login/', {'username': dc_user.username, 'password': 'password123'})
print(f"Login as Daycare Admin ({dc_user.username}): status {login_res.status_code}")

daycare_endpoints = [
    '/daycare/dashboard/',
    '/daycare/settings/',
    '/daycare/profile/',
    '/daycare/branches/',
    '/daycare/holidays/',
    '/daycare/emergency-info/',
    '/daycare/documents/',
    '/daycare/compliance/',
    '/daycare/communication/',
    '/daycare/consent-forms/',
    '/daycare/children/',
    '/daycare/children/new/',
    '/daycare/admissions/',
    '/daycare/waitlist/',
    '/daycare/employees/',
    '/daycare/employees/new/',
    '/daycare/employees/dashboard/',
    '/daycare/credentials/',
    '/daycare/scheduling/',
    '/daycare/scheduling/overtime/',
    '/daycare/scheduling/swaps/',
    '/daycare/scheduling/shortages/',
    '/daycare/leave/',
    '/daycare/staff/attendance/',
    '/daycare/staff/timesheets/',
    '/daycare/classrooms/',
    '/daycare/classrooms/new/',
    '/daycare/programs/',
    '/daycare/age-groups/',
    '/daycare/ratio-monitoring/',
    '/daycare/ratio-rules/',
    '/daycare/attendance/',
    '/daycare/attendance/dashboard/',
    '/daycare/safe-arrival/',
    '/daycare/pickup-verification/',
    '/daycare/daily-reports/',
    '/daycare/health/',
    '/daycare/billing/invoices/',
    '/daycare/billing/payments/',
    '/daycare/billing/subsidies/',
    '/daycare/billing/tax-receipts/',
    '/daycare/billing/fee-structures/',
    '/daycare/billing/discounts-credits/',
    '/daycare/subscription/',
]

for ep in daycare_endpoints:
    resp = client.get(ep)
    print(f"GET {ep.ljust(30)}: {resp.status_code}")
    assert resp.status_code == 200, f"Endpoint {ep} failed with status {resp.status_code}"

# Verify Dashboard HTML contains our new components
resp = client.get('/daycare/dashboard/')
html = resp.content.decode('utf-8')
assert 'Center Command Center' in html, "Center Command Center not in dashboard HTML"
assert 'Daycare Task &amp; Operations Center' in html or 'Daycare Task & Operations Center' in html, "Task center not in dashboard HTML"
assert 'attendanceLineChart' in html, "Attendance chart canvas not in dashboard HTML"
assert 'roomsDoughnutChart' in html, "Rooms doughnut chart canvas not in dashboard HTML"

print("\nALL DAYCARE PORTAL VIEWS VERIFIED 200 OK WITH BEAUTIFUL NEW DESIGN!")
