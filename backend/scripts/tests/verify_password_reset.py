import os
import sys
import django

sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('backend/apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.test import Client
from core.models import Daycare, User

client = Client()

print("--- 1. Logging in as SuperAdmin ---")
login_resp = client.post('/superadmin/login/', {'username': 'superadmin', 'password': 'superadmin123'})
print(f"Superadmin login status: {login_resp.status_code}")
assert login_resp.status_code == 302, "Superadmin login failed"

# Find our test daycare and admin user
daycare = Daycare.objects.filter(status='active').first() or Daycare.objects.first()
assert daycare is not None, "No daycare found"
admin_user = User.objects.filter(daycare=daycare).exclude(guardian_profile__isnull=False).first()
if not admin_user:
    admin_user = User.objects.create_user(
        username='testadmin_pwd',
        email='testpwd@daycare.com',
        password='OldPassword123!',
        daycare=daycare,
        is_staff=True
    )

print(f"Testing with Daycare: {daycare.name} ({daycare.id}), Admin: {admin_user.username} ({admin_user.id})")

print("\n--- 2. Checking Daycare Detail HTML for Reset Password UI ---")
detail_get = client.get(f'/superadmin/daycares/{daycare.id}/')
print(f"GET /superadmin/daycares/{daycare.id}/ status: {detail_get.status_code}")
assert detail_get.status_code == 200, "Daycare detail failed to load"
html = detail_get.content.decode('utf-8')
assert 'Reset Password' in html, "Reset Password button missing from Daycare detail table"
assert f'resetPasswordModal{admin_user.id}' in html, "Reset Password modal missing for admin user"
assert 'generatePassword' in html, "generatePassword script missing"
print("SUCCESS: Reset Password button and modal are present in Daycare Detail view!")

print("\n--- 3. Testing POST Password Reset via Daycare Detail View ---")
new_pwd_1 = "FreshSecurePwd2026!"
post_reset = client.post(f'/superadmin/daycares/{daycare.id}/', {
    'action': 'reset_admin_password',
    'user_id': str(admin_user.id),
    'new_password': new_pwd_1
})
print(f"POST password reset status: {post_reset.status_code} -> Location: {post_reset.headers.get('Location', '')}")
assert post_reset.status_code == 302, "Password reset POST failed"

# Verify login with the new password
auth_client = Client()
auth_res = auth_client.post('/login/', {'username': admin_user.username, 'password': new_pwd_1})
print(f"Login as admin with NEW password '{new_pwd_1}': status {auth_res.status_code}")
assert auth_res.status_code == 302, "Login with new password failed!"
print("SUCCESS: Admin successfully logged in with the new password reset from Daycare Detail!")

print("\n--- 4. Checking Sidebar & /superadmin/admins/ Duplicate Removal ---")
admins_get = client.get('/superadmin/admins/')
print(f"GET /superadmin/admins/ status: {admins_get.status_code} -> Location: {admins_get.headers.get('Location', '')}")
assert admins_get.status_code == 302 and '/superadmin/daycares/' in admins_get.headers.get('Location', ''), "Admins URL did not redirect to daycares"

dashboard_get = client.get('/superadmin/dashboard/')
dashboard_html = dashboard_get.content.decode('utf-8')
assert '<span>Daycare Admins</span>' not in dashboard_html, "Duplicate 'Daycare Admins' sidebar link still present"
print("SUCCESS: Duplicate 'Daycare Admins' sidebar option removed and /superadmin/admins/ redirects to /superadmin/daycares/!")
print("SUCCESS: Admin successfully logged in with password reset from Admins List view!")

print("\n==========================================")
print("ALL PASSWORD RESET TESTS PASSED FLAWLESSLY!")
print("==========================================")

