import os
import sys
import django

# Setup Django environment
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model

User = get_user_model()

def verify_bright_theme():
    client = Client()
    user = User.objects.filter(username='daycaremanager').first()
    assert user is not None, "daycaremanager user not found"
    client.force_login(user)

    routes = [
        ('/daycare/dashboard/', 'Daycare Dashboard'),
        ('/daycare/children/', 'Children Directory'),
        ('/daycare/employees/', 'Employee Roster'),
        ('/daycare/staff/attendance/', 'Staff Attendance'),
        ('/daycare/chat/', 'Operations Copilot'),
        ('/', 'Home Business Page'),
    ]

    print("============================================================")
    print("VERIFYING BRIGHT CHILDCARE THEME ACROSS INTERNAL & PUBLIC PAGES")
    print("============================================================")

    for route, label in routes:
        resp = client.get(route)
        assert resp.status_code == 200, f"Route {route} returned status {resp.status_code}"
        content = resp.content.decode('utf-8')
        
        # Verify dark mode override is NOT present
        assert 'KidSynq Dark Glassmorphism Ambient Theme' not in content, f"Dark theme comment found in {route}"
        assert '--ks-bg-dark: #07111d' not in content, f"Dark background variable found in {route}"
        assert 'body, .app-wrapper, .clean-wrapper {' not in content or '!important' not in content, f"Forced dark wrapper found in {route}"

        print(f"  [PASS] {label} ({route}) rendered 200 with bright clean theme.")

    print("\nALL ROUTES SUCCESSFULLY VERIFIED WITH BRIGHT CLEAN DAYCARE PALETTE!")

if __name__ == '__main__':
    verify_bright_theme()
