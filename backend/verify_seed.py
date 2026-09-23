import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from rest_framework.test import APIClient
from core.models import User

client = APIClient(HTTP_HOST='127.0.0.1')
user = User.objects.get(username='testday')
client.force_authenticate(user=user)

# 1. Classrooms endpoint
resp_c = client.get('/api/daycare/classrooms/', HTTP_HOST='127.0.0.1')
print('GET /api/daycare/classrooms/ -> Status:', resp_c.status_code)
if resp_c.status_code == 200:
    data = resp_c.json()
    results = data.get('results', data) if isinstance(data, dict) else data
    print(f'Classroom count: {len(results)}')
    for item in results:
        print(f"  - Room: {item.get('room_name') or item.get('name')}, Code: {item.get('room_code')}, Capacity: {item.get('capacity')}")

# 2. Children / Students endpoints
resp_s = client.get('/api/daycare/children/', HTTP_HOST='127.0.0.1')
print('\nGET /api/daycare/children/ -> Status:', resp_s.status_code)
if resp_s.status_code == 200:
    data = resp_s.json()
    results = data.get('results', data) if isinstance(data, dict) else data
    print(f'Child count: {len(results)}')
    for s in results[:5]:
        print(f"  - {s.get('first_name')} {s.get('last_name')} ({s.get('admission_number')})")
    print(f'  ... and {len(results) - 5} more')

resp_s2 = client.get('/api/students/', HTTP_HOST='127.0.0.1')
print('\nGET /api/students/ -> Status:', resp_s2.status_code)
if resp_s2.status_code == 200:
    data = resp_s2.json()
    results = data.get('results', data) if isinstance(data, dict) else data
    print(f'Student list count: {len(results)}')

# 3. Employees / Teachers endpoint
resp_e = client.get('/api/daycare/employees/', HTTP_HOST='127.0.0.1')
print('\nGET /api/daycare/employees/ -> Status:', resp_e.status_code)
if resp_e.status_code == 200:
    data = resp_e.json()
    items = data.get('results', data) if isinstance(data, dict) else data
    print(f'Employee count: {len(items)}')
    for emp in items:
        print(f"  - {emp.get('first_name')} {emp.get('last_name')} ({emp.get('role')}) - {emp.get('email')}")

# 4. Classrooms with assigned teachers
resp_c2 = client.get('/api/daycare/classrooms/', HTTP_HOST='127.0.0.1')
print('\nGET /api/daycare/classrooms/ -> Status:', resp_c2.status_code)
if resp_c2.status_code == 200:
    data = resp_c2.json()
    items = data.get('results', data) if isinstance(data, dict) else data
    for c in items:
        pt = c.get('primary_teacher')
        pt_name = (pt.get('first_name', '') + ' ' + pt.get('last_name', '')) if isinstance(pt, dict) else str(pt)
        print(f"  - Room: {c.get('room_name')} ({c.get('room_code')}) | Teacher: {pt_name}")

