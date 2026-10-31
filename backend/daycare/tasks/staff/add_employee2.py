import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import Daycare, Employee, User, EmployeeType

def add_employee_to_all_daycares():
    daycares = Daycare.objects.all()
    if not daycares.exists():
        print("No daycares found.")
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

    for daycare in daycares:
        # Create employee type
        emp_type, _ = EmployeeType.objects.get_or_create(
            name='Early Childhood Educator',
            daycare=daycare
        )

        # Create employee record
        employee, emp_created = Employee.objects.get_or_create(
            user=user,
            daycare=daycare,
            defaults={
                'first_name': 'Jane',
                'last_name': 'Doe',
                'email': f'jane.doe.{daycare.id}@example.com',
                'phone': '123-456-7890',
                'employee_number': f'EMP-1001-{daycare.id}',
                'role': 'Teacher',
                'job_title': 'Senior ECE',
                'employment_type': 'Full-time',
                'status': 'active'
            }
        )
        
        if emp_created:
            employee.types.add(emp_type)
            print(f"Successfully created employee for Daycare {daycare.name}")
        else:
            print(f"Employee already exists for Daycare {daycare.name}")

if __name__ == '__main__':
    add_employee_to_all_daycares()
