import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import User
u = User.objects.get(username='admin')
print(f"username: {u.username}")
print(f"is_active: {u.is_active}")
print(f"status: {getattr(u, 'status', 'N/A')}")
print(f"role: {getattr(u, 'role', 'N/A')}")
print(f"is_superuser: {u.is_superuser}")
print(f"check_password: {u.check_password('admin123')}")
