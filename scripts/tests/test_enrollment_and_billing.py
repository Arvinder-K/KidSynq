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
from core.models import Daycare, Student, Classroom, Family, Guardian, Invoice, Payment

User = get_user_model()

def test_workflow():
    print("=" * 70)
    print("  RUNNING ENROLLMENT & BILLING COMPREHENSIVE VERIFICATION")
    print("=" * 70)

    # 1. Authenticate as daycare admin
    daycare = Daycare.objects.filter(name__icontains="Sunny Days").first()
    if not daycare:
        daycare = Daycare.objects.first()
    print(f"Target Daycare: {daycare.name} ({daycare.id})")

    user = User.objects.filter(daycare=daycare, is_staff=True).first()
    if not user:
        user = User.objects.filter(is_superuser=True).first()
    print(f"Test User: {user.username} (Superuser: {user.is_superuser})")

    client = Client()
    client.force_login(user)

    # 2. Test GET Enroll Form
    resp = client.get('/daycare/children/new/')
    assert resp.status_code == 200, f"Enroll form failed with {resp.status_code}"
    html = resp.content.decode('utf-8')
    assert 'attachInvoiceCheck' in html, "Missing attachInvoiceCheck"
    assert 'paymentDetailsFields' in html, "Missing paymentDetailsFields"
    assert 'payNowRadio' in html, "Missing payNowRadio"
    print("  [PASS] GET /daycare/children/new/ returns 200 with Invoice & Payment options")

    # 3. Test POST Enroll Child with Attached Invoice and Payment Now
    classroom = Classroom.objects.filter(daycare=daycare).first()
    enroll_data = {
        'first_name': 'Lucas',
        'last_name': 'Vance',
        'preferred_name': 'Luke',
        'date_of_birth': '2024-05-10',
        'gender': 'Male',
        'classroom_id': str(classroom.id) if classroom else '',
        'enrollment_date': '2026-11-21',
        'guardian_first_name': 'Amanda',
        'guardian_last_name': 'Vance',
        'guardian_relationship': 'Mother',
        'guardian_phone': '(416) 555-9090',
        'guardian_email': 'amanda.vance@example.com',
        'guardian_address': '456 King St W, Toronto, ON',
        'medical_info': 'Mild pollen sensitivity',
        'dietary_restrictions': 'Nut-free',
        'attach_invoice': 'true',
        'invoice_description': 'Toddler Monthly Program Tuition',
        'amount': '1150.00',
        'apply_cwelcc': 'true',
        'due_date': '2026-12-05',
        'payment_action': 'pay_now',
        'paid_amount': '543.38',
        'payment_method': 'ETRANSFER',
        'payment_date': '2026-11-21',
        'transaction_reference': 'TEST-INTERAC-9876',
        'payer_name': 'Amanda Vance',
    }

    resp = client.post('/daycare/children/new/', data=enroll_data, follow=False)
    print(f"POST /daycare/children/new/ status: {resp.status_code}")
    assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}"

    # Verify created records
    child = Student.objects.filter(first_name='Lucas', last_name='Vance', daycare=daycare).first()
    assert child is not None, "Student Lucas Vance was not created!"
    print(f"  [PASS] Created Student: {child.first_name} {child.last_name} ({child.id})")

    invoice = Invoice.objects.filter(student=child).first()
    assert invoice is not None, "Invoice was not attached to child!"
    print(f"  [PASS] Attached Invoice: {invoice.invoice_number} | Amount: ${invoice.total_amount}")
    assert abs(float(invoice.total_amount) - 543.38) < 0.05, f"Incorrect invoice total: {invoice.total_amount}"

    payment = Payment.objects.filter(student=child).first()
    assert payment is not None, "Payment was not recorded!"
    print(f"  [PASS] Recorded Payment Receipt: {payment.receipt_number} | Paid: ${payment.amount} | Payer: {payment.payer_name}")

    # 4. Test GET Child Detail across all 9 tabs
    tabs = ['overview', 'classroom', 'family', 'billing', 'reports', 'health', 'attendance', 'consents', 'personal']
    for tab in tabs:
        resp = client.get(f'/daycare/children/{child.id}/?tab={tab}')
        assert resp.status_code == 200, f"Tab {tab} returned {resp.status_code}"
    print(f"  [PASS] All 9 child profile tabs loaded with HTTP 200 OK")

    # 5. Test Profile Modal Actions: create_invoice and record_payment
    # Action 1: Create another invoice
    inv_post_data = {
        'action': 'create_invoice',
        'tab': 'billing',
        'invoice_description': 'Winter Camp Supply Fee',
        'amount': '150.00',
        'apply_cwelcc': 'false',
        'due_date': '2026-12-15',
    }
    resp = client.post(f'/daycare/children/{child.id}/', data=inv_post_data)
    assert resp.status_code == 302, f"create_invoice failed with {resp.status_code}"
    new_inv = Invoice.objects.filter(student=child, notes__icontains='Winter Camp').first()
    assert new_inv is not None, "New invoice from detail modal not created!"
    print(f"  [PASS] Attached New Invoice from Profile Modal: {new_inv.invoice_number} (${new_inv.total_amount})")

    # Action 2: Record Payment against the new invoice
    pay_post_data = {
        'action': 'record_payment',
        'tab': 'billing',
        'invoice_id': str(new_inv.id),
        'amount': '150.00',
        'payment_method': 'CREDIT_CARD',
        'transaction_reference': 'CC-AUTH-7711',
        'payer_name': 'Amanda Vance',
    }
    resp = client.post(f'/daycare/children/{child.id}/', data=pay_post_data)
    assert resp.status_code == 302, f"record_payment failed with {resp.status_code}"
    new_pay = Payment.objects.filter(invoice=new_inv).first()
    assert new_pay is not None, "New payment from detail modal not recorded!"
    print(f"  [PASS] Recorded Payment from Profile Modal: {new_pay.receipt_number} (${new_pay.amount})")

    print("=" * 70)
    print("  ALL TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == '__main__':
    test_workflow()
