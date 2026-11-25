import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.db import connection
from django.core.management import call_command
from core.models import User, Daycare, Branch, SubscriptionPlan, DaycareSubscription, Employee

def run():
    print(f"Using database: {connection.settings_dict['ENGINE']} / {connection.settings_dict['NAME']}")
    
    # 1. Run migrations
    try:
        print("Checking migrations...")
        call_command('migrate', interactive=False)
        print("Migrations up to date.")
    except Exception as e:
        print(f"Migration error: {e}")

    # 2. Seed subscription features
    try:
        print("Seeding subscription features & plans...")
        import seed_subscription_features
        print("Subscription features & plans seeded.")
    except Exception as e:
        print(f"Seed features note: {e}")

    # 3. Ensure a default Daycare exists
    daycare, created = Daycare.objects.get_or_create(
        name="Little Stars Learning Academy",
        defaults={
            'email': 'admin@littlestars.ca',
            'phone': '416-555-0199',
            'address1': '100 University Ave',
            'city': 'Toronto',
            'state': 'ON',
            'country': 'Canada',
            'postal_code': 'M5J 2P1',
            'capacity': 85,
            'status': 'Active'
        }
    )
    if created:
        print(f"Created default daycare: {daycare.name}")
    else:
        daycare.status = 'Active'
        daycare.save()

    branch, _ = Branch.objects.get_or_create(daycare=daycare, name='Main Campus')

    # Ensure Daycare has an active subscription
    plan = SubscriptionPlan.objects.first()
    if plan:
        sub, _ = DaycareSubscription.objects.get_or_create(
            daycare=daycare,
            defaults={
                'subscription_plan': plan,
                'subscription_status': 'Active',
                'billing_cycle': 'Monthly',
                'amount': plan.monthly_price
            }
        )
        sub.subscription_status = 'Active'
        sub.save()

    # 4. Super Admin User
    su, created = User.objects.get_or_create(
        username='superadmin',
        defaults={
            'email': 'superadmin@kidsynq.com',
            'first_name': 'Platform',
            'last_name': 'SuperAdmin',
            'is_staff': True,
            'is_superuser': True,
            'status': 'Active'
        }
    )
    su.set_password('superadmin123')
    su.is_superuser = True
    su.is_staff = True
    su.status = 'Active'
    su.is_active = True
    su.save()
    print(f"Superadmin user '{su.username}' password set to superadmin123 (active={su.is_active}, is_superuser={su.is_superuser})")

    # 5. Daycare Admin User
    admin_u, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@littlestars.ca',
            'first_name': 'Daycare',
            'last_name': 'Director',
            'is_staff': True,
            'is_superuser': False,
            'daycare': daycare,
            'branch': branch,
            'status': 'Active'
        }
    )
    admin_u.set_password('admin123')
    admin_u.daycare = daycare
    admin_u.branch = branch
    admin_u.is_superuser = False
    admin_u.status = 'Active'
    admin_u.is_active = True
    admin_u.save()
    print(f"Daycare admin user '{admin_u.username}' password set to admin123 (active={admin_u.is_active}, daycare={admin_u.daycare.name})")

    # 6. Staff / Educator Users
    for staff_username in ['staff', 'teacher']:
        staff_u, created = User.objects.get_or_create(
            username=staff_username,
            defaults={
                'email': f'{staff_username}@littlestars.ca',
                'first_name': 'Sarah',
                'last_name': 'Jenkins',
                'is_staff': False,
                'is_superuser': False,
                'daycare': daycare,
                'branch': branch,
                'status': 'Active'
            }
        )
        staff_u.set_password('admin123')
        staff_u.daycare = daycare
        staff_u.branch = branch
        staff_u.is_superuser = False
        staff_u.status = 'Active'
        staff_u.is_active = True
        staff_u.save()

        # Ensure employee profile
        Employee.objects.get_or_create(
            user=staff_u,
            defaults={
                'daycare': daycare,
                'first_name': staff_u.first_name,
                'last_name': staff_u.last_name,
                'email': staff_u.email,
                'job_title': 'Early Childhood Educator',
                'status': 'Active'
            }
        )
        print(f"Staff user '{staff_u.username}' password set to admin123 (active={staff_u.is_active})")

    # 7. Guardian / Parent User
    guardian_u, created = User.objects.get_or_create(
        username='guardian',
        defaults={
            'email': 'guardian@example.com',
            'first_name': 'Elena',
            'last_name': 'Rostova',
            'is_staff': False,
            'is_superuser': False,
            'status': 'Active'
        }
    )
    guardian_u.set_password('guardian123')
    guardian_u.status = 'Active'
    guardian_u.is_active = True
    guardian_u.save()
    print(f"Guardian user '{guardian_u.username}' password set to guardian123 (active={guardian_u.is_active})")

    print("\n--- All MySQL user credentials and daycare links initialized successfully! ---")

if __name__ == '__main__':
    run()
