"""
Automated end-to-end verification test for the KidSynq Operations Copilot / CheckOnIt-style Chat UI.
Tests both GET view rendering and POST operational intelligence queries.
"""
import os
import sys
import json
import django

# Add workspace and apps directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.test import RequestFactory, Client
from django.contrib.auth import get_user_model
from core.models import Daycare, Student, Classroom, Employee

User = get_user_model()

def run_tests():
    print("=" * 60)
    print("RUNNING CHAT ASSISTANT END-TO-END VERIFICATION TESTS")
    print("=" * 60)

    # 1. Prepare user and daycare
    # Find DaycareAdmin or Staff user
    user = User.objects.filter(username='daycaremanager').first()
    if not user:
        for u in User.objects.all():
            if getattr(u, 'role', '') in ['DaycareAdmin', 'Staff', 'SuperAdmin']:
                user = u
                break
    if not user:
        user = User.objects.filter(is_superuser=True).first()
    daycare = user.daycare or Daycare.objects.first()
    print(f"[OK] Using Daycare: {daycare.name} (id: {daycare.id})")
    print(f"[OK] Test User: {user.username} (role: {getattr(user, 'role', 'Admin')})")

    client = Client()
    client.force_login(user)

    # 2. Test GET /daycare/chat/
    print("\n[TEST 1] GET /daycare/chat/")
    resp = client.get('/daycare/chat/')
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    content = resp.content.decode('utf-8')

    # Verify visual and structural components
    assert 'class="ambient-page"' in content, "Missing .ambient-page background"
    assert 'class="ambient-orb orb-a"' in content, "Missing orb-a"
    assert 'class="ambient-orb orb-b"' in content, "Missing orb-b"
    assert 'class="ambient-orb orb-c"' in content, "Missing orb-c"
    assert 'class="ambient-orb orb-d"' in content, "Missing orb-d"
    assert 'class="glass-frame"' in content, "Missing .glass-frame"
    assert 'class="glass-panel"' in content, "Missing .glass-panel"
    assert 'class="brand-dot"' in content, "Missing .brand-dot glow"
    assert 'Who would you like to check?' in content, "Missing gate header text"
    assert 'id="composerTextarea"' in content, "Missing composer textarea"
    assert 'id="topicsButton"' in content, "Missing help topics button"
    print("  [PASS] GET /daycare/chat/ rendered 200 with all glassmorphism & orb components.")

    # 3. Test GET top-level alias /chat/
    print("\n[TEST 2] GET /chat/ alias")
    alias_resp = client.get('/chat/')
    assert alias_resp.status_code == 200, f"Expected 200, got {alias_resp.status_code}"
    print("  [PASS] Top-level /chat/ accessible and returned 200.")

    # 4. Find a test student
    student = Student.objects.filter(daycare=daycare).first()
    st_name = f"{student.first_name} {student.last_name}" if student else "Noah Davis"
    print(f"\n[TEST 3] POST /daycare/chat/ Query Student: '{st_name}'")

    queries = [
        ("Today's Attendance", f"What is the attendance status for {st_name} today?"),
        ("Emergency Contacts", f"Who are the authorized emergency contacts and pickups for {st_name}?"),
        ("Classroom & Ratio", f"Which room is {st_name} assigned to and what is the educator ratio?"),
        ("Tuition & Billing", f"Does {st_name} have any outstanding tuition balance or invoices?"),
        ("Allergies & Health", f"Show all allergy alerts and dietary restrictions for {st_name}."),
        ("Center Overview", "How many children are enrolled and present in the center today?"),
    ]

    for label, q_text in queries:
        post_resp = client.post(
            '/daycare/chat/',
            data=json.dumps({
                'message': q_text,
                'entity': st_name,
                'conversationId': 'test-conv-1'
            }),
            content_type='application/json'
        )
        assert post_resp.status_code == 200, f"Query '{label}' failed with status {post_resp.status_code}"
        res_data = post_resp.json()
        assert res_data.get('status') == 'success', f"Query '{label}' status was not success: {res_data}"
        assert 'answer' in res_data and len(res_data['answer']) > 10, f"Empty answer for '{label}'"
        print(f"  [PASS] {label}: Received {len(res_data['answer'])} chars answer. Snippet: {res_data['answer'][:70]}...")

    # Test Center-wide query without child entity
    print("\n[TEST 4] POST /daycare/chat/ Center-wide Intelligence Query")
    center_resp = client.post(
        '/daycare/chat/',
        data=json.dumps({
            'message': 'Give me a live overview of center operations today',
            'entity': '',
            'conversationId': 'test-conv-2'
        }),
        content_type='application/json'
    )
    assert center_resp.status_code == 200
    center_data = center_resp.json()
    assert center_data.get('status') == 'success'
    print(f"  [PASS] Center Overview: Received {len(center_data['answer'])} chars answer:\n{center_data['answer']}")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED.")
    print("=" * 60)

if __name__ == '__main__':
    run_tests()
