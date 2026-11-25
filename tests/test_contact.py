import urllib.request
import json

url = 'http://127.0.0.1:8000/api/students/2e318f61-5af8-4b01-86ea-c150e6e31a4b/contacts/'
data = json.dumps({'name': 'dfdf', 'relationship': 'dsfs', 'mobile': '123', 'email': '', 'is_primary': False}).encode('utf-8')
req = urllib.request.Request(url, data=data, method='POST')
req.add_header('Content-Type', 'application/json')
try:
    with urllib.request.urlopen(req) as response:
        print('Status:', response.status)
except Exception as e:
    print('Error:', getattr(e, 'read', lambda: b'')().decode('utf-8'))
