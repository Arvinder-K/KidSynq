import os
import sys
import django

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')

django.setup()

from django.conf import settings
settings.MIDDLEWARE = [m for m in settings.MIDDLEWARE if 'whitenoise' not in m.lower()]

from django.test import Client
from core.models import User, Daycare, Employee, StaffAttendance, Classroom

def run_tests():
    print("=== Testing Staff Time Clock & Daily Attendance Operations ===")
    
    # 1. Fetch daycaremanager
    user = User.objects.filter(username='daycaremanager').first()
    if not user:
        user = User.objects.filter(role='DaycareAdmin').first()
    assert user is not None, "Daycare admin user must exist"
    
    dc = user.daycare
    assert dc is not None, "User must have an active daycare"
    print(f"User: {user.username}, Daycare: {dc.name} ({dc.id})")
    
    client = Client()
    client.force_login(user)

    url = '/daycare/staff/attendance/?date=2026-11-23'

    # 2. Test GET attendance page
    resp = client.get(url)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    content = resp.content.decode('utf-8')
    assert "Staff Daily Attendance & Time Clock" in content, "Page title missing"
    assert "Sarah Jenkins" in content, "Sarah Jenkins should appear"
    assert "On Duty" in content, "Sarah Jenkins should be on duty"
    assert "+ Clock In Staff" in content, "Clock In button missing"
    print("-> GET Staff Attendance Page: PASS (Sarah Jenkins is On Duty)")

    # 3. Test POST clock_in for Emily Watson
    emily = Employee.objects.filter(daycare=dc, first_name='Emily').first()
    assert emily is not None, "Emily Watson employee must exist"
    room = Classroom.objects.filter(daycare=dc).first()
    
    post_data = {
        'action': 'clock_in',
        'employee_id': str(emily.id),
        'classroom_id': str(room.id) if room else '',
        'date': '2026-11-23',
        'notes': 'Test morning coverage'
    }
    resp = client.post('/daycare/staff/attendance/', post_data)
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}"
    
    att_emily = StaffAttendance.objects.filter(daycare=dc, employee=emily, date='2026-11-23').first()
    assert att_emily is not None, "StaffAttendance record for Emily should be created"
    assert att_emily.status == 'CLOCKED_IN', f"Status should be CLOCKED_IN, got {att_emily.status}"
    print("-> POST Clock In for Emily Watson: PASS")

    # 4. Test POST toggle_break
    post_data = {
        'action': 'toggle_break',
        'record_id': str(att_emily.id),
        'date': '2026-11-23',
    }
    resp = client.post('/daycare/staff/attendance/', post_data)
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}"
    att_emily.refresh_from_db()
    assert att_emily.status == 'ON_BREAK', f"Status should be ON_BREAK, got {att_emily.status}"
    print("-> POST Toggle Break (to ON_BREAK): PASS")

    # 5. Test POST clock_out
    post_data = {
        'action': 'clock_out',
        'record_id': str(att_emily.id),
        'date': '2026-11-23',
    }
    resp = client.post('/daycare/staff/attendance/', post_data)
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}"
    att_emily.refresh_from_db()
    assert att_emily.status == 'CLOCKED_OUT', f"Status should be CLOCKED_OUT, got {att_emily.status}"
    assert att_emily.clock_out is not None, "clock_out timestamp should be recorded"
    print("-> POST Clock Out for Emily Watson: PASS")

    # Clean up Emily's test attendance
    att_emily.delete()

    print("\nALL STAFF TIME CLOCK OPERATIONS TESTS PASSED 100%!")

if __name__ == '__main__':
    run_tests()
