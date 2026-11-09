import os
import sys

APP_DIR = "/home/lqg1ons8pzm4/kidsynq_api"
SITE_PACKAGES = "/home/lqg1ons8pzm4/virtualenv/kidsynq_api/3.11/lib/python3.11/site-packages"

sys.path.insert(0, APP_DIR)
sys.path.insert(1, os.path.join(APP_DIR, 'apps'))
sys.path.insert(2, SITE_PACKAGES)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "kidsynq.settings")

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
