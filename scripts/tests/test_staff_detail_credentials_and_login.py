import os
import sys
import django

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')

django.setup()

from django.conf import settings
settings.MIDDLEWARE = [m for m in settings.MIDDLEWARE if 'whitenoise' not in m.lower()]

from django.test import Client
from core.models import User, Daycare, Employee, ECECredential, CredentialType

def run_tests():
    print("=== Testing Staff Details, Certificates & Login Management ===")
    
    # 1. Daycare Admin user
    admin_user = User.objects.filter(username='daycaremanager').first()
    if not admin_user:
        admin_user = User.objects.filter(role='DaycareAdmin').first()
    assert admin_user is not None, "Daycare admin user must exist"
    dc = admin_user.daycare
    
    sarah = Employee.objects.filter(daycare=dc, first_name='Sarah').first()
    assert sarah is not None, "Sarah Jenkins employee must exist"
    print(f"Testing for Staff: {sarah.first_name} {sarah.last_name} ({sarah.id})")

    client = Client()
    client.force_login(admin_user)

    url = f"/daycare/employees/{sarah.id}/"

    # 2. Test GET staff profile
    resp = client.get(url)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    content = resp.content.decode('utf-8')
    assert "Sarah Jenkins" in content, "Employee name missing"
    assert "Staff Portal Login Credentials" in content, "Staff Portal Login card missing"
    assert "ECE Credentials & Compliance" in content, "ECE Credentials section missing"
    assert "Active Account" in content, "Active account badge missing"
    assert "Add Certificate" in content, "Add Certificate button missing"
    print("-> GET Staff Profile & Login Credentials Card: PASS")

    # 3. Test POST add_credential
    ct = CredentialType.objects.filter(name__icontains='Food Handler').first() or CredentialType.objects.first()
    post_data = {
        'action': 'add_credential',
        'credential_type_id': str(ct.id),
        'certificate_number': 'TEST-CERT-888',
        'issuing_organization': 'City Health Dept',
        'issue_date': '2025-01-10',
        'expiry_date': '2028-01-10',
        'document_status': 'verified',
    }
    resp = client.post(url, post_data)
    assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}"
    
    created_cred = ECECredential.objects.filter(employee=sarah, certificate_number='TEST-CERT-888').first()
    assert created_cred is not None, "Credential should be saved in DB"
    print("-> POST Add Certificate: PASS")
    created_cred.delete() # Cleanup test cred

    # 4. Test POST update_info
    post_data = {
        'action': 'update_info',
        'first_name': 'Sarah',
        'last_name': 'Jenkins',
        'role': 'Lead RECE Educator',
        'job_title': 'Lead RECE Educator',
        'email': 's.jenkins@sunnydays.example.com',
        'phone': '(416) 555-7711',
        'employment_type': 'Full-Time',
        'hire_date': '2024-11-01',
    }
    resp = client.post(url, post_data)
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}"
    sarah.refresh_from_db()
    assert sarah.phone == '(416) 555-7711', "Phone should be updated"
    assert str(sarah.start_date) == '2024-11-01', "Hire date should be updated"
    print("-> POST Update Staff Information: PASS")

    # 5. Test POST reset_password as Daycare Admin
    post_data = {
        'action': 'reset_password',
        'new_password': 'TestStaffPass2026!',
    }
    resp = client.post(url, post_data)
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}"
    sarah.refresh_from_db()
    assert sarah.user is not None, "Staff user must be linked"
    assert sarah.user.check_password('TestStaffPass2026!'), "Password must match new reset password"
    print("-> POST Reset Staff Password: PASS")

    # 6. Verify staff login with new password
    staff_client = Client()
    login_resp = staff_client.post('/login/', {
        'username': sarah.user.username,
        'password': 'TestStaffPass2026!'
    })
    assert login_resp.status_code == 302, f"Staff login expected 302 redirect, got {login_resp.status_code}"
    print("-> Staff Authentication with Reset Password: PASS")

    # Restore standard password 'Staff2026!'
    sarah.user.set_password('Staff2026!')
    sarah.user.save()

    print("\nALL STAFF CERTIFICATES, INFO & LOGIN TESTS PASSED 100%!")

if __name__ == '__main__':
    run_tests()
