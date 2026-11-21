import os
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
apps_dir = os.path.join(BASE_DIR, 'apps')
if apps_dir not in sys.path:
    sys.path.insert(0, apps_dir)

import django
from decimal import Decimal
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.utils import timezone
from core.models import (
    Daycare, Student, Classroom, ClassroomStudent, Employee, AgeGroup,
    Family, FamilyChild, FamilyGuardian, Guardian,
    Invoice, InvoiceItem, Payment, ChildSubsidyProfile,
    DailyReport, MealRecord, NapRecord, ToiletingRecord,
    IncidentReport, ConsentForm, ConsentFormAssignment,
    StudentEmergencyContact, StudentPickup, StudentAttendance
)

def seed_laim_miller():
    student_id = '16c6d853-a8dc-4552-a804-b26a32a68929'
    student = Student.objects.filter(pk=student_id).first()
    if not student:
        print(f"Student {student_id} not found!")
        return

    daycare = student.daycare
    print(f"Seeding rich data for {student.first_name} {student.last_name} at {daycare.name}...")

    # 1. Update Student Details
    student.dob = timezone.now().date().replace(year=timezone.now().year - 2, month=6, day=1)
    student.gender = 'male'
    student.admission_number = 'ADM-2026-088'
    student.admission_date = timezone.now().date().replace(month=1, day=15)
    student.joining_date = student.admission_date
    student.status = 'Active'
    student.allergies = 'Peanuts (Mild sensitivity - EpiPen on file)'
    student.dietary_restrictions = 'Nut-free snacks only; standard dairy & whole grain meal program'
    student.medical_conditions = 'Mild seasonal eczema (ointment in cubby)'
    student.doctor_name = 'Dr. Katherine Bell, MD, FRCPC (Pediatrics)'
    student.doctor_phone = '(416) 555-8822'
    student.hospital_name = 'The Hospital for Sick Children (SickKids Toronto)'
    student.save()
    print("  -> Updated student personal and medical information")

    # 2. Staff Educator User & Employee
    from core.models import User
    teacher_user, _ = User.objects.get_or_create(
        username='sarah_jenkins',
        defaults={
            'daycare': daycare,
            'first_name': 'Sarah',
            'last_name': 'Jenkins',
            'email': 's.jenkins@sunnydays.example.com',
            'is_staff': True
        }
    )
    if not teacher_user.daycare:
        teacher_user.daycare = daycare
        teacher_user.save()

    teacher, _ = Employee.objects.get_or_create(
        daycare=daycare,
        first_name='Sarah',
        last_name='Jenkins',
        defaults={
            'role': 'Lead RECE Educator',
            'email': 's.jenkins@sunnydays.example.com',
            'phone': '(416) 555-7711',
            'start_date': timezone.now().date().replace(year=2024, month=3, day=1),
            'status': 'active'
        }
    )

    # 3. Classroom & AgeGroup
    age_group, _ = AgeGroup.objects.get_or_create(
        daycare=daycare,
        name='Toddler',
        defaults={
            'min_age_months': 18,
            'max_age_months': 30,
            'description': 'Toddler Program (18 - 30 months)',
            'status': 'Active'
        }
    )

    classroom = Classroom.objects.filter(daycare=daycare).first()
    if not classroom:
        classroom = Classroom.objects.create(
            daycare=daycare,
            room_name='Toddler Explorer Room',
            room_code='TOD-101',
            capacity=15,
            age_group=age_group,
            primary_teacher=teacher_user
        )
    else:
        classroom.room_name = 'Sunshine Toddlers Room'
        classroom.room_code = 'TOD-101'
        classroom.capacity = 15
        classroom.age_group = age_group
        classroom.primary_teacher = teacher_user
        classroom.save()

    # Active Classroom Enrollment
    enrollment, _ = ClassroomStudent.objects.get_or_create(
        student=student,
        classroom=classroom,
        defaults={
            'status': 'Active',
            'start_date': student.admission_date or timezone.now().date()
        }
    )
    enrollment.status = 'Active'
    enrollment.save()
    print("  -> Classroom allocation verified: " + classroom.room_name)

    # 4. Family & Parents
    family, _ = Family.objects.get_or_create(
        daycare=daycare,
        family_name='Miller Family',
        defaults={
            'address': '742 Evergreen Terrace, Toronto, ON M4B 1B3',
            'primary_email': 'david.miller@example.com',
            'primary_phone': '(416) 555-0142',
            'status': 'Active'
        }
    )
    FamilyChild.objects.get_or_create(family=family, student=student)

    # Father
    g_father, _ = Guardian.objects.get_or_create(
        daycare=daycare,
        first_name='David',
        last_name='Miller',
        defaults={
            'email': 'david.miller@example.com',
            'phone': '(416) 555-0142',
            'status': 'Active'
        }
    )
    fg1, _ = FamilyGuardian.objects.get_or_create(
        family=family,
        guardian=g_father,
        defaults={'relationship': 'Father', 'is_primary': True, 'status': 'Active'}
    )
    fg1.is_primary = True
    fg1.save()

    # Mother
    g_mother, _ = Guardian.objects.get_or_create(
        daycare=daycare,
        first_name='Emily',
        last_name='Miller',
        defaults={
            'email': 'emily.miller@example.com',
            'phone': '(416) 555-0143',
            'status': 'Active'
        }
    )
    FamilyGuardian.objects.get_or_create(
        family=family,
        guardian=g_mother,
        defaults={'relationship': 'Mother', 'is_primary': False, 'status': 'Active'}
    )
    print("  -> Parents David Miller & Emily Miller linked to Miller Family")

    # 5. Emergency Contact & Authorized Pickups
    StudentEmergencyContact.objects.get_or_create(
        student=student,
        name='Robert Miller',
        defaults={
            'relationship': 'Grandfather',
            'phone_number': '(416) 555-0199'
        }
    )
    StudentPickup.objects.get_or_create(
        student=student,
        name='Sarah Miller-Clark',
        defaults={
            'daycare': daycare,
            'family': family,
            'relationship': 'Aunt (Authorized)',
            'phone': '(416) 555-0188',
            'authorization_status': 'APPROVED'
        }
    )

    # 6. CWELCC Subsidy
    subsidy, _ = ChildSubsidyProfile.objects.get_or_create(
        daycare=daycare,
        student=student,
        defaults={
            'family': family,
            'program_name': 'CWELCC (Canada-Wide Early Learning & Child Care)',
            'subsidy_type': 'Government Fee Reduction',
            'subsidy_rate': Decimal('52.75'),
            'government_case_number': 'CWELCC-ON-882914',
            'parent_co_pay_amount': Decimal('543.37'),
            'approved_days_per_week': 5,
            'effective_from': timezone.now().date().replace(month=1, day=1),
            'effective_until': timezone.now().date().replace(month=12, day=31),
            'is_active': True,
            'notes': '52.75% provincial subsidy applied automatically to monthly tuition'
        }
    )

    # 7. Invoices & Payment Receipts
    inv1, _ = Invoice.objects.get_or_create(
        daycare=daycare,
        invoice_number='INV-2026-0042',
        defaults={
            'family': family,
            'student': student,
            'invoice_type': 'STANDARD',
            'issue_date': timezone.now().date().replace(day=1),
            'due_date': timezone.now().date().replace(day=15),
            'billing_period_start': timezone.now().date().replace(day=1),
            'billing_period_end': timezone.now().date().replace(day=28),
            'subtotal': Decimal('1150.00'),
            'discount': Decimal('606.63'),
            'discount_total': Decimal('606.63'),
            'total_amount': Decimal('543.37'),
            'amount_paid': Decimal('543.37'),
            'balance_due': Decimal('0.00'),
            'currency': 'CAD',
            'status': 'PAID',
            'notes': 'November 2026 Toddler Child Care Tuition (CWELCC Subsidized)'
        }
    )
    InvoiceItem.objects.get_or_create(
        invoice=inv1,
        description='Monthly Toddler Care Tuition (Full Rate)',
        defaults={
            'quantity': 1,
            'unit_price': Decimal('1150.00'),
            'subtotal': Decimal('1150.00'),
            'total': Decimal('1150.00')
        }
    )
    InvoiceItem.objects.get_or_create(
        invoice=inv1,
        description='CWELCC 52.75% Provincial Fee Reduction',
        defaults={
            'quantity': 1,
            'unit_price': Decimal('-606.63'),
            'subtotal': Decimal('-606.63'),
            'total': Decimal('-606.63')
        }
    )

    # Payment Receipt
    pay1, _ = Payment.objects.get_or_create(
        invoice=inv1,
        receipt_number='REC-2026-0042',
        defaults={
            'daycare': daycare,
            'family': family,
            'student': student,
            'amount': Decimal('543.37'),
            'currency': 'CAD',
            'payment_date': timezone.now().date().replace(day=2),
            'payment_method': 'ETRANSFER',
            'status': 'COMPLETED',
            'transaction_reference': 'INTERAC-REF-889421',
            'payer_name': 'David Miller',
            'payer_email': 'david.miller@example.com',
            'notes': 'Online Interac e-Transfer received and cleared'
        }
    )

    # Oct Invoice & Receipt for history
    last_month = timezone.now().date().month - 1 or 12
    last_month_year = timezone.now().date().year if last_month != 12 else timezone.now().date().year - 1
    inv2, _ = Invoice.objects.get_or_create(
        daycare=daycare,
        invoice_number='INV-2026-0031',
        defaults={
            'family': family,
            'student': student,
            'invoice_type': 'STANDARD',
            'issue_date': timezone.now().date().replace(year=last_month_year, month=last_month, day=1),
            'due_date': timezone.now().date().replace(year=last_month_year, month=last_month, day=15),
            'subtotal': Decimal('1150.00'),
            'discount': Decimal('606.63'),
            'discount_total': Decimal('606.63'),
            'total_amount': Decimal('543.37'),
            'amount_paid': Decimal('543.37'),
            'balance_due': Decimal('0.00'),
            'currency': 'CAD',
            'status': 'PAID',
            'notes': 'October 2026 Toddler Child Care Tuition'
        }
    )
    Payment.objects.get_or_create(
        invoice=inv2,
        receipt_number='REC-2026-0031',
        defaults={
            'daycare': daycare,
            'family': family,
            'student': student,
            'amount': Decimal('543.37'),
            'currency': 'CAD',
            'payment_date': timezone.now().date().replace(year=last_month_year, month=last_month, day=3),
            'payment_method': 'CREDIT_CARD',
            'status': 'COMPLETED',
            'transaction_reference': 'STRIPE-CHG-994102',
            'payer_name': 'David Miller',
            'payer_email': 'david.miller@example.com'
        }
    )
    print("  -> Invoices INV-2026-0042 & INV-2026-0031 and Receipts REC-2026-0042 & REC-2026-0031 created")

    # 8. Daily Report with Meals & Naps
    today = timezone.now().date()
    dr, _ = DailyReport.objects.get_or_create(
        student=student,
        report_date=today,
        defaults={
            'daycare': daycare,
            'classroom': classroom,
            'teacher': teacher_user,
            'status': 'published',
            'notes': 'Laim had a cheerful day exploring wooden puzzle blocks, listening to storytime, and singing nursery rhymes with friends.'
        }
    )
    MealRecord.objects.get_or_create(
        daily_report=dr,
        meal_type='Breakfast',
        defaults={'food_provided': 'Warm oatmeal with organic blueberries & milk', 'amount_eaten': 'All', 'time': '09:00:00'}
    )
    MealRecord.objects.get_or_create(
        daily_report=dr,
        meal_type='Lunch',
        defaults={'food_provided': 'Herb-roasted chicken breast with brown rice & steamed carrots', 'amount_eaten': 'Most', 'time': '12:00:00'}
    )
    MealRecord.objects.get_or_create(
        daily_report=dr,
        meal_type='Snack',
        defaults={'food_provided': 'Crisp apple slices with whole grain crackers', 'amount_eaten': 'All', 'time': '15:30:00'}
    )
    NapRecord.objects.get_or_create(
        daily_report=dr,
        defaults={'start_time': '12:45:00', 'end_time': '14:30:00', 'duration_minutes': 105, 'quality': 'Peaceful / Restful sleep'}
    )
    ToiletingRecord.objects.get_or_create(
        daily_report=dr,
        type='diaper',
        defaults={'condition': 'wet', 'time': '10:30:00', 'notes': 'Fresh diaper applied'}
    )
    ToiletingRecord.objects.get_or_create(
        daily_report=dr,
        type='potty',
        defaults={'condition': 'successful', 'time': '15:00:00', 'notes': 'Encouraged potty trial - successful'}
    )
    print("  -> Daily Report created for today with meals, naps & toileting")

    # 9. Incident Report
    IncidentReport.objects.get_or_create(
        student=student,
        activity_date=today.replace(day=max(1, today.day - 8)),
        defaults={
            'daycare': daycare,
            'reporting_employee': teacher,
            'time': '10:45:00',
            'incident_type': 'Playground Minor Scrape',
            'severity': 'Minor',
            'description': 'Laim tripped on playground rubber mulch while playing tag. Small superficial scrape on left knee.',
            'action_taken': 'Cleaned with saline wipe, applied antiseptic cream and fun animal bandage. Parent notified at pickup.',
            'follow_up_required': False,
            'witness': 'Sarah Jenkins, RECE'
        }
    )

    # 10. Consent Forms
    cf1, _ = ConsentForm.objects.get_or_create(
        daycare=daycare,
        title='Photography & Social Media Consent 2026-2027',
        defaults={
            'description': 'Permission to photograph child for daily activity logs and classroom documentation',
            'requires_signature': True,
            'status': 'Active',
            'version': 1,
            'created_at': timezone.now(),
            'updated_at': timezone.now()
        }
    )
    ConsentFormAssignment.objects.get_or_create(
        student=student,
        consent_form=cf1,
        defaults={
            'family': family,
            'status': 'Signed',
            'due_date': today.replace(month=12, day=15),
            'created_at': timezone.now(),
            'updated_at': timezone.now()
        }
    )

    cf2, _ = ConsentForm.objects.get_or_create(
        daycare=daycare,
        title='Local Park & Neighborhood Walking Excursions',
        defaults={
            'description': 'Permission for supervised community walks to nearby public park',
            'requires_signature': True,
            'status': 'Active',
            'version': 1,
            'created_at': timezone.now(),
            'updated_at': timezone.now()
        }
    )
    ConsentFormAssignment.objects.get_or_create(
        student=student,
        consent_form=cf2,
        defaults={
            'family': family,
            'status': 'Signed',
            'due_date': today.replace(month=12, day=15),
            'created_at': timezone.now(),
            'updated_at': timezone.now()
        }
    )

    # 11. Attendance Records
    for day_offset in range(5):
        att_date = today.replace(day=max(1, today.day - day_offset))
        StudentAttendance.objects.get_or_create(
            student=student,
            attendance_date=att_date,
            defaults={
                'daycare': daycare,
                'classroom': classroom,
                'attendance_status': 'PRESENT',
                'check_in_time': '08:35:00',
                'check_out_time': '16:45:00',
                'notes': 'Checked in by Father (David Miller)'
            }
        )

    print("SUCCESS: Rich test dataset populated for Laim Miller!")

if __name__ == '__main__':
    seed_laim_miller()
