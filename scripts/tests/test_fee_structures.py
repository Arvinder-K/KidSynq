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
from core.models import Daycare, FeeStructure

User = get_user_model()

def test_fee_structures():
    print("=" * 70)
    print("  TESTING FEE STRUCTURES CRUD (ADD, EDIT, DELETE)")
    print("=" * 70)

    daycare = Daycare.objects.filter(name__icontains="Sunny Days").first() or Daycare.objects.first()
    print(f"Target Daycare: {daycare.name} ({daycare.id})")

    user = User.objects.filter(daycare=daycare, is_staff=True).first() or User.objects.filter(is_superuser=True).first()
    print(f"Test User: {user.username}")

    client = Client()
    client.force_login(user)

    # 1. Test GET /daycare/billing/fee-structures/
    resp = client.get('/daycare/billing/fee-structures/')
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    html = resp.content.decode('utf-8')
    assert 'Add Fee Structure' in html, "Missing 'Add Fee Structure' in HTML"
    assert 'addFeeModal' in html, "Missing addFeeModal"
    print("  [PASS] GET /daycare/billing/fee-structures/ returned 200 with Add button & modal")

    # 2. Test POST Add Fee Structure
    post_data = {
        'action': 'create',
        'name': 'After School Care Extended',
        'amount': '450.00',
        'fee_type': 'MONTHLY',
        'frequency': 'MONTHLY',
        'applies_to': 'ALL',
        'effective_from': '2026-11-21',
        'description': 'Daily 3:30pm to 6:00pm after school enrichment',
        'is_active': 'true',
    }
    resp = client.post('/daycare/billing/fee-structures/', data=post_data, follow=False)
    assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}"

    new_fee = FeeStructure.objects.filter(daycare=daycare, name='After School Care Extended').first()
    assert new_fee is not None, "New FeeStructure was not created in DB!"
    assert float(new_fee.amount) == 450.00, f"Expected 450.00, got {new_fee.amount}"
    print(f"  [PASS] Added Fee Structure: '{new_fee.name}' (${new_fee.amount}) [ID: {new_fee.id}]")

    # 3. Test POST Edit Fee Structure
    edit_data = {
        'action': 'edit',
        'fee_id': str(new_fee.id),
        'name': 'After School Care Extended Plus',
        'amount': '495.50',
        'fee_type': 'MONTHLY',
        'frequency': 'MONTHLY',
        'applies_to': 'ALL',
        'effective_from': '2026-11-21',
        'description': 'Updated description with late snack included',
        'is_active': 'true',
    }
    resp = client.post('/daycare/billing/fee-structures/', data=edit_data, follow=False)
    assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}"

    new_fee.refresh_from_db()
    assert new_fee.name == 'After School Care Extended Plus', "Name did not update"
    assert float(new_fee.amount) == 495.50, f"Expected 495.50, got {new_fee.amount}"
    print(f"  [PASS] Edited Fee Structure: '{new_fee.name}' (${new_fee.amount})")

    # 4. Test POST Delete Fee Structure
    del_data = {
        'action': 'delete',
        'fee_id': str(new_fee.id),
    }
    resp = client.post('/daycare/billing/fee-structures/', data=del_data, follow=False)
    assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}"

    deleted_fee = FeeStructure.objects.filter(id=new_fee.id).first()
    assert deleted_fee is None, "Fee was not deleted from DB!"
    print(f"  [PASS] Deleted Fee Structure successfully!")

    # 5. Verify page renders cleanly again
    resp = client.get('/daycare/billing/fee-structures/')
    assert resp.status_code == 200
    print("  [PASS] Verified page renders cleanly after deletions")

    print("=" * 70)
    print("  ALL FEE STRUCTURE TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == '__main__':
    test_fee_structures()
