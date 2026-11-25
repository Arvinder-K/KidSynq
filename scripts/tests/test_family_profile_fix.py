import os
import sys
import django

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')

django.setup()

from django.conf import settings
# Filter out whitenoise if needed for local test run
settings.MIDDLEWARE = [m for m in settings.MIDDLEWARE if 'whitenoise' not in m.lower()]

from django.urls import reverse
from django.test import Client
from core.models import User, Family, Guardian, Student, StudentPickup

def run_tests():
    print("=== Testing Family Profile & URL Routing Fix ===")

    # 1. Verify URL reversals
    profile_page_url = reverse('family_profile_page')
    guardians_page_url = reverse('family_guardians_page')
    api_profile_url = reverse('family_profile')
    api_guardians_url = reverse('family_guardians')

    print(f"reverse('family_profile_page'): {profile_page_url}")
    print(f"reverse('family_guardians_page'): {guardians_page_url}")
    print(f"reverse('family_profile'): {api_profile_url}")
    print(f"reverse('family_guardians'): {api_guardians_url}")

    assert profile_page_url == '/family/profile/', f"Expected '/family/profile/', got '{profile_page_url}'"
    assert guardians_page_url == '/family/guardians/', f"Expected '/family/guardians/', got '{guardians_page_url}'"
    assert api_profile_url == '/api/family/profile/', f"Expected '/api/family/profile/', got '{api_profile_url}'"
    assert api_guardians_url == '/api/family/guardians/', f"Expected '/api/family/guardians/', got '{api_guardians_url}'"
    print("-> URL Reversals: PASS")

    # 2. Get a guardian user
    user = User.objects.filter(guardian_profile__isnull=False, email__startswith='robert.davis').first()
    if not user:
        user = User.objects.filter(guardian_profile__isnull=False).first()
    assert user is not None, "Guardian user must exist"
    print(f"Using Guardian User: {user.email}")

    client = Client()
    client.force_login(user)

    # 3. Test GET /family/profile/ (HTML Page)
    resp = client.get(profile_page_url)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    content = resp.content.decode('utf-8')
    assert "Family & Account Profile" in content, "HTML page must contain Family & Account Profile title"
    assert "Household & Contact Information" in content, "HTML page must contain Household card"
    assert "Security & Portal Password" in content, "HTML page must contain Password card"
    print("-> GET /family/profile/ (MTV HTML Page): PASS")

    # 4. Test GET /family/guardians/ (HTML Page)
    resp = client.get(guardians_page_url)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    content = resp.content.decode('utf-8')
    assert "Authorized Guardians & Pickups" in content, "HTML page must contain Guardians title"
    print("-> GET /family/guardians/ (MTV HTML Page): PASS")

    # 5. Test GET /api/family/profile/ with Accept: text/html (Browser simulation) -> should redirect to /family/profile/
    resp = client.get(api_profile_url, HTTP_ACCEPT="text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
    assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}"
    assert resp.url == '/family/profile/', f"Expected redirect to /family/profile/, got {resp.url}"
    print("-> GET /api/family/profile/ with Accept: text/html -> Redirects to /family/profile/: PASS")

    # 6. Test GET /api/family/guardians/ with Accept: text/html -> should redirect to /family/guardians/
    resp = client.get(api_guardians_url, HTTP_ACCEPT="text/html,application/xhtml+xml")
    assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}"
    assert resp.url == '/family/guardians/', f"Expected redirect to /family/guardians/, got {resp.url}"
    print("-> GET /api/family/guardians/ with Accept: text/html -> Redirects to /family/guardians/: PASS")

    # 7. Test GET /api/family/profile/ with Accept: application/json -> returns JSON 200 OK
    resp = client.get(api_profile_url, HTTP_ACCEPT="application/json")
    assert resp.status_code == 200, f"Expected 200 JSON, got {resp.status_code}"
    json_data = resp.json()
    assert "family_name" in json_data, f"JSON response must contain family_name: {json_data}"
    print(f"-> GET /api/family/profile/ with Accept: application/json: PASS ({json_data.get('family_name')})")

    # 8. Test POST /family/profile/ update profile
    post_data = {
        'action': 'update_profile',
        'first_name': user.first_name,
        'last_name': user.last_name,
        'family_name': 'Davis Family',
        'phone': '(416) 555-7788',
        'address': '742 Evergreen Terrace, Toronto, ON'
    }
    resp = client.post(profile_page_url, post_data)
    assert resp.status_code == 302, f"Expected 302 redirect after POST, got {resp.status_code}"
    print("-> POST /family/profile/ update_profile: PASS")

    # 9. Test POST /family/guardians/ add authorized pickup
    pickup_data = {
        'action': 'add_pickup',
        'name': 'Grandma Davis Test',
        'relationship': 'Grandmother',
        'phone': '(416) 555-9999',
        'email': 'grandma@example.com',
        'notes': 'Test emergency contact'
    }
    resp = client.post(guardians_page_url, pickup_data)
    assert resp.status_code == 302, f"Expected 302 redirect after POST, got {resp.status_code}"
    created_pickup = StudentPickup.objects.filter(name='Grandma Davis Test').first()
    assert created_pickup is not None, "StudentPickup should have been created in database"
    print(f"-> POST /family/guardians/ add_pickup: PASS (Created pickup ID: {created_pickup.id})")
    created_pickup.delete() # Clean up

    print("\nALL FAMILY PROFILE & ROUTING TESTS PASSED 100%!")

if __name__ == '__main__':
    run_tests()
