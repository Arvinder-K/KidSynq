import os
import sys
from django.core.management.base import BaseCommand
from django.db import connection
from django.db.models import Q
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "Clear all operational database data for a clean fresh start, drop unneeded legacy tables, and preserve SuperAdmin account(s)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-input',
            action='store_true',
            help='Execute without interactive confirmation',
        )
        parser.add_argument(
            '--admin-username',
            type=str,
            default='admin',
            help='SuperAdmin username to preserve (default: admin)',
        )
        parser.add_argument(
            '--admin-password',
            type=str,
            default=None,
            help='Set or reset superadmin password with this value if provided',
        )
        parser.add_argument(
            '--clear-plans',
            action='store_true',
            help='Also clear subscription plans and features (defaults to keeping them)',
        )
        parser.add_argument(
            '--drop-legacy-tables',
            action='store_true',
            default=True,
            help='Drop unneeded legacy Laravel tables (default: True)',
        )

    def handle(self, *args, **options):
        User = get_user_model()
        admin_username = options.get('admin_username') or 'admin'
        no_input = options.get('no_input', False)

        # 1. Discover SuperAdmin(s)
        superusers = list(
            User.objects.filter(
                Q(is_superuser=True) | Q(username__iexact=admin_username) | Q(username__iexact='superadmin')
            )
        )

        self.stdout.write(self.style.NOTICE("=" * 75))
        self.stdout.write(self.style.NOTICE(" 🧹 KIDSYNQ - FRESH DATABASE RESET & CLEANUP UTILITY"))
        self.stdout.write(self.style.NOTICE("=" * 75))

        if superusers:
            self.stdout.write(self.style.SUCCESS(f"Found {len(superusers)} SuperAdmin user(s) that will be PRESERVED:"))
            for su in superusers:
                self.stdout.write(f"   • Username: {su.username} | Email: {su.email or 'N/A'} | Superuser: {su.is_superuser}")
        else:
            self.stdout.write(self.style.WARNING(f"⚠️  No existing SuperAdmin found matching is_superuser=True or username='{admin_username}'."))
            self.stdout.write(self.style.WARNING(f"   A new SuperAdmin ('{admin_username}') will be created automatically."))

        # 2. Confirmation prompt unless --no-input
        if not no_input:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("⚠️  THIS ACTION WILL:"))
            self.stdout.write("   1. Drop unneeded legacy tables (cache, jobs, users, migrations, etc.)")
            self.stdout.write("   2. Clear all Daycares, Branches, and Organizations")
            self.stdout.write("   3. Clear all Students, Classrooms, Programs, and Attendance")
            self.stdout.write("   4. Clear all Families, Guardians, and Daily Reports")
            self.stdout.write("   5. Clear all Invoices, Payments, Billing Records, and Audit Logs")
            self.stdout.write("   6. Delete all Non-SuperAdmin User Accounts and active sessions")
            self.stdout.write("")
            confirm = input("Type 'yes' to proceed with resetting the database: ").strip().lower()
            if confirm != 'yes':
                self.stdout.write(self.style.ERROR("Reset cancelled by user."))
                return

        # 3. Discover database tables
        with connection.cursor() as cursor:
            existing_tables = set(connection.introspection.table_names(cursor))

        # Unneeded legacy tables left from previous stacks (Laravel/PHP)
        legacy_unneeded_tables = {
            'cache',
            'cache_locks',
            'failed_jobs',
            'job_batches',
            'jobs',
            'migrations',
            'password_reset_tokens',
            'personal_access_tokens',
            'sessions',
            'users',
        }

        # Django core system tables to NEVER touch
        system_tables = {
            'django_migrations',
            'django_content_type',
            'auth_permission',
        }

        # Lookups to preserve by default (plans, provinces, credentials, employee types)
        lookup_tables = {
            'core_province',
            'core_credentialtype',
            'core_employeetype',
        }
        if not options.get('clear_plans'):
            lookup_tables.update({
                'core_subscriptionplan',
                'core_subscriptionfeature',
                'core_subscriptionplanfeatures',
                'core_subscriptionplan_features',
            })

        # User tables handled via targeted queries
        user_tables = {
            'core_user',
            'core_user_groups',
            'core_user_user_permissions',
        }

        # Operational tables to clear
        tables_to_clear = [
            t for t in sorted(existing_tables)
            if t not in system_tables
            and t not in lookup_tables
            and t not in user_tables
            and t not in legacy_unneeded_tables
            and (t.startswith('core_') or t in ('django_session', 'django_admin_log', 'auth_group', 'auth_group_permissions'))
        ]

        self.stdout.write(f"\nOperational tables to clear: {len(tables_to_clear)}")
        self.stdout.write(self.style.NOTICE(f"Temporarily disabling foreign key checks on {connection.vendor}..."))

        total_deleted = 0
        total_dropped = 0

        with connection.cursor() as cursor:
            # Disable FK checks to allow clean clearing
            if connection.vendor in ('mysql', 'mariadb'):
                cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
            elif connection.vendor == 'sqlite':
                cursor.execute("PRAGMA foreign_keys = OFF;")

            try:
                # 4. Drop unneeded legacy tables
                if options.get('drop_legacy_tables', True):
                    self.stdout.write("\nChecking for unneeded legacy tables to drop...")
                    for leg_tbl in sorted(legacy_unneeded_tables):
                        if leg_tbl in existing_tables:
                            try:
                                cursor.execute(f"DROP TABLE IF EXISTS `{leg_tbl}`")
                                self.stdout.write(f"   🗑️  Dropped unneeded table: `{leg_tbl}`")
                                total_dropped += 1
                            except Exception as e:
                                self.stdout.write(self.style.ERROR(f"   ✗ Error dropping `{leg_tbl}`: {e}"))

                # 5. Clear operational tables
                self.stdout.write("\nClearing operational data...")
                for tbl in tables_to_clear:
                    try:
                        cursor.execute(f"SELECT COUNT(*) FROM `{tbl}`")
                        cnt = cursor.fetchone()[0]
                        if cnt > 0:
                            cursor.execute(f"DELETE FROM `{tbl}`")
                            self.stdout.write(f"   ✓ Cleared {cnt} rows from `{tbl}`")
                            total_deleted += cnt
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f"   ✗ Error clearing `{tbl}`: {e}"))

                # 6. Clean core_user:
                # Disconnect daycare and branch from SuperAdmin(s)
                cursor.execute("""
                    UPDATE `core_user`
                    SET daycare_id = NULL,
                        branch_id = NULL,
                        created_by_id = NULL,
                        updated_by_id = NULL
                    WHERE is_superuser = 1
                       OR LOWER(username) IN ('admin', 'superadmin', %s)
                """, [admin_username.lower()])

                # Delete all other non-superadmin users
                cursor.execute("""
                    SELECT COUNT(*) FROM `core_user`
                    WHERE is_superuser = 0
                      AND LOWER(username) NOT IN ('admin', 'superadmin', %s)
                """, [admin_username.lower()])
                non_super_count = cursor.fetchone()[0]

                if non_super_count > 0:
                    cursor.execute("""
                        DELETE FROM `core_user`
                        WHERE is_superuser = 0
                          AND LOWER(username) NOT IN ('admin', 'superadmin', %s)
                    """, [admin_username.lower()])
                    self.stdout.write(f"   ✓ Deleted {non_super_count} non-superadmin user(s) from `core_user`")
                    total_deleted += non_super_count

                # Clean up dangling user permission & group links
                if 'core_user_groups' in existing_tables:
                    cursor.execute("DELETE FROM `core_user_groups` WHERE user_id NOT IN (SELECT id FROM `core_user`)")
                if 'core_user_user_permissions' in existing_tables:
                    cursor.execute("DELETE FROM `core_user_user_permissions` WHERE user_id NOT IN (SELECT id FROM `core_user`)")

            finally:
                # Re-enable FK checks
                if connection.vendor in ('mysql', 'mariadb'):
                    cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
                elif connection.vendor == 'sqlite':
                    cursor.execute("PRAGMA foreign_keys = ON;")

        # 7. Verify & update/create SuperAdmin
        admin_pwd = options.get('admin_password')
        active_superusers = list(User.objects.filter(Q(is_superuser=True) | Q(username__iexact=admin_username)))

        if not active_superusers:
            self.stdout.write(self.style.NOTICE(f"\nCreating default SuperAdmin account ('{admin_username}')..."))
            pwd_to_set = admin_pwd or 'admin123'
            admin_user = User.objects.create_superuser(
                username=admin_username,
                email=f"{admin_username}@kidsynq.com",
                password=pwd_to_set,
                first_name='System',
                last_name='SuperAdmin',
                is_active=True,
                is_staff=True,
                is_superuser=True,
            )
            self.stdout.write(self.style.SUCCESS(f"   ✓ Created SuperAdmin: username='{admin_username}', password='{pwd_to_set}'"))
        else:
            for su in active_superusers:
                su.is_superuser = True
                su.is_staff = True
                su.is_active = True
                su.daycare = None
                su.branch = None
                if admin_pwd and su.username.lower() == admin_username.lower():
                    su.set_password(admin_pwd)
                    self.stdout.write(self.style.SUCCESS(f"   ✓ Updated password for '{su.username}'"))
                su.save()
                self.stdout.write(self.style.SUCCESS(f"   ✓ SuperAdmin verified: username='{su.username}' (ID: {su.pk})"))

        # 8. Ensure default Subscription Plans exist
        try:
            from core.models import SubscriptionPlan
            if SubscriptionPlan.objects.count() == 0:
                self.stdout.write("\nSeeding default subscription plans...")
                SubscriptionPlan.objects.create(
                    name='Starter',
                    description='Perfect for small, single-location daycares',
                    monthly_price=49.00,
                    max_classrooms=3,
                    max_students=30,
                    max_staff=5,
                    max_branches=1,
                    max_storage_mb=5120,
                    status='Active'
                )
                SubscriptionPlan.objects.create(
                    name='Professional',
                    description='Ideal for growing centers with multiple classrooms',
                    monthly_price=99.00,
                    max_classrooms=10,
                    max_students=100,
                    max_staff=20,
                    max_branches=1,
                    max_storage_mb=20480,
                    status='Active'
                )
                SubscriptionPlan.objects.create(
                    name='Enterprise',
                    description='Unlimited capacity for multi-location daycare networks',
                    monthly_price=199.00,
                    max_classrooms=999,
                    max_students=9999,
                    max_staff=999,
                    max_branches=10,
                    max_storage_mb=102400,
                    status='Active'
                )
                self.stdout.write(self.style.SUCCESS("   ✓ Seeded 3 default subscription plans (Starter, Professional, Enterprise)"))
        except Exception as err:
            self.stdout.write(self.style.WARNING(f"   Note: Subscription plan seeding skipped: {err}"))

        self.stdout.write("\n" + "=" * 75)
        self.stdout.write(self.style.SUCCESS(" 🎉 FRESH DATABASE RESET & CLEANUP COMPLETED!"))
        self.stdout.write("=" * 75)
        if total_dropped > 0:
            self.stdout.write(f"Unneeded legacy tables dropped: {total_dropped}")
        self.stdout.write(f"Operational records removed: {total_deleted}")
        self.stdout.write("Database is now clean, lean, and ready for fresh production use.")
