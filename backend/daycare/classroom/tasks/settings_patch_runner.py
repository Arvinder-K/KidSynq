import urllib.request
import urllib.error
import json

url = 'http://127.0.0.1:8000/api/students/2e318f61-5af8-4b01-86ea-c150e6e31a4b/'
data = json.dumps({'first_name': 'Arshpreet'}).encode('utf-8')
req = urllib.request.Request(url, data=data, method='PATCH')
req.add_header('Content-Type', 'application/json')
# We know it will fail with 401 because we don't have token, but let's see if the endpoint exists and returns 401 or something else like 500
try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Body:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("Status:", e.code)
    print("Body:", e.read().decode('utf-8'))
except Exception as e:
    print("Error:", str(e))
