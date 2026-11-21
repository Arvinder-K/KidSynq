import os
import sys
import django
from datetime import date, time, datetime, timedelta
from decimal import Decimal
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.db import transaction
from django.utils import timezone
from core.models import (
    Daycare, Branch, Classroom, Student, User, Employee,
    Family, Guardian, FamilyGuardian, FamilyChild, ClassroomStudent,
    StudentAttendance, DailyReport, MealRecord,
    Invoice, InvoiceItem, Payment, ChildSubsidyProfile,
    StaffAttendance, StaffSchedule, ECECredential, CredentialType, AuditLog
)

def seed_real_data():
    daycare = Daycare.objects.filter(name__icontains='Happy kid').first()
    if not daycare:
        print("Error: Daycare 'Happy kid Ac test' not found!")
        return

    print(f"Target Daycare: {daycare.name} ({daycare.id})")
    today = timezone.now().date()
    admin_user = User.objects.filter(username='testday').first() or User.objects.filter(daycare=daycare).first()

    with transaction.atomic():
        # Update daycare capacity to match classroom capacity total
        classrooms = list(Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True))
        total_class_cap = sum(c.capacity or 10 for c in classrooms)
        daycare.capacity = max(total_class_cap, 35)
        daycare.save(update_fields=['capacity'])
        print(f"Updated Daycare Capacity: {daycare.capacity}")

        students = list(Student.objects.filter(daycare=daycare, deleted_at__isnull=True))
        families = list(Family.objects.filter(daycare=daycare))
        employees = list(Employee.objects.filter(daycare=daycare))
        teachers = [e.user for e in employees if e.user] or [admin_user]

        print(f"Found {len(students)} students, {len(families)} families, {len(employees)} employees.")

        # 1. Clean existing invoices, payments, and subsidies for this daycare
        Payment.objects.filter(daycare=daycare).delete()
        InvoiceItem.objects.filter(invoice__daycare=daycare).delete()
        Invoice.objects.filter(daycare=daycare).delete()
        ChildSubsidyProfile.objects.filter(daycare=daycare).delete()
        print("Cleaned up old invoices, payments, and subsidies.")

        # 2. Setup Real Subsidies (CWELCC 52.75% and Municipal Affordability Grants)
        print("\n--- 1. CREATING CWELCC & AFFORDABILITY SUBSIDY PROFILES ---")
        subsidy_programs = [
            ("CWELCC Fee Reduction", "PERCENTAGE", Decimal("52.75")),
            ("Affordability Grant Toddler", "FIXED_MONTHLY", Decimal("765.00")),
            ("Affordability Grant Infant", "FIXED_MONTHLY", Decimal("883.00")),
            ("Affordability Grant Preschool", "FIXED_MONTHLY", Decimal("450.00")),
        ]

        # Allocate CWELCC or grants to eligible children
        for idx, student in enumerate(students):
            family = Family.objects.filter(family_children__student=student).first()
            prog_name, sub_type, sub_val = subsidy_programs[idx % len(subsidy_programs)]
            ChildSubsidyProfile.objects.create(
                daycare=daycare,
                student=student,
                family=family,
                program_name=prog_name,
                subsidy_type=sub_type,
                subsidy_rate=sub_val,
                government_case_number=f"CW-{202600 + idx}",
                approved_days_per_week=5,
                effective_from=today.replace(month=1, day=1),
                effective_until=today.replace(month=12, day=31),
                is_active=True,
                created_by=admin_user
            )
        print(f"Created {len(students)} active ChildSubsidyProfile records.")

        # 3. Create Real Multi-Month Billing & Payment History (Past 6 Months)
        print("\n--- 2. CREATING REAL MULTI-MONTH INVOICES & PAYMENTS ---")
        monthly_rates = {
            'INF-101': Decimal('1450.00'), # Infant
            'TOD-201': Decimal('1150.00'), # Toddler
            'PRE-301': Decimal('950.00'),  # Preschool
        }

        # Generate invoices for past 6 months (Apr, May, Jun, Jul, Aug, Sep 2026)
        # Note: today is Sep 2026
        invoice_counter = 1001
        for month_offset in range(5, -1, -1):
            # Calculate target month date
            m_year = today.year
            m_month = today.month - month_offset
            while m_month <= 0:
                m_month += 12
                m_year -= 1
            
            month_start = date(m_year, m_month, 1)
            if m_month == 12:
                month_end = date(m_year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(m_year, m_month + 1, 1) - timedelta(days=1)

            is_current_month = (month_offset == 0)
            month_str = month_start.strftime("%b %Y")

            month_invoices_created = 0
            month_payments_created = 0

            for s_idx, student in enumerate(students):
                family = Family.objects.filter(family_children__student=student).first()
                cs = ClassroomStudent.objects.filter(student=student, status='Active').first()
                room_code = cs.classroom.room_code if cs and cs.classroom else 'TOD-201'
                base_fee = monthly_rates.get(room_code, Decimal('1150.00'))

                # CWELCC 52.75% discount
                cwelcc_discount = (base_fee * Decimal('0.5275')).quantize(Decimal('0.01'))
                parent_due = (base_fee - cwelcc_discount).quantize(Decimal('0.01'))

                inv_num = f"INV-{m_year}{m_month:02d}-{invoice_counter:04d}"
                invoice_counter += 1

                # In current month, make 17 paid, 2 issued (unpaid), 1 overdue
                if is_current_month:
                    if s_idx in [18, 19]:
                        inv_status = 'ISSUED'
                        paid_amt = Decimal('0.00')
                        bal_due = parent_due
                    elif s_idx == 17:
                        inv_status = 'OVERDUE'
                        paid_amt = Decimal('0.00')
                        bal_due = parent_due
                    elif s_idx == 16:
                        inv_status = 'PARTIALLY_PAID'
                        paid_amt = (parent_due / Decimal('2.00')).quantize(Decimal('0.01'))
                        bal_due = parent_due - paid_amt
                    else:
                        inv_status = 'PAID'
                        paid_amt = parent_due
                        bal_due = Decimal('0.00')
                else:
                    # In past months, all paid
                    inv_status = 'PAID'
                    paid_amt = parent_due
                    bal_due = Decimal('0.00')

                inv = Invoice.objects.create(
                    daycare=daycare,
                    family=family,
                    student=student,
                    enrollment=cs,
                    invoice_number=inv_num,
                    invoice_type='RECURRING',
                    billing_period_start=month_start,
                    billing_period_end=month_end,
                    issue_date=month_start,
                    due_date=month_start + timedelta(days=10),
                    subtotal=base_fee,
                    discount_total=cwelcc_discount,
                    discount=cwelcc_discount,
                    tax_total=Decimal('0.00'),
                    late_fee_total=Decimal('0.00'),
                    credit_total=Decimal('0.00'),
                    deposit_applied_total=Decimal('0.00'),
                    total_amount=parent_due,
                    amount_paid=paid_amt,
                    balance_due=bal_due,
                    currency='CAD',
                    status=inv_status,
                    notes=f"Monthly Childcare Tuition for {month_str} (CWELCC Affordability Applied)",
                    created_by=admin_user
                )

                # Invoice Items
                InvoiceItem.objects.create(
                    invoice=inv,
                    student=student,
                    description=f"Monthly Base Tuition - {cs.classroom.room_name if cs and cs.classroom else 'Daycare'}",
                    fee_type_code='TUITION_MONTHLY',
                    quantity=Decimal('1.00'),
                    unit_price=base_fee,
                    subtotal=base_fee,
                    discount_amount=cwelcc_discount,
                    tax_amount=Decimal('0.00'),
                    total=parent_due
                )
                month_invoices_created += 1

                # If payment made, create payment receipt
                if paid_amt > Decimal('0.00'):
                    pay_date = month_start + timedelta(days=random.randint(2, 7))
                    methods = ['ETRANSFER', 'CREDIT_CARD', 'PRE_AUTHORIZED_DEBIT']
                    rcp_num = f"RCP-{m_year}{m_month:02d}-{inv_num.split('-')[-1]}"
                    Payment.objects.create(
                        daycare=daycare,
                        invoice=inv,
                        family=family,
                        student=student,
                        receipt_number=rcp_num,
                        amount=paid_amt,
                        currency='CAD',
                        payment_date=pay_date,
                        payment_method=methods[s_idx % len(methods)],
                        status='COMPLETED',
                        payer_name=family.primary_contact if family else f"{student.first_name}'s Guardian",
                        payer_email=family.primary_email if family else None,
                        notes=f"Payment for {inv_num}",
                        created_by=admin_user
                    )
                    month_payments_created += 1

            print(f"  Month {month_str}: Created {month_invoices_created} Invoices & {month_payments_created} Payments.")

        # 4. Create Staff On Duty for Today (Emily Clark, Sarah Jenkins, Rachel Green)
        print("\n--- 3. CREATING STAFF ON DUTY ATTENDANCE FOR TODAY ---")
        StaffAttendance.objects.filter(daycare=daycare, date=today).delete()
        
        punch_times = [
            ("08:00", "APPROVED"),
            ("08:30", "APPROVED"),
            ("08:45", "APPROVED"),
            ("09:00", "PENDING"),
        ]
        for idx, emp in enumerate(employees):
            p_time_str, p_status = punch_times[idx % len(punch_times)]
            hr, mn = map(int, p_time_str.split(':'))
            cin_time = time(hr, mn)
            
            StaffAttendance.objects.create(
                daycare=daycare,
                employee=emp,
                date=today,
                check_in_time=cin_time,
                clock_in=timezone.now().replace(hour=hr, minute=mn, second=0, microsecond=0),
                status='CLOCKED_IN',
                approval_status=p_status,
                notes="Morning ECE opening duty"
            )
            print(f"  Checked in staff: {emp.first_name} {emp.last_name} ({emp.job_title}) at {p_time_str} [{p_status}]")

        # 5. Create Daily Care Reports for Today
        print("\n--- 4. CREATING DAILY CHILD CARE REPORTS FOR TODAY ---")
        DailyReport.objects.filter(daycare=daycare, report_date=today).delete()
        
        for idx, student in enumerate(students):
            cs = ClassroomStudent.objects.filter(student=student, status='Active').first()
            teacher_user = cs.classroom.primary_teacher if (cs and cs.classroom and cs.classroom.primary_teacher) else admin_user
            
            if idx < 12:
                r_status = 'Published'
                pub_time = timezone.now() - timedelta(minutes=random.randint(10, 120))
            elif idx < 17:
                r_status = 'Draft'
                pub_time = None
            else:
                continue # Remaining 3 pending

            dr = DailyReport.objects.create(
                daycare=daycare,
                student=student,
                enrollment=cs,
                classroom=cs.classroom if cs else None,
                report_date=today,
                teacher=teacher_user,
                status=r_status,
                published_at=pub_time,
                notes=f"{student.first_name} had a wonderful day engaging in sensory motor activities and group storytelling."
            )

            # Add Meals
            MealRecord.objects.create(
                daily_report=dr,
                meal_type='Lunch',
                meal_category='Meal',
                food_provided='Organic Veggie Pasta with Tomato Sauce & Fresh Fruit',
                amount_eaten='All',
                time=time(12, 0),
                recorded_by=teacher_user
            )

        print(f"Created real DailyReports for today (Published, In-Progress, Pending).")

        # 6. Create Audit Log Activity
        print("\n--- 5. REFRESHING REAL AUDIT LOG ACTIVITY ---")
        AuditLog.objects.filter(user__daycare=daycare).delete()
        actions = [
            ("CHILD_CHECK_IN", "Checked in 20 children across 3 classrooms for morning session"),
            ("STAFF_CLOCK_IN", "Educators clocked in: Emily Clark, Sarah Jenkins, Rachel Green"),
            ("INVOICE_CYCLE_GENERATED", f"Generated monthly recurring tuition invoices for {len(students)} families"),
            ("PAYMENT_RECORDED", "Recorded 17 parent tuition payments via Interac E-Transfer & PAD"),
            ("DAILY_REPORT_PUBLISHED", "Published real-time morning daily care updates to Parent Mobile Portal")
        ]
        for idx, (act_type, act_desc) in enumerate(actions):
            AuditLog.objects.create(
                user=admin_user,
                action=act_desc,
                created_at=timezone.now() - timedelta(minutes=15 * (idx + 1))
            )

        print("\n=== REAL DATA SEEDING COMPLETE FOR HAPPY KID AC TEST ===")

if __name__ == '__main__':
    seed_real_data()
