import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.contrib.auth.models import Group

roles = [
    'Super Admin',
    'Day Care Admin',
    'Support',
    'Daycare Director',
    'Assistant Director',
    'Supervisor',
    'Teacher',
    'Assistant Teacher',
    'Administrator',
    'Cook',
    'Cleaner',
    'Driver',
    'Volunteer',
    'Custom Position',
    'Parent',
    'Staff',
]

for role_name in roles:
    Group.objects.get_or_create(name=role_name)
    print(f"Ensured role/group exists: {role_name}")

print("Roles seeded successfully.")
