import os
import sys

# Application directory (auto-detects current deployment folder)
APP_DIR = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(os.path.join(APP_DIR, 'manage.py')):
    APP_DIR = "/home/k3ysumq2i3br/kidsynq_django"

# Python virtualenv site-packages paths on cPanel / GoDaddy hosting
possible_site_packages = [
    "/home/k3ysumq2i3br/virtualenv/kidsynq_django/3.11/lib/python3.11/site-packages",
    "/home/k3ysumq2i3br/virtualenv/kidsynq_django/3.11/lib64/python3.11/site-packages",
    "/home/lqg1ons8pzm4/virtualenv/kidsynq_api/3.11/lib/python3.11/site-packages",
    os.path.join(APP_DIR, "venv", "lib", "python3.11", "site-packages"),
    os.path.join(APP_DIR, "venv", "Lib", "site-packages"),
]
for sp in possible_site_packages:
    if os.path.exists(sp) and sp not in sys.path:
        sys.path.insert(0, sp)

# Add application directory and apps to Python path
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

apps_dir = os.path.join(APP_DIR, 'apps')
if apps_dir not in sys.path:
    sys.path.insert(1, apps_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "kidsynq.settings")

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
