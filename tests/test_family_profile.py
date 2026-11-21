import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "kidsynq.settings")
django.setup()

from django.test import Client
from core.models import User

user = User.objects.filter(email='guardian@test.com').first()
if not user:
    print("User not found!")
else:
    c = Client()
    c.force_login(user)
    response = c.get('/api/family/profile/')
    print(f"Status: {response.status_code}")
    print(response.content.decode())
