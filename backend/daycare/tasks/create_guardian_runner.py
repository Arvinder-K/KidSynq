import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import Daycare, User, Family, Guardian, FamilyGuardian

# Get or create daycare
daycare, _ = Daycare.objects.get_or_create(name="Manual Test Daycare", defaults={"status": "Active"})

# Get or create login user
user, created = User.objects.get_or_create(
    username="guardian@test.com",
    defaults={
        "email": "guardian@test.com",
        "first_name": "John",
        "last_name": "Doe",
        "is_staff": False,
        "daycare": daycare
    }
)
if created:
    user.set_password("TempPass123!")
    user.save()

# Get or create Guardian profile
guardian, _ = Guardian.objects.get_or_create(
    user=user,
    defaults={
        "daycare": daycare,
        "first_name": "John",
        "last_name": "Doe",
        "email": "guardian@test.com",
        "phone": "555-0199"
    }
)

# Get or create Family
family, _ = Family.objects.get_or_create(
    daycare=daycare,
    family_name="Doe Family",
    defaults={
        "primary_contact": "John Doe",
        "primary_email": "guardian@test.com",
        "primary_phone": "555-0199"
    }
)

# Link Guardian to Family
FamilyGuardian.objects.get_or_create(
    family=family,
    guardian=guardian,
    defaults={
        "relationship": "Father",
        "is_primary": True
    }
)

print("Guardian user 'guardian@test.com' with password 'TempPass123!' created successfully!")
