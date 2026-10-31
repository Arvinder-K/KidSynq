import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import Daycare, Employee, User, EmployeeType

def add_employee():
    daycare = Daycare.objects.first()
    if not daycare:
        print("No daycare found. Please create a daycare first.")
        return

    # Create a dummy user
    user, created = User.objects.get_or_create(
        username='jane_doe',
        defaults={
            'email': 'jane.doe@example.com',
            'first_name': 'Jane',
            'last_name': 'Doe'
        }
    )
    if created:
        user.set_password('password123')
        user.save()

    # Create employee type
    emp_type, _ = EmployeeType.objects.get_or_create(
        name='Early Childhood Educator',
        daycare=daycare
    )

    # Create employee record
    employee, emp_created = Employee.objects.get_or_create(
        user=user,
        defaults={
            'daycare': daycare,
            'first_name': 'Jane',
            'last_name': 'Doe',
            'email': 'jane.doe@example.com',
            'phone': '123-456-7890',
            'employee_number': 'EMP-1001',
            'role': 'Teacher',
            'job_title': 'Senior ECE',
            'employment_type': 'Full-time',
            'status': 'active'
        }
    )
    
    if emp_created:
        employee.types.add(emp_type)
        print(f"Successfully created employee: {employee.first_name} {employee.last_name}")
    else:
        print(f"Employee {employee.first_name} {employee.last_name} already exists.")

if __name__ == '__main__':
    add_employee()
