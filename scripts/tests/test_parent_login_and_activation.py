import os
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
apps_dir = os.path.join(BASE_DIR, 'apps')
if apps_dir not in sys.path:
    sys.path.insert(0, apps_dir)

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.conf import settings
# Filter out whitenoise if not installed in current environment
settings.MIDDLEWARE = [m for m in settings.MIDDLEWARE if 'whitenoise' not in m.lower()]

from django.test import RequestFactory, Client
from django.contrib.auth import get_user_model
from django.contrib.sessions.middleware import SessionMiddleware
from django.contrib.messages.middleware import MessageMiddleware
from django.contrib.messages.storage.fallback import FallbackStorage
from django.urls import reverse
from core.models import Daycare, Student, Family, FamilyChild, FamilyGuardian, Guardian, GuardianInvitation
from apps.core.views_auth import UserLoginView, DashboardRouterView, FamilyActivateView
from apps.children.views import ChildDetailView
from apps.families.views import FamilyDashboardView, FamilyChildrenView, FamilyDailyReportsView, FamilyBillingView

User = get_user_model()

def setup_request(req, user=None):
    sm = SessionMiddleware(lambda r: None)
    sm.process_request(req)
    req.session.save()
    setattr(req, '_messages', FallbackStorage(req))
    if user:
        req.user = user
    return req

def run_tests():
    print("=== STARTING PARENT LOGIN & ACTIVATION VERIFICATION ===")
    factory = RequestFactory()
    client = Client()

    # 1. Verify Arvinder Kaur user and guardian
    guardian = Guardian.objects.filter(email__iexact='arvinder@educlaas.com').first()
    assert guardian is not None, "Guardian Arvinder Kaur not found!"
    assert guardian.user is not None, "Guardian Arvinder Kaur user not linked!"
    guardian.user.set_password('Parent2026!')
    guardian.user.save()
    assert guardian.user.role == 'Guardian', f"Expected role 'Guardian', got {guardian.user.role}"
    print(f"[PASS] 1. Guardian {guardian.full_name} linked to user {guardian.user.username} (role: {guardian.user.role})")

    # 2. Test Login with email and password 'Parent2026!'
    login_req = factory.post('/login/', {
        'username': 'arvinder@educlaas.com',
        'password': 'Parent2026!',
        'login_type': 'family'
    })
    setup_request(login_req)
    login_resp = UserLoginView.as_view()(login_req)
    assert login_resp.status_code == 302
    assert login_resp.url == reverse('dashboard_router')
    print("[PASS] 2. UserLoginView authenticated arvinder@educlaas.com and redirected to dashboard_router")

    # 3. Test Dashboard Router for Guardian
    router_req = factory.get('/dashboard/')
    setup_request(router_req, guardian.user)
    router_resp = DashboardRouterView.as_view()(router_req)
    assert router_resp.status_code == 302
    assert router_resp.url == reverse('family_dashboard')
    print(f"[PASS] 3. DashboardRouterView redirected to: {router_resp.url}")

    # 4. Test Family Portal Views (Dashboard, Children, Daily Reports, Billing)
    dash_req = factory.get('/family/dashboard/')
    setup_request(dash_req, guardian.user)
    dash_resp = FamilyDashboardView.as_view()(dash_req)
    assert dash_resp.status_code == 200
    dash_content = dash_resp.content.decode('utf-8')
    assert 'arsh preet' in dash_content.lower()
    print("[PASS] 4. FamilyDashboardView rendered 200 and displayed child 'arsh preet'")

    kids_req = factory.get('/family/children/')
    setup_request(kids_req, guardian.user)
    kids_resp = FamilyChildrenView.as_view()(kids_req)
    assert kids_resp.status_code == 200
    assert 'arsh preet' in kids_resp.content.decode('utf-8').lower()
    print("[PASS] 5. FamilyChildrenView rendered 200 with child profile")

    # 5. Test Staff Child Profile actions (activate_guardian_login, invite_guardian, reset_guardian_password)
    child = Student.objects.filter(child_families__family__family_guardians__guardian=guardian).first()
    assert child is not None, "Student arsh preet not found!"
    admin_user = User.objects.filter(is_superuser=True).first() or User.objects.filter(is_staff=True).first()

    # Test reset password from staff child profile
    reset_req = factory.post(f'/daycare/children/{child.id}/', {
        'action': 'reset_guardian_password',
        'guardian_id': str(guardian.id),
        'password': 'NewPassword2026!',
        'tab': 'family'
    })
    setup_request(reset_req, admin_user)
    reset_resp = ChildDetailView.as_view()(reset_req, pk=child.id)
    assert reset_resp.status_code == 302
    guardian.user.refresh_from_db()
    assert guardian.user.check_password('NewPassword2026!')
    print("[PASS] 6. Staff action 'reset_guardian_password' successfully updated guardian password")

    # Re-set to Parent2026! using activate_guardian_login
    act_req = factory.post(f'/daycare/children/{child.id}/', {
        'action': 'activate_guardian_login',
        'guardian_id': str(guardian.id),
        'password': 'Parent2026!',
        'tab': 'family'
    })
    setup_request(act_req, admin_user)
    act_resp = ChildDetailView.as_view()(act_req, pk=child.id)
    assert act_resp.status_code == 302
    guardian.refresh_from_db()
    assert guardian.user.check_password('Parent2026!')
    print("[PASS] 7. Staff action 'activate_guardian_login' successfully re-set password to 'Parent2026!'")

    # Test invite_guardian action
    inv_req = factory.post(f'/daycare/children/{child.id}/', {
        'action': 'invite_guardian',
        'guardian_id': str(guardian.id),
        'email': 'test_invite_parent@educlaas.com',
        'tab': 'family'
    })
    setup_request(inv_req, admin_user)
    inv_resp = ChildDetailView.as_view()(inv_req, pk=child.id)
    assert inv_resp.status_code == 302
    inv_obj = GuardianInvitation.objects.filter(email='test_invite_parent@educlaas.com', status='pending').first()
    assert inv_obj is not None, "Invitation not created!"
    print(f"[PASS] 8. Staff action 'invite_guardian' generated invitation token: {inv_obj.token}")

    # Test FamilyActivateView using this token
    activate_req = factory.post(f'/family/activate/{inv_obj.token}/', {
        'token': inv_obj.token,
        'password': 'ActivatedParent2026!',
        'confirm_password': 'ActivatedParent2026!'
    })
    setup_request(activate_req)
    activate_resp = FamilyActivateView.as_view()(activate_req, token=inv_obj.token)
    assert activate_resp.status_code == 302
    assert activate_resp.url == reverse('family_dashboard')
    inv_obj.refresh_from_db()
    assert inv_obj.status == 'accepted'
    print(f"[PASS] 9. FamilyActivateView activated account and redirected to family_dashboard")

    # Clean up test invite
    User.objects.filter(email='test_invite_parent@educlaas.com').delete()
    inv_obj.delete()

    print("=== ALL 9 PARENT LOGIN & ACTIVATION TESTS PASSED 100%! ===")

if __name__ == '__main__':
    run_tests()
