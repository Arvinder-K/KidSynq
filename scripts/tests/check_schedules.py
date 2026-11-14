import os
import sys
import django

sys.path.insert(0, os.path.abspath('.'))
sys.path.insert(0, os.path.abspath('apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import StaffSchedule, Daycare, Employee, Classroom

print("Total Daycares:", Daycare.objects.count())
for dc in Daycare.objects.all():
    print(f"Daycare: {dc.name} (id={dc.id})")
    print(f"  Employees: {Employee.objects.filter(daycare=dc).count()}")
    for emp in Employee.objects.filter(daycare=dc):
        print(f"    Employee: {emp.first_name} {emp.last_name} (id={emp.id})")
    print(f"  Classrooms: {Classroom.objects.filter(daycare=dc).count()}")
    print(f"  Schedules: {StaffSchedule.objects.filter(daycare=dc).count()}")
    for s in StaffSchedule.objects.filter(daycare=dc):
        print(f"    Shift: date={s.date}, start={s.shift_start}, end={s.shift_end}, emp={s.employee.first_name} {s.employee.last_name}")

print("\nAll StaffSchedule count in entire DB:", StaffSchedule.objects.count())
for s in StaffSchedule.objects.all()[:10]:
    print(f"  Overall Shift: daycare={s.daycare_id}, date={s.date}, emp={s.employee.first_name} {s.employee.last_name}")

