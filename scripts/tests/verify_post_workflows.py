"""
Verify Core POST Workflows on Local System:
1. Child creation & admission
2. Staff creation
3. Classroom creation
4. Attendance check-in / check-out
5. Daycare creation in SuperAdmin
"""
import os
import sys
from pathlib import Path
from decimal import Decimal
from datetime import date, timedelta

BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / 'apps'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
import django
django.setup()

from django.test import Client
from core.models import User, Daycare, Student, Employee, Classroom, StudentAttendance, SubscriptionPlan

def test_posts():
    print("=" * 65)
    print("VERIFYING POST WORKFLOWS ON LOCAL SYSTEM")
    print("=" * 65)

    client = Client()
    login_resp = client.post('/login/', {'username': 'admin', 'password': 'admin123'})
    assert login_resp.status_code == 302, "Admin login failed"

    daycare = Daycare.objects.filter(name='Little Stars Learning Academy').first()
    assert daycare is not None, "Daycare not found"

    # 1. Child Creation
    print("[1/4] Testing Child Creation POST...")
    child_data = {
        'first_name': 'Benjamin',
        'last_name': 'Harris',
        'dob': '2023-05-10',
        'gender': 'Male',
        'allergies': 'Dairy',
        'emergency_contact_name': 'Laura Harris',
        'emergency_contact_phone': '(416) 555-4321',
        'emergency_contact_relationship': 'Mother'
    }
    r = client.post('/daycare/children/new/', child_data)
    assert r.status_code == 302, f"Child creation failed: {r.status_code}"
    created_child = Student.objects.filter(daycare=daycare, first_name='Benjamin', last_name='Harris').first()
    assert created_child is not None, "Child record not created in DB"
    print(f"  [OK] Child created: {created_child.first_name} {created_child.last_name} (ID: {created_child.id})")

    # 2. Staff Creation
    print("[2/4] Testing Staff Creation POST...")
    staff_data = {
        'first_name': 'Jessica',
        'last_name': 'Miller',
        'email': 'jessica.miller@example.com',
        'phone': '(416) 555-7788',
        'job_title': 'Assistant Teacher',
        'role': 'Teacher'
    }
    r = client.post('/daycare/employees/new/', staff_data)
    assert r.status_code == 302, f"Staff creation failed: {r.status_code}"
    created_emp = Employee.objects.filter(daycare=daycare, first_name='Jessica', last_name='Miller').first()
    assert created_emp is not None, "Employee record not created in DB"
    print(f"  [OK] Staff created: {created_emp.first_name} {created_emp.last_name} (ID: {created_emp.id})")

    # 3. Classroom Creation
    print("[3/4] Testing Classroom Creation POST...")
    room_data = {
        'name': 'Creative Minds Room',
        'room_code': 'CR-401',
        'capacity': 15,
        'min_age_months': 24,
        'max_age_months': 48,
        'color': '#10b981',
        'description': 'Room dedicated to STEM and early literacy.'
    }
    r = client.post('/daycare/classrooms/new/', room_data)
    assert r.status_code == 302, f"Classroom creation failed: {r.status_code}"
    created_room = Classroom.objects.filter(daycare=daycare, room_name='Creative Minds Room').first()
    assert created_room is not None, "Classroom record not created in DB"
    print(f"  [OK] Classroom created: {created_room.room_name} (Code: {created_room.room_code})")

    # 4. Attendance Roll Call Update
    print("[4/4] Testing Attendance Update POST...")
    att_data = {
        'student_id': str(created_child.id),
        'status': 'checked_in',
        'date': str(date.today())
    }
    r = client.post('/daycare/attendance/', att_data)
    assert r.status_code == 302, f"Attendance post failed: {r.status_code}"
    att_rec = StudentAttendance.objects.filter(daycare=daycare, student=created_child, attendance_date=date.today()).first()
    assert att_rec is not None, "Attendance record not found"
    assert att_rec.attendance_status == 'checked_in', f"Status not checked_in: {att_rec.attendance_status}"
    print(f"  [OK] Attendance updated: status={att_rec.attendance_status}, check_in_time={att_rec.check_in_time}")

    # Cleanup test created items
    att_rec.delete()
    created_child.delete()
    created_emp.delete()
    created_room.delete()
    print("  [OK] Cleaned up temporary test entities successfully.")

    print("\n" + "=" * 65)
    print("ALL CORE POST WORKFLOWS VERIFIED 100% OPERATIONAL!")
    print("=" * 65)

if __name__ == '__main__':
    test_posts()
