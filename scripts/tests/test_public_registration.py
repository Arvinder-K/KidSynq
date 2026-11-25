import os
import sys

APP_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)
apps_dir = os.path.join(APP_DIR, 'apps')
if apps_dir not in sys.path:
    sys.path.insert(0, apps_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')

import django
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from core.models import Daycare, RegistrationApplication

User = get_user_model()

def test_public_registration():
    print("=" * 70)
    print("  TESTING PUBLIC PARENT REGISTRATION PORTAL")
    print("=" * 70)

    dc_id = 'c50bd516-e5be-426b-a31a-e3666c30ebfc'
    daycare = Daycare.objects.filter(id=dc_id).first()
    assert daycare is not None, f"Daycare {dc_id} not found!"
    print(f"Target Daycare: {daycare.name} ({daycare.id})")

    # 1. Test unauthenticated parent visiting landing page
    anon_client = Client()
    resp = anon_client.get(f'/register/{dc_id}/')
    assert resp.status_code == 200, f"Landing page returned {resp.status_code}"
    html = resp.content.decode('utf-8')
    assert 'Welcome to' in html, "Missing welcome header"
    assert daycare.name in html, f"Missing daycare name {daycare.name}"
    assert 'Begin Registration Application' in html, "Missing apply CTA button"
    assert len(html) > 3000, f"HTML too short: {len(html)} bytes"
    print(f"  [PASS] GET /register/{dc_id}/ renders full landing page ({len(html)} bytes)")

    # 2. Test unauthenticated parent visiting wizard page
    resp = anon_client.get(f'/register/{dc_id}/apply/')
    assert resp.status_code == 200, f"Wizard page returned {resp.status_code}"
    html = resp.content.decode('utf-8')
    assert "Child's First Name" in html, "Missing Child's First Name field"
    assert "Parent First Name" in html, "Missing Parent First Name field"
    assert len(html) > 3000, f"Wizard HTML too short: {len(html)} bytes"
    print(f"  [PASS] GET /register/{dc_id}/apply/ renders full application wizard form")

    # 3. Test submitting application
    form_data = {
        'child_first_name': 'Emma',
        'child_last_name': 'Watson',
        'date_of_birth': '2024-03-15',
        'gender': 'female',
        'guardian_first_name': 'Jacqueline',
        'guardian_last_name': 'Luesby',
        'guardian_relationship': 'Mother',
        'guardian_phone': '(416) 555-4321',
        'guardian_email': 'jacqueline.luesby@example.com',
        'guardian_address': '88 University Ave, Toronto, ON',
        'medical_notes': 'Mild dairy intolerance',
        'dietary_restrictions': 'No milk, plant-based milk only',
        'emergency_contact_name': 'Chris Watson',
        'emergency_contact_phone': '(416) 555-8765',
    }
    resp = anon_client.post(f'/register/{dc_id}/apply/', data=form_data)
    assert resp.status_code == 200, f"Expected 200 success page, got {resp.status_code}"
    html = resp.content.decode('utf-8')
    assert 'Application Successfully Submitted!' in html, "Missing success confirmation"
    assert 'APP-' in html, "Missing application reference number"

    # Verify created record in DB
    app = RegistrationApplication.objects.filter(
        daycare=daycare,
        applicant_email='jacqueline.luesby@example.com'
    ).first()
    assert app is not None, "RegistrationApplication was not found in DB!"
    print(f"  [PASS] RegistrationApplication created: {app.application_number} [ID: {app.id}]")
    assert app.child_first_name == 'Emma', f"Expected Emma, got {app.child_first_name}"
    assert app.child_last_name == 'Watson', f"Expected Watson, got {app.child_last_name}"
    assert app.child_name == 'Emma Watson', f"Expected Emma Watson, got {app.child_name}"
    assert app.parent_first_name == 'Jacqueline', f"Expected Jacqueline, got {app.parent_first_name}"
    print(f"  [PASS] Application property resolution verified: Child={app.child_name}, Parent={app.parent_first_name}")

    # 4. Verify daycare admissions list view
    staff_user = User.objects.filter(daycare=daycare, is_staff=True).first() or User.objects.filter(is_superuser=True).first()
    auth_client = Client()
    auth_client.force_login(staff_user)

    resp = auth_client.get('/daycare/admissions/')
    assert resp.status_code == 200, f"Admissions view returned {resp.status_code}"
    html = resp.content.decode('utf-8')
    assert 'Emma Watson' in html, "New application Emma Watson not listed in daycare admissions!"
    print(f"  [PASS] Daycare staff can view Emma Watson's application in /daycare/admissions/")

    print("=" * 70)
    print("  ALL REGISTRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == '__main__':
    test_public_registration()
