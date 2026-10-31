import requests
url = 'http://127.0.0.1:8000/api/students/2e318f61-5af8-4b01-86ea-c150e6e31a4b/photo/'
headers = {'Authorization': 'Bearer test'} # We will just see if it returns 401, 404, or 405
files = {'photo': ('test.jpg', b'dummy_content', 'image/jpeg')}
r = requests.post(url, files=files, headers=headers)
print(f"Status Code: {r.status_code}")
print(f"Response: {r.text}")
