import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model

User = get_user_model()

def run_login_tests():
    print("=" * 60)
    print("RUNNING PROFESSIONAL LOGIN PAGE VERIFICATION TESTS")
    print("=" * 60)

    client = Client()

    # 1. Test GET /login/ (default daycare)
    resp = client.get('/login/')
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    content = resp.content.decode('utf-8')
    assert "login-split-wrapper" in content, "Split screen wrapper missing"
    assert "login-showcase-panel" in content, "Showcase panel missing"
    assert "portal-segmented-bar" in content, "Portal segmented bar missing"
    assert "Daycare Center Admin" in content, "Default portal title missing"
    print("  [PASS] GET /login/ renders split-screen layout with Daycare portal.")

    # 2. Test GET /login/?type=staff
    resp = client.get('/login/?type=staff')
    assert resp.status_code == 200
    content = resp.content.decode('utf-8')
    assert 'value="staff"' in content
    print("  [PASS] GET /login/?type=staff properly initializes staff portal.")

    # 3. Test GET /login/?type=family
    resp = client.get('/login/?type=family')
    assert resp.status_code == 200
    content = resp.content.decode('utf-8')
    assert 'value="family"' in content
    print("  [PASS] GET /login/?type=family properly initializes family portal.")

    # 4. Test Successful Login POST
    # We test with daycaremanager
    resp = client.post('/login/', {
        'username': 'daycaremanager',
        'password': 'password123',
        'login_type': 'daycare'
    })
    # Should redirect to /dashboard/ or /daycare/dashboard/
    assert resp.status_code in [302, 301], f"Expected redirect, got {resp.status_code}"
    redirect_target = resp['Location']
    assert '/dashboard/' in redirect_target or '/daycare/' in redirect_target, f"Unexpected redirect target: {redirect_target}"
    print(f"  [PASS] POST /login/ successfully authenticates and redirects to {redirect_target}")

    # 5. Test Invalid Credentials
    client2 = Client()
    resp_fail = client2.post('/login/', {
        'username': 'nonexistent',
        'password': 'wrongpassword'
    })
    assert resp_fail.status_code == 200
    fail_content = resp_fail.content.decode('utf-8')
    assert "Invalid username/email or password" in fail_content
    print("  [PASS] POST /login/ handles invalid credentials with user-friendly error message.")

    print("\nALL LOGIN TESTS PASSED SUCCESSFULLY! 100% VERIFIED.")

if __name__ == '__main__':
    run_login_tests()
