"""
Automated end-to-end test for the KidSynq Public Business Homepage.
Verifies that '/' renders the public marketing/business page rather than redirecting to login.
"""
import os
import sys
import django

# Add workspace and apps directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model

User = get_user_model()

def run_tests():
    print("=" * 60)
    print("RUNNING HOME BUSINESS PAGE END-TO-END VERIFICATION")
    print("=" * 60)

    client = Client()

    # 1. Test unauthenticated GET to '/' (Homepage)
    print("\n[TEST 1] Unauthenticated GET /")
    resp = client.get('/')
    assert resp.status_code == 200, f"Expected 200 on '/', got {resp.status_code}"
    content = resp.content.decode('utf-8')

    assert 'Kid<span style="color: #62e4ff;">Synq</span>' in content or 'KidSynq' in content, "Missing brand name"
    assert 'Empowering Childcare Operations' in content, "Missing hero headline"
    assert 'Daycare Staff Portal' in content, "Missing Daycare Staff Portal link"
    assert 'Family Login' in content or 'Family & Guardian Portal' in content, "Missing Family Portal"
    assert 'SuperAdmin Console' in content, "Missing SuperAdmin section"
    assert 'daycare_bg.jpg' in content, "Missing daycare background image"
    assert 'href="/login/' in content or "href='/login/" in content, "Missing login CTA"
    print("  [PASS] GET / renders full business homepage with status 200 (No raw login redirect).")

    # 2. Test unauthenticated GET to '/home/' alias
    print("\n[TEST 2] Unauthenticated GET /home/")
    alias_resp = client.get('/home/')
    assert alias_resp.status_code == 200, f"Expected 200 on '/home/', got {alias_resp.status_code}"
    print("  [PASS] GET /home/ alias renders 200.")

    # 3. Test unauthenticated GET to '/login/'
    print("\n[TEST 3] Unauthenticated GET /login/")
    login_resp = client.get('/login/')
    assert login_resp.status_code == 200, f"Expected 200 on '/login/', got {login_resp.status_code}"
    print("  [PASS] /login/ remains directly accessible.")

    # 4. Test unauthenticated GET to '/dashboard/' (should redirect to login)
    print("\n[TEST 4] Unauthenticated GET /dashboard/")
    dash_resp = client.get('/dashboard/')
    assert dash_resp.status_code == 302, f"Expected 302 on '/dashboard/', got {dash_resp.status_code}"
    assert '/login' in dash_resp.url, f"Expected redirect to /login, got {dash_resp.url}"
    print("  [PASS] /dashboard/ properly guards and redirects unauthenticated users to /login.")

    # 5. Test authenticated GET to '/'
    print("\n[TEST 5] Authenticated GET /")
    user = User.objects.filter(username='daycaremanager').first()
    if not user:
        user = User.objects.first()
    if user:
        client.force_login(user)
        auth_resp = client.get('/')
        assert auth_resp.status_code == 200
        auth_content = auth_resp.content.decode('utf-8')
        assert 'My Dashboard' in auth_content, "Missing 'My Dashboard' CTA for authenticated user"
        print(f"  [PASS] Authenticated user ({user.username}) sees 'My Dashboard' button on home business page.")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED.")
    print("=" * 60)

if __name__ == '__main__':
    run_tests()
