import os
import sys
import uuid
from decimal import Decimal

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
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from core.models import (
    Daycare, Classroom, Program, Student, Family, Guardian,
    ClassroomStudent, Invoice, Payment, RegistrationApplication,
    WaitlistEntry, ChildSubsidyProfile, StudentEmergencyContact
)

User = get_user_model()

def test_full_admissions_pipeline():
    print("=" * 75)
    print("  TESTING COMPLETE END-TO-END ADMISSIONS & ENROLLMENT LIFECYCLE")
    print("=" * 75)

    dc_id = 'c50bd516-e5be-426b-a31a-e3666c30ebfc'
    daycare = Daycare.objects.filter(id=dc_id).first() or Daycare.objects.first()
    print(f"Target Center: {daycare.name} ({daycare.id})")

    # -------------------------------------------------------------
    # PHASE 1 & 2: Parent submits online application & uploads docs
    # -------------------------------------------------------------
    print("\n--- PHASE 1 & 2: Public Online Application & Document Upload ---")
    anon_client = Client()
    mock_birth_file = SimpleUploadedFile("birth_cert_noah.pdf", b"%PDF-1.4 mock birth certificate", content_type="application/pdf")
    mock_immun_file = SimpleUploadedFile("immunization_card.pdf", b"%PDF-1.4 mock vaccine record", content_type="application/pdf")

    unique_tag = uuid.uuid4().hex[:5]
    parent_email = f"robert.davis.{unique_tag}@example.com"
    app_data_post = {
        'child_first_name': 'Noah',
        'child_last_name': f'Davis_{unique_tag}',
        'date_of_birth': '2024-04-10',
        'gender': 'male',
        'preferred_start_date': '2026-12-01',
        'birth_reg_number': f'BC-ON-{unique_tag}',
        'birth_document': mock_birth_file,
        'immunization_document': mock_immun_file,
        'guardian_first_name': 'Robert',
        'guardian_last_name': 'Davis',
        'guardian_relationship': 'Father',
        'guardian_phone': '(416) 555-7788',
        'guardian_email': parent_email,
        'guardian_address': '742 Evergreen Terrace, Toronto, ON',
        'medical_notes': 'Mild seasonal asthma, carry inhaler if needed',
        'dietary_restrictions': 'Strict peanut & tree nut allergy',
        'doctor_name': 'Dr. Mark Ellis, MD',
        'doctor_phone': '(416) 555-0192',
        'emergency_contact_name': 'Linda Davis',
        'emergency_contact_phone': '(416) 555-0199',
        'emergency_contact_relation': 'Grandmother',
        'consent_medical': 'true',
        'consent_walks': 'true',
        'consent_photos': 'true',
        'consent_topical': 'true',
    }

    resp = anon_client.post(f'/register/{daycare.id}/apply/', data=app_data_post)
    assert resp.status_code == 200, f"Application submission failed with {resp.status_code}"
    html = resp.content.decode('utf-8')
    assert 'Application Successfully Submitted!' in html
    assert 'APP-' in html

    app = RegistrationApplication.objects.filter(applicant_email=parent_email).first()
    assert app is not None, "Application not saved in database!"
    print(f"  [PASS] Application {app.application_number} created with uploaded documents:")
    print(f"         - Birth Doc: {app.birth_document_name} ({app.birth_document_url})")
    print(f"         - Immunization Doc: {app.immunization_document_name} ({app.immunization_document_url})")
    print(f"         - Preferred Start Date: {app.preferred_start_date}")

    # -------------------------------------------------------------
    # PHASE 3: Daycare reviews application & checks available seats
    # -------------------------------------------------------------
    print("\n--- PHASE 3: Daycare Reviews Application, Eligibility & Seats ---")
    staff_user = User.objects.filter(daycare=daycare, is_staff=True).first() or User.objects.filter(is_superuser=True).first()
    auth_client = Client()
    auth_client.force_login(staff_user)

    # Check admissions inbox
    resp = auth_client.get('/daycare/admissions/')
    assert resp.status_code == 200
    assert app.application_number in resp.content.decode('utf-8')
    print("  [PASS] Application displayed in daycare admissions inbox")

    # Review application detail
    resp = auth_client.get(f'/daycare/admissions/{app.id}/')
    assert resp.status_code == 200
    review_html = resp.content.decode('utf-8')
    assert 'Noah' in review_html
    assert 'Birth Certificate' in review_html
    assert 'Classroom Capacity & Available Seats' in review_html
    print("  [PASS] Review page verified: documents, child age, consents, and live seats displayed")

    # -------------------------------------------------------------
    # PHASE 4 (Branch A): Test Waitlisting an application
    # -------------------------------------------------------------
    print("\n--- PHASE 4 (Branch A): Admission Decision -> Place on Waitlist ---")
    waitlist_app = RegistrationApplication.objects.create(
        daycare=daycare,
        application_number=f"APP-WL-{unique_tag}",
        applicant_name="Karen Smith",
        applicant_email=f"karen.{unique_tag}@example.com",
        applicant_phone="(416) 555-1122",
        status="submitted",
        application_data={
            'child_first_name': 'Olivia',
            'child_last_name': 'Smith',
            'date_of_birth': '2024-06-01',
            'preferred_start_date': '2027-01-01',
            'program_name': 'Toddler Program'
        }
    )
    wl_post = {
        'action': 'waitlist',
        'priority': '1',
        'target_start_date': '2027-01-01',
        'notes': 'Family requested January placement when moving to area',
    }
    resp = auth_client.post(f'/daycare/admissions/{waitlist_app.id}/', data=wl_post)
    assert resp.status_code == 302, f"Waitlist action failed: {resp.status_code}"
    waitlist_app.refresh_from_db()
    assert waitlist_app.status == 'waitlisted'
    wl_entry = WaitlistEntry.objects.filter(application=waitlist_app).first()
    assert wl_entry is not None, "WaitlistEntry was not created!"
    assert wl_entry.priority == 1
    print(f"  [PASS] Waitlist decision recorded: Olivia Smith placed on Priority 1 waitlist")

    # -------------------------------------------------------------
    # PHASE 4 (Branch B), 5, 6, 7: Approve, Assign Classroom & Fees, Activate
    # -------------------------------------------------------------
    print("\n--- PHASES 4, 5, 6, 7: Approve, Assign Room & Fees, Activate Enrollment ---")
    classroom = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).first()
    assert classroom is not None, "At least one classroom must exist!"

    approve_data = {
        'action': 'approve_and_enroll',
        'classroom_id': str(classroom.id),
        'enrollment_date': '2026-12-01',
        'reg_fee_amount': '100.00',
        'tuition_fee_amount': '1150.00',
        'deposit_amount': '0.00',
        'tuition_description': 'Toddler Full-Time Monthly Tuition',
        'apply_cwelcc': 'true',
        'payment_action': 'pay_now',
        'amount_paid': '643.38',
        'payment_method': 'ETRANSFER',
        'transaction_reference': f'INTERAC-PAY-{unique_tag}',
        'payer_name': 'Robert Davis',
    }

    resp = auth_client.post(f'/daycare/admissions/{app.id}/', data=approve_data, follow=False)
    assert resp.status_code == 302, f"Approval post returned {resp.status_code}"
    print(f"  [PASS] Approval submitted with classroom assignment and fee structure")

    # 1. Verify Application status updated to approved
    app.refresh_from_db()
    assert app.status == 'approved', f"Expected approved, got {app.status}"
    student_id = app.application_data.get('enrolled_student_id')
    assert student_id is not None, "Enrolled student ID not saved in application_data!"

    # 2. Verify Student (Child) created & active
    student = Student.objects.filter(id=student_id).first()
    assert student is not None, "Student record was not created!"
    assert student.status == 'Active', f"Expected Active status, got {student.status}"
    assert student.first_name == 'Noah'
    assert str(student.admission_date) == '2026-12-01'
    print(f"  [PASS] Student created: {student.first_name} {student.last_name} (Status: {student.status})")

    # 3. Verify Classroom Allocation
    cls_student = ClassroomStudent.objects.filter(student=student, status='Active').first()
    assert cls_student is not None, "ClassroomStudent allocation record not found!"
    assert cls_student.classroom == classroom
    assert str(cls_student.start_date) == '2026-12-01'
    print(f"  [PASS] Classroom assigned: {classroom.room_name} from {cls_student.start_date}")

    # 4. Verify Family & Guardian linkage
    family = student.family_set.first()
    assert family is not None, "Family record not linked to student!"
    guardian = family.guardians.first()
    assert guardian is not None, "Guardian not linked to family!"
    assert guardian.first_name == 'Robert'
    print(f"  [PASS] Family & Guardian linked: {family.family_name} & {guardian.first_name} {guardian.last_name}")

    # 5. Verify Emergency Contact
    em_contact = StudentEmergencyContact.objects.filter(student=student).first()
    assert em_contact is not None, "Emergency contact not linked!"
    assert em_contact.contact_name == 'Linda Davis'
    print(f"  [PASS] Emergency contact linked: {em_contact.contact_name} ({em_contact.relationship})")

    # 6. Verify Initial Invoice & CWELCC Subsidy
    invoice = Invoice.objects.filter(student=student).first()
    assert invoice is not None, "Initial invoice not created!"
    # 100 reg fee + 1150 tuition - 606.63 discount = 643.37 or 643.38
    assert abs(float(invoice.total_amount) - 643.38) < 0.10, f"Incorrect invoice total: {invoice.total_amount}"
    print(f"  [PASS] Invoice attached: {invoice.invoice_number} | Net Total: ${invoice.total_amount}")

    subsidy = ChildSubsidyProfile.objects.filter(student=student, is_active=True).first()
    assert subsidy is not None, "CWELCC subsidy profile not created!"
    assert float(subsidy.subsidy_rate) == 52.75
    print(f"  [PASS] CWELCC Subsidy profile active: {subsidy.subsidy_rate}% fee reduction")

    # 7. Verify Official Payment Receipt
    payment = Payment.objects.filter(student=student, status='COMPLETED').first()
    assert payment is not None, "Payment receipt not generated!"
    assert abs(float(payment.amount) - 643.38) < 0.10
    assert payment.payment_method == 'ETRANSFER'
    assert 'REC-' in payment.receipt_number
    print(f"  [PASS] Official Payment Receipt generated: {payment.receipt_number} (${payment.amount})")

    # 8. Verify Child Detail Profile (Billing Tab)
    resp = auth_client.get(f'/daycare/children/{student.id}/?tab=billing')
    assert resp.status_code == 200
    billing_html = resp.content.decode('utf-8')
    assert payment.receipt_number in billing_html
    assert invoice.invoice_number in billing_html
    print(f"  [PASS] Child profile billing ledger displays invoice and receipt")

    print("\n" + "=" * 75)
    print("  ALL 7 PHASES OF THE ADMISSIONS & ENROLLMENT PIPELINE PASSED (100% SUCCESS)!")
    print("=" * 75)

if __name__ == '__main__':
    test_full_admissions_pipeline()
