"""
KidSynq Fresh Database Reset Script
Safely clears all operational records and seed fresh system data.
Preserves table schemas and django_migrations.
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / 'apps'))

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.db import connection
from django.contrib.auth.models import Group
from core.models import User, Province, CredentialType, EmployeeType, SubscriptionPlan, SubscriptionFeature

EXCLUDE_TABLES = {
    'django_migrations',
    'core_province',
    'core_credentialtype',
}

def clean_database():
    print("=" * 60)
    print("STARTING FRESH DATABASE RESET")
    print("=" * 60)

    with connection.cursor() as cursor:
        cursor.execute("SHOW TABLES")
        all_tables = [r[0] for r in cursor.fetchall()]

        # Filter tables to truncate
        tables_to_clear = [t for t in all_tables if t not in EXCLUDE_TABLES]

        print(f"Disabling foreign key constraints...")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")

        cleared_count = 0
        for table in tables_to_clear:
            try:
                cursor.execute(f"TRUNCATE TABLE `{table}`;")
                cleared_count += 1
            except Exception as e:
                print(f"Warning on {table}: {e}")

        print(f"Re-enabling foreign key constraints...")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
        print(f"Truncated {cleared_count} tables successfully.")

    # 1. Ensure Canadian Provinces
    ensure_provinces()

    # 2. Ensure Credential Types
    ensure_credentials()

    # 3. Ensure Auth Groups & Roles
    ensure_groups()

    # 4. Ensure Employee Types
    ensure_employee_types()

    # 5. Ensure Subscription Features & Plans
    ensure_subscription_plans()

    # 6. Ensure Super Admin Accounts
    ensure_admin()

    print("=" * 60)
    print("FRESH DATABASE RESET COMPLETE!")
    print("Super Admin Portal: /superadmin/login/")
    print("  - Username: superadmin / Password: superadmin123")
    print("  - Username: admin / Password: admin123")
    print("Django Admin Site: /django-admin/ or /admin/")
    print("Daycare Portal: /login/")
    print("=" * 60)


def ensure_provinces():
    print("Checking Canadian Provinces...")
    provinces = [
        ('AB', 'Alberta'),
        ('BC', 'British Columbia'),
        ('MB', 'Manitoba'),
        ('NB', 'New Brunswick'),
        ('NL', 'Newfoundland and Labrador'),
        ('NT', 'Northwest Territories'),
        ('NS', 'Nova Scotia'),
        ('NU', 'Nunavut'),
        ('ON', 'Ontario'),
        ('PE', 'Prince Edward Island'),
        ('QC', 'Quebec'),
        ('SK', 'Saskatchewan'),
        ('YT', 'Yukon'),
    ]
    for code, name in provinces:
        Province.objects.get_or_create(code=code, defaults={'name': name})
    print(f"Provinces ready ({Province.objects.count()} total).")


def ensure_credentials():
    print("Checking Credential Types...")
    creds = [
        'Annual Offence Declaration',
        'Criminal Record and Judicial Matters Check (CRJMC)',
        'Vulnerable Sector Check (VSC)',
        'CPR / AED Level C (Annual Renewal)',
        'Emergency First Aid & CPR Level B/C',
        'Food Handler / Food Safety Certification',
        'Standard First Aid & CPR Level C',
        'ECE Certificate',
        'ECE Degree',
        'ECE Diploma',
        'ECE Qualification',
        'Other approved credential',
        'Other approved ECE credential',
        'Anaphylaxis & Emergency Medical Response',
        'Child Protection & Duty to Report Training',
        'Fire Safety & Emergency Evacuation',
        'Occupational Health & Safety Awareness',
        'WHMIS Workplace Hazardous Materials',
    ]
    for name in creds:
        CredentialType.objects.get_or_create(name=name, defaults={'category': 'General', 'is_active': True})
    print(f"Credential types ready ({CredentialType.objects.count()} total).")


def ensure_groups():
    print("Checking Auth Roles/Groups...")
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
    for r in roles:
        Group.objects.get_or_create(name=r)
    print(f"Roles ready ({Group.objects.count()} total).")


def ensure_employee_types():
    print("Checking Employee Types...")
    emp_types = [
        'Teacher',
        'ECE',
        'Assistant',
        'Administrator',
        'Receptionist',
        'Accountant',
        'Cook',
        'Cleaner',
        'Driver',
    ]
    for name in emp_types:
        EmployeeType.objects.get_or_create(name=name, daycare=None)
    print(f"Employee types ready ({EmployeeType.objects.count()} total).")


def ensure_subscription_plans():
    print("Checking Subscription Features & Plans...")
    features_data = [
        ('students', 'Child Management', 'Children & Families', 1),
        ('family_management', 'Family Management', 'Children & Families', 2),
        ('admissions_waitlist', 'Enrollment & Online Admissions', 'Children & Families', 3),
        ('waitlist', 'Waitlist Management', 'Children & Families', 4),
        ('consent_forms', 'Consent Forms & Waivers', 'Children & Families', 5),
        ('classrooms', 'Classroom Management', 'Classroom', 10),
        ('ratio_monitoring', 'Ratio Monitoring', 'Classroom', 11),
        ('daily_reports', 'Daily Child Reports', 'Classroom', 12),
        ('attendance', 'Attendance & QR / PIN Kiosk', 'Attendance & Operations', 20),
        ('safe_arrival', 'Safe Arrival & Departure Tracking', 'Attendance & Operations', 21),
        ('billing', 'Invoicing & Payments', 'Finance & Billing', 30),
        ('subsidies_cwelcc', 'CWELCC & Government Subsidies', 'Finance & Billing', 31),
        ('staff_management', 'Staff & Employee Directory', 'Staff & Scheduling', 40),
        ('scheduling', 'Shift Scheduling & Time Tracking', 'Staff & Scheduling', 41),
        ('credentials', 'ECE Compliance & Credential Tracking', 'Staff & Scheduling', 42),
        ('communication', 'Announcements & Messaging', 'Operations & Communication', 50),
        ('documents', 'Digital Document Vault', 'Operations & Communication', 51),
        ('reports', 'Reports & Analytics Hub', 'Operations & Communication', 52),
    ]

    feature_objs = []
    for code, name, cat, order in features_data:
        feat, _ = SubscriptionFeature.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'category': cat,
                'order': order,
                'description': f'{name} module and tools.'
            }
        )
        feature_objs.append(feat)

    # Plans
    plans_data = [
        {
            'name': 'Starter',
            'monthly_price': 49.00,
            'quarterly_price': 135.00,
            'annual_price': 490.00,
            'max_students': 30,
            'max_teachers': 5,
            'max_staff': 8,
            'max_classrooms': 3,
            'max_branches': 1,
            'max_storage_mb': 5120,
            'status': 'Active',
            'description': 'Essential features for small daycares and home-based providers.'
        },
        {
            'name': 'Professional',
            'monthly_price': 129.00,
            'quarterly_price': 350.00,
            'annual_price': 1290.00,
            'max_students': 100,
            'max_teachers': 20,
            'max_staff': 30,
            'max_classrooms': 8,
            'max_branches': 2,
            'max_storage_mb': 25600,
            'status': 'Active',
            'description': 'Comprehensive tools for growing centers and multiple classrooms.'
        },
        {
            'name': 'Enterprise',
            'monthly_price': 299.00,
            'quarterly_price': 800.00,
            'annual_price': 2990.00,
            'max_students': 500,
            'max_teachers': 100,
            'max_staff': 150,
            'max_classrooms': 30,
            'max_branches': 10,
            'max_storage_mb': 102400,
            'status': 'Active',
            'description': 'Multi-branch operations, full analytics, and unlimited scalability.'
        },
    ]

    for pdata in plans_data:
        pname = pdata.pop('name')
        plan, _ = SubscriptionPlan.objects.get_or_create(name=pname, defaults=pdata)
        plan.features.set(feature_objs)
        plan.save()

    print(f"Subscription plans ready ({SubscriptionPlan.objects.count()} total).")


def ensure_admin():
    print("Setting up Super Admin 'superadmin'...")
    superadmin_user, _ = User.objects.get_or_create(
        username='superadmin',
        defaults={
            'email': 'superadmin@kidsynq.com',
            'first_name': 'Platform',
            'last_name': 'SuperAdmin',
            'is_staff': True,
            'is_superuser': True,
            'is_active': True,
            'status': 'Active',
        }
    )
    superadmin_user.set_password('superadmin123')
    superadmin_user.is_staff = True
    superadmin_user.is_superuser = True
    superadmin_user.is_active = True
    superadmin_user.status = 'Active'
    superadmin_user.daycare = None
    superadmin_user.save()
    print("Super Admin 'superadmin' configured with password 'superadmin123'.")

    print("Setting up Super Admin 'admin'...")
    user, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@kidsynq.com',
            'first_name': 'Super',
            'last_name': 'Admin',
            'is_staff': True,
            'is_superuser': True,
            'is_active': True,
            'status': 'Active',
        }
    )
    user.set_password('admin123')
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.status = 'Active'
    user.daycare = None
    user.save()
    print("Super Admin 'admin' configured with password 'admin123'.")


if __name__ == '__main__':
    clean_database()
