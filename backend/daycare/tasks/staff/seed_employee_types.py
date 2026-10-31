import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import EmployeeType

roles = [
    'Teacher',
    'ECE',
    'Assistant',
    'Administrator',
    'Receptionist',
    'Accountant',
    'Cook',
    'Cleaner',
    'Driver'
]

def seed_employee_types():
    for role in roles:
        # Create without daycare (null) so they are available globally
        emp_type, created = EmployeeType.objects.get_or_create(name=role, daycare=None)
        if created:
            print(f"Created role: {role}")
        else:
            print(f"Role already exists: {role}")

if __name__ == '__main__':
    seed_employee_types()
