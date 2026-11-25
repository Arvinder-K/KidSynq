import os
import sys
from datetime import datetime, time, timedelta
import django

sys.path.insert(0, os.path.abspath('.'))
sys.path.insert(0, os.path.abspath('apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import Daycare, Employee, Classroom, StaffSchedule

daycare = Daycare.objects.filter(name='myhome').first() or Daycare.objects.first()
print(f"Using daycare: {daycare.name} ({daycare.id})")

# Ensure at least one classroom exists
room, _ = Classroom.objects.get_or_create(
    daycare=daycare,
    room_name="Sunshine Toddlers",
    defaults={
        'capacity': 15,
        'color': '#0ea5e9',
        'status': 'Active'
    }
)
room2, _ = Classroom.objects.get_or_create(
    daycare=daycare,
    room_name="Explorers Preschool",
    defaults={
        'capacity': 20,
        'color': '#10b981',
        'status': 'Active'
    }
)
print(f"Classrooms: {room.room_name}, {room2.room_name}")

# Get employee
emp = Employee.objects.filter(daycare=daycare).first()
if not emp:
    emp = Employee.objects.create(
        daycare=daycare,
        first_name="Ravi",
        last_name="Teacher",
        email="ravi@myhome.com",
        phone="555-987-6543",
        status="Active"
    )
print(f"Employee: {emp.first_name} {emp.last_name} ({emp.id})")

# Ensure second employee exists so we have multiple staff to schedule
emp2 = Employee.objects.filter(daycare=daycare).exclude(id=emp.id).first()
if not emp2:
    emp2 = Employee.objects.create(
        daycare=daycare,
        first_name="Priya",
        last_name="Sharma",
        email="priya@myhome.com",
        phone="555-123-9988",
        status="Active"
    )
print(f"Employee 2: {emp2.first_name} {emp2.last_name} ({emp2.id})")

# Populate shifts for the current week (Nov 09, 2026 - Nov 13, 2026)
from django.utils import timezone
today = timezone.now().date()
monday = today - timedelta(days=today.weekday())

shifts_plan = [
    # Monday
    (emp, monday, time(8, 30), time(17, 0), 'regular', room, 'Morning circle time & lunch supervision'),
    (emp2, monday, time(7, 30), time(16, 0), 'opening', room2, 'Center opening & breakfast setup'),
    # Tuesday
    (emp, monday + timedelta(days=1), time(8, 30), time(17, 0), 'regular', room, 'Sensory play activity'),
    (emp2, monday + timedelta(days=1), time(9, 30), time(18, 0), 'closing', room2, 'Late pickup supervision & closing'),
    # Wednesday
    (emp, monday + timedelta(days=2), time(7, 30), time(16, 0), 'opening', room, 'Early arrival desk & gym play'),
    (emp2, monday + timedelta(days=2), time(8, 30), time(17, 0), 'regular', room2, 'Music & arts session'),
    # Thursday
    (emp, monday + timedelta(days=3), time(8, 30), time(17, 0), 'regular', room, 'Outdoor playground duty'),
    (emp2, monday + timedelta(days=3), time(8, 30), time(17, 0), 'regular', room2, 'Reading circle & snack prep'),
    # Friday
    (emp, monday + timedelta(days=4), time(9, 30), time(18, 0), 'closing', room, 'End of week cleanup & closing'),
    (emp2, monday + timedelta(days=4), time(7, 30), time(16, 0), 'opening', room2, 'Early arrivals check-in'),
]

created_count = 0
for employee, s_date, s_start, s_end, s_type, s_room, s_notes in shifts_plan:
    obj, created = StaffSchedule.objects.get_or_create(
        daycare=daycare,
        employee=employee,
        date=s_date,
        shift_start=s_start,
        defaults={
            'shift_end': s_end,
            'shift_type': s_type,
            'classroom': s_room,
            'status': 'scheduled',
            'notes': s_notes
        }
    )
    if created:
        created_count += 1

print(f"Created {created_count} shifts for week {monday} - {monday + timedelta(days=6)}.")
print(f"Total shifts now in daycare: {StaffSchedule.objects.filter(daycare=daycare).count()}")

