from django.apps import AppConfig
from django.db.models.signals import post_migrate

class CoreConfig(AppConfig):
    name = 'core'

    def ready(self):
        try:
            from django.contrib.auth import get_user_model
            from django.db import connection
            # Check if User table exists before running queries
            tables = connection.introspection.table_names()
            if 'core_user' in tables or 'auth_user' in tables:
                User = get_user_model()
                
                # 1. Ensure 'superadmin' exists and has superuser credentials
                superadmin = User.objects.filter(username='superadmin').first()
                if not superadmin:
                    superadmin = User(username='superadmin', email='superadmin@kidsynq.com', first_name='Super', last_name='Admin')
                superadmin.set_password('superadmin123')
                superadmin.is_superuser = True
                superadmin.is_staff = True
                superadmin.is_active = True
                superadmin.status = 'Active'
                superadmin.save()

                # 2. Ensure 'admin' exists and has superuser credentials
                admin_user = User.objects.filter(username='admin').first()
                if not admin_user:
                    admin_user = User(username='admin', email='admin@kidsynq.com', first_name='Platform', last_name='Admin')
                admin_user.set_password('admin123')
                admin_user.is_superuser = True
                admin_user.is_staff = True
                admin_user.is_active = True
                admin_user.status = 'Active'
                admin_user.save()
        except Exception as e:
            pass
