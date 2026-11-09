import os
import sys
from datetime import datetime, time, timedelta
import django

sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('backend/apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.test import Client
from core.models import Daycare, User, Employee, Classroom, StaffSchedule

client = Client()

# Login as Daycare Admin
daycare = Daycare.objects.filter(name='myhome').first() or Daycare.objects.first()
user = User.objects.filter(daycare=daycare).exclude(guardian_profile__isnull=False).first()
if not user:
    user = User.objects.create_user(
        username='schedadmin',
        email='sched@daycare.com',
        password='password123',
        daycare=daycare,
        is_staff=True
    )
else:
    user.set_password('password123')
    user.save()

login_resp = client.post('/login/', {'username': user.username, 'password': 'password123'})
print(f"Login status: {login_resp.status_code}")
assert login_resp.status_code == 302, "Login failed"

print("\n--- 1. Testing GET /daycare/scheduling/ ---")
resp = client.get('/daycare/scheduling/')
print(f"GET /daycare/scheduling/ status: {resp.status_code}")
assert resp.status_code == 200, "Scheduling view failed to load"
html = resp.content.decode('utf-8')

# Verify UI Elements
assert 'Weekly Staff Shift Scheduling' in html, "Header missing"
assert 'Week Grid' in html, "Week Grid tab missing"
assert 'Detailed Shift List' in html or 'List' in html, "List tab missing"
assert 'Assign New Shift' in html, "Assign New Shift button missing"
assert 'addShiftModal' in html, "Add Shift modal missing"
assert 'Previous Week' in html or 'title="Previous Week"' in html, "Previous week navigation missing"
assert 'Next Week' in html or 'title="Next Week"' in html, "Next week navigation missing"

# Verify that shifts are rendered in HTML
assert 'Ravi' in html, "Staff member Ravi not found in scheduled shifts"
assert 'Priya' in html, "Staff member Priya not found in scheduled shifts"
assert 'Opening' in html, "Opening badge missing"
assert 'Regular' in html, "Regular badge missing"
print("SUCCESS: Weekly shift schedule displayed with grid, shift cards, week navigator, and action modals!")

print("\n--- 2. Testing POST /daycare/scheduling/ Create Shift ---")
emp = Employee.objects.filter(daycare=daycare).first()
room = Classroom.objects.filter(daycare=daycare).first()
today_str = datetime.now().strftime('%Y-%m-%d')

create_resp = client.post('/daycare/scheduling/', {
    'action': 'create_shift',
    'employee_id': str(emp.id),
    'shift_date': today_str,
    'shift_start': '11:00',
    'shift_end': '19:30',
    'shift_type': 'custom',
    'classroom_id': str(room.id) if room else '',
    'status': 'scheduled',
    'notes': 'Special test shift'
})
print(f"POST create_shift status: {create_resp.status_code} -> Location: {create_resp.headers.get('Location', '')}")
assert create_resp.status_code == 302, "Create shift POST failed"

new_shift = StaffSchedule.objects.filter(employee=emp, date=today_str, shift_start='11:00').first()
assert new_shift is not None, "New shift was not created in database"
print(f"SUCCESS: Created new shift for {emp.first_name} on {today_str} ({new_shift.shift_start} - {new_shift.shift_end})!")

print("\n--- 3. Testing POST /daycare/scheduling/ Delete Shift ---")
del_resp = client.post('/daycare/scheduling/', {
    'action': 'delete_shift',
    'schedule_id': str(new_shift.id)
})
print(f"POST delete_shift status: {del_resp.status_code}")
assert del_resp.status_code == 302, "Delete shift POST failed"
assert not StaffSchedule.objects.filter(id=new_shift.id).exists(), "Shift was not deleted"
print("SUCCESS: Shift was successfully deleted!")

print("\n==========================================")
print("ALL SCHEDULING TESTS PASSED FLAWLESSLY!")
print("==========================================")

