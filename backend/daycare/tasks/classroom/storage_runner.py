import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

try:
    path = default_storage.save('test_students/test.txt', ContentFile(b'test'))
    url = default_storage.url(path)
    print('URL:', url)
except Exception as e:
    print('Error:', str(e))
