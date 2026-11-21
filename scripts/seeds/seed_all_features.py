"""
KidSynq Master Feature Seeder
Seeds complete, realistic operational data for local testing of all modules:
- SuperAdmin portal
- Daycare Admin & Operations portal
- Staff & Scheduling
- Attendance, Safe Arrival & Daily Reports
- Classrooms, Programs & Live Ratio Monitoring
- Tuition Billing, Invoices, CWELCC Subsidies & Payments
- Family / Guardian portal
"""
import os
import sys
from datetime import date, time, datetime, timedelta
from decimal import Decimal
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / 'apps'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
import django
django.setup()

from django.db import transaction
from django.utils import timezone
from django.contrib.auth.models import Group
from core.models import (
    User, Daycare, Branch, DaycareSettings, DaycareHoliday, DaycareEmergencyInformation,
    SubscriptionPlan, SubscriptionFeature, DaycareSubscription,
    Province, CredentialType, EmployeeType, Employee, ECECredential,
    Classroom, Program, AgeGroup, ClassroomStudent, ClassroomTeacherAssignment,
    Student, StudentEmergencyContact, StudentPickup, HealthProfile,
    Family, Guardian, FamilyGuardian, FamilyChild,
    StudentAttendance, DailyReport, MealRecord, NapRecord, ActivityRecord,
    StaffSchedule, StaffAttendance, LeaveRequest, OvertimeRecord, StaffShortageAlert,
    FeeStructure, Invoice, InvoiceItem, Payment, ChildSubsidyProfile, TaxReceipt,
    Announcement, ConsentForm, SupportTicket
)

def run():
    print("=" * 65)
    print("KIDSYNQ: SEEDING ALL FEATURES ON LOCAL SYSTEM")
    print("=" * 65)

    today = timezone.now().date()
    now_dt = timezone.now()

    with transaction.atomic():
        # 1. Canadian Provinces
        print("[1/9] Ensuring Provinces...")
        provinces = [
            ('ON', 'Ontario'), ('BC', 'British Columbia'), ('AB', 'Alberta'),
            ('QC', 'Quebec'), ('MB', 'Manitoba'), ('SK', 'Saskatchewan'),
            ('NS', 'Nova Scotia'), ('NB', 'New Brunswick')
        ]
        for code, name in provinces:
            Province.objects.get_or_create(code=code, defaults={'name': name})

        # 2. Credential Types
        print("[2/9] Ensuring Credential Types...")
        creds = [
            ('Vulnerable Sector Check (VSC)', 'background_check'),
            ('Standard First Aid & CPR Level C', 'certification'),
            ('ECE Diploma (College of ECEs)', 'ece'),
            ('Food Handler / Food Safety Certification', 'training'),
            ('Anaphylaxis & Emergency Medical Response', 'training'),
            ('WHMIS Workplace Safety Certification', 'training')
        ]
        for c_name, c_cat in creds:
            CredentialType.objects.get_or_create(name=c_name, defaults={'category': c_cat})

        # 3. Subscription Features & Plans
        print("[3/9] Ensuring Subscription Features & Plans...")
        features_data = [
            ('students', 'Child Management', 'Children & Families', 1),
            ('classrooms', 'Classroom Management', 'Classroom', 2),
            ('ratio_monitoring', 'Ratio Monitoring', 'Classroom', 3),
            ('daily_reports', 'Daily Child Reports', 'Classroom', 4),
            ('attendance', 'Attendance & QR / PIN Kiosk', 'Attendance & Operations', 5),
            ('safe_arrival', 'Safe Arrival & Departure Tracking', 'Attendance & Operations', 6),
            ('billing', 'Invoicing & Payments', 'Finance & Billing', 7),
            ('subsidies_cwelcc', 'CWELCC & Government Subsidies', 'Finance & Billing', 8),
            ('staff_management', 'Staff & Employee Directory', 'Staff & Scheduling', 9),
            ('scheduling', 'Shift Scheduling & Time Tracking', 'Staff & Scheduling', 10),
            ('credentials', 'ECE Compliance & Credential Tracking', 'Staff & Scheduling', 11),
            ('communication', 'Announcements & Messaging', 'Operations & Communication', 12),
        ]
        feature_objs = []
        for code, name, cat, order in features_data:
            feat, _ = SubscriptionFeature.objects.get_or_create(
                code=code,
                defaults={'name': name, 'category': cat, 'order': order, 'description': f'{name} module'}
            )
            feature_objs.append(feat)

        plan, _ = SubscriptionPlan.objects.get_or_create(
            name='Enterprise',
            defaults={
                'monthly_price': Decimal('299.00'),
                'quarterly_price': Decimal('800.00'),
                'annual_price': Decimal('2990.00'),
                'max_students': 200,
                'max_teachers': 50,
                'max_staff': 60,
                'max_classrooms': 15,
                'max_branches': 5,
                'max_storage_mb': 51200,
                'status': 'Active',
                'description': 'Full feature enterprise plan with all modules enabled.'
            }
        )
        plan.features.set(feature_objs)

        # 4. Daycare Setup
        print("[4/9] Setting up Flagship Daycare & Branch...")
        daycare, _ = Daycare.objects.get_or_create(
            name='Little Stars Learning Academy',
            defaults={
                'email': 'admin@littlestars.ca',
                'phone': '(416) 555-0199',
                'address': '100 University Ave',
                'city': 'Toronto',
                'state': 'ON',
                'postal_code': 'M5J 2P1',
                'country': 'Canada',
                'capacity': 60,
                'status': 'Active'
            }
        )
        daycare.status = 'Active'
        daycare.save()

        branch, _ = Branch.objects.get_or_create(
            daycare=daycare,
            name='Downtown Campus'
        )

        sub, _ = DaycareSubscription.objects.get_or_create(
            daycare=daycare,
            defaults={
                'subscription_plan': plan,
                'subscription_status': 'Active',
                'billing_cycle': 'Monthly',
                'amount': plan.monthly_price
            }
        )
        sub.subscription_status = 'Active'
        sub.save()

        # Daycare Settings & Holidays
        DaycareSettings.objects.get_or_create(
            daycare=daycare,
            defaults={
                'timezone': 'America/Toronto',
                'date_format': 'YYYY-MM-DD',
                'time_format': 'HH:mm',
                'currency': 'CAD',
                'default_language': 'en',
                'week_start_day': 'Monday',
                'allow_parent_notifications': True,
                'allow_staff_notifications': True,
                'created_at': now_dt,
                'updated_at': now_dt
            }
        )
        DaycareHoliday.objects.get_or_create(
            daycare=daycare,
            name='Canada Day',
            defaults={'holiday_date': date(today.year, 7, 1)}
        )
        DaycareEmergencyInformation.objects.get_or_create(
            daycare=daycare,
            defaults={
                'contact_name': 'Sarah Jenkins (Director)',
                'phone': '(416) 555-0199',
                'police_contact': '911 / (416) 808-5200',
                'fire_service_contact': '911',
                'hospital_contact': 'Hospital for Sick Children (SickKids)',
                'additional_instructions': 'Royal York Hotel Assembly Hall, 100 Front St W'
            }
        )

        # 5. Core Users & Staff
        print("[5/9] Setting up Core Users & Educators...")
        # Superadmin
        su, _ = User.objects.get_or_create(
            username='superadmin',
            defaults={'email': 'superadmin@kidsynq.com', 'first_name': 'Platform', 'last_name': 'SuperAdmin'}
        )
        su.set_password('superadmin123')
        su.is_superuser = True
        su.is_staff = True
        su.is_active = True
        su.status = 'Active'
        su.save()

        # Daycare Admin / Director
        admin_u, _ = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@littlestars.ca',
                'first_name': 'Sarah',
                'last_name': 'Jenkins',
                'daycare': daycare,
                'branch': branch
            }
        )
        admin_u.set_password('admin123')
        admin_u.is_superuser = True
        admin_u.is_staff = True
        admin_u.is_active = True
        admin_u.daycare = daycare
        admin_u.branch = branch
        admin_u.status = 'Active'
        admin_u.save()

        # Staff Member 1
        staff_u, _ = User.objects.get_or_create(
            username='staff',
            defaults={
                'email': 'staff@littlestars.ca',
                'first_name': 'Elena',
                'last_name': 'Rostova',
                'daycare': daycare,
                'branch': branch
            }
        )
        staff_u.set_password('admin123')
        staff_u.is_staff = True
        staff_u.is_active = True
        staff_u.daycare = daycare
        staff_u.branch = branch
        staff_u.status = 'Active'
        staff_u.save()

        # Staff Member 2
        teacher_u, _ = User.objects.get_or_create(
            username='teacher',
            defaults={
                'email': 'teacher@littlestars.ca',
                'first_name': 'Marcus',
                'last_name': 'Chen',
                'daycare': daycare,
                'branch': branch
            }
        )
        teacher_u.set_password('admin123')
        teacher_u.is_staff = True
        teacher_u.is_active = True
        teacher_u.daycare = daycare
        teacher_u.branch = branch
        teacher_u.status = 'Active'
        teacher_u.save()

        # Guardian / Parent
        guardian_u, _ = User.objects.get_or_create(
            username='guardian',
            defaults={
                'email': 'guardian@example.com',
                'first_name': 'Emily',
                'last_name': 'Watson'
            }
        )
        guardian_u.set_password('guardian123')
        guardian_u.is_active = True
        guardian_u.status = 'Active'
        guardian_u.save()

        # Employee Profiles
        emp_director, _ = Employee.objects.get_or_create(
            user=admin_u,
            defaults={
                'daycare': daycare,
                'first_name': admin_u.first_name,
                'last_name': admin_u.last_name,
                'email': admin_u.email,
                'phone': '(416) 555-0101',
                'role': 'Director',
                'job_title': 'Center Director',
                'status': 'active',
                'start_date': today - timedelta(days=730)
            }
        )
        emp_staff1, _ = Employee.objects.get_or_create(
            user=staff_u,
            defaults={
                'daycare': daycare,
                'first_name': staff_u.first_name,
                'last_name': staff_u.last_name,
                'email': staff_u.email,
                'phone': '(416) 555-0102',
                'role': 'Teacher',
                'job_title': 'Lead RECE Educator',
                'status': 'active',
                'start_date': today - timedelta(days=365)
            }
        )
        emp_staff2, _ = Employee.objects.get_or_create(
            user=teacher_u,
            defaults={
                'daycare': daycare,
                'first_name': teacher_u.first_name,
                'last_name': teacher_u.last_name,
                'email': teacher_u.email,
                'phone': '(416) 555-0103',
                'role': 'Teacher',
                'job_title': 'Early Childhood Educator',
                'status': 'active',
                'start_date': today - timedelta(days=180)
            }
        )

        # Credentials
        vsc_type = CredentialType.objects.filter(name__icontains='Vulnerable').first()
        cpr_type = CredentialType.objects.filter(name__icontains='CPR').first()
        if vsc_type:
            ECECredential.objects.get_or_create(
                employee=emp_staff1,
                credential_type=vsc_type,
                defaults={
                    'daycare': daycare,
                    'certificate_number': 'VSC-2025-9981',
                    'issue_date': today - timedelta(days=120),
                    'expiry_date': today + timedelta(days=245),
                    'document_status': 'verified'
                }
            )
        if cpr_type:
            ECECredential.objects.get_or_create(
                employee=emp_staff2,
                credential_type=cpr_type,
                defaults={
                    'daycare': daycare,
                    'certificate_number': 'CPR-2025-4421',
                    'issue_date': today - timedelta(days=60),
                    'expiry_date': today + timedelta(days=305),
                    'document_status': 'verified'
                }
            )

        # Staff Schedules (Current Week)
        monday = today - timedelta(days=today.weekday())
        for d_offset in range(5):
            sched_date = monday + timedelta(days=d_offset)
            StaffSchedule.objects.get_or_create(
                employee=emp_staff1,
                date=sched_date,
                defaults={
                    'daycare': daycare,
                    'shift_start': time(8, 0),
                    'shift_end': time(16, 30),
                    'status': 'scheduled',
                    'shift_type': 'regular'
                }
            )
            StaffSchedule.objects.get_or_create(
                employee=emp_staff2,
                date=sched_date,
                defaults={
                    'daycare': daycare,
                    'shift_start': time(9, 0),
                    'shift_end': time(17, 30),
                    'status': 'scheduled',
                    'shift_type': 'regular'
                }
            )

        # Staff Attendance (Today)
        StaffAttendance.objects.get_or_create(
            employee=emp_staff1,
            date=today,
            defaults={
                'daycare': daycare,
                'status': 'CLOCKED_IN',
                'clock_in': now_dt.replace(hour=8, minute=5),
                'check_in_time': time(8, 5),
                'approval_status': 'APPROVED'
            }
        )
        StaffAttendance.objects.get_or_create(
            employee=emp_staff2,
            date=today,
            defaults={
                'daycare': daycare,
                'status': 'CLOCKED_IN',
                'clock_in': now_dt.replace(hour=9, minute=0),
                'check_in_time': time(9, 0),
                'approval_status': 'APPROVED'
            }
        )

        # 6. Programs, Age Groups & Classrooms
        print("[6/9] Setting up Classrooms & Ratio Monitoring...")
        ag_infant, _ = AgeGroup.objects.get_or_create(daycare=daycare, name='Infant', defaults={'min_age_months': 0, 'max_age_months': 18})
        ag_toddler, _ = AgeGroup.objects.get_or_create(daycare=daycare, name='Toddler', defaults={'min_age_months': 18, 'max_age_months': 36})
        ag_preschool, _ = AgeGroup.objects.get_or_create(daycare=daycare, name='Preschool', defaults={'min_age_months': 36, 'max_age_months': 60})

        prog_infant, _ = Program.objects.get_or_create(daycare=daycare, name='Infant Care', defaults={'age_group': 'Infant', 'min_age_months': 0, 'max_age_months': 18, 'status': 'Active'})
        prog_toddler, _ = Program.objects.get_or_create(daycare=daycare, name='Toddler Discovery', defaults={'age_group': 'Toddler', 'min_age_months': 18, 'max_age_months': 36, 'status': 'Active'})
        prog_preschool, _ = Program.objects.get_or_create(daycare=daycare, name='Preschool Learning', defaults={'age_group': 'Preschool', 'min_age_months': 36, 'max_age_months': 60, 'status': 'Active'})

        room_infant, _ = Classroom.objects.get_or_create(
            daycare=daycare,
            room_name='Little Explorers',
            defaults={
                'branch': branch,
                'program': prog_infant,
                'age_group': ag_infant,
                'room_code': 'INF-101',
                'capacity': 8,
                'min_age_months': 6,
                'max_age_months': 18,
                'color': '#0d9488',
                'status': 'Active',
                'primary_teacher': staff_u,
                'description': 'Infant room with dedicated crib area and sensory play.'
            }
        )

        room_toddler, _ = Classroom.objects.get_or_create(
            daycare=daycare,
            room_name='Sunshine Toddlers',
            defaults={
                'branch': branch,
                'program': prog_toddler,
                'age_group': ag_toddler,
                'room_code': 'TOD-201',
                'capacity': 12,
                'min_age_months': 18,
                'max_age_months': 36,
                'color': '#f59e0b',
                'status': 'Active',
                'primary_teacher': teacher_u,
                'description': 'Toddler room focused on motor skills and language immersion.'
            }
        )

        room_preschool, _ = Classroom.objects.get_or_create(
            daycare=daycare,
            room_name='Bright Horizons',
            defaults={
                'branch': branch,
                'program': prog_preschool,
                'age_group': ag_preschool,
                'room_code': 'PRE-301',
                'capacity': 16,
                'min_age_months': 36,
                'max_age_months': 60,
                'color': '#3b82f6',
                'status': 'Active',
                'primary_teacher': admin_u,
                'description': 'Preschool classroom with kindergarten prep curriculum.'
            }
        )

        # 7. Families & Children
        print("[7/9] Setting up Children, Families & Guardians...")
        family, _ = Family.objects.get_or_create(
            daycare=daycare,
            family_name='Watson Family',
            defaults={'status': 'Active'}
        )

        guardian_profile, _ = Guardian.objects.get_or_create(
            user=guardian_u,
            defaults={
                'daycare': daycare,
                'first_name': guardian_u.first_name,
                'last_name': guardian_u.last_name,
                'phone': '(416) 555-0888',
                'email': guardian_u.email,
                'status': 'Active'
            }
        )
        FamilyGuardian.objects.get_or_create(family=family, guardian=guardian_profile, defaults={'relationship': 'Mother', 'is_primary': True})

        children_data = [
            ('Liam', 'Watson', date(2025, 4, 15), 'Male', room_infant, family),
            ('Olivia', 'Smith', date(2025, 8, 20), 'Female', room_infant, None),
            ('Noah', 'Tremblay', date(2024, 6, 10), 'Male', room_toddler, None),
            ('Emma', 'Bouchard', date(2024, 2, 14), 'Female', room_toddler, None),
            ('Lucas', 'Patel', date(2023, 9, 5), 'Male', room_toddler, None),
            ('Chloe', 'Wilson', date(2023, 11, 22), 'Female', room_toddler, None),
            ('Ethan', 'Gagnon', date(2022, 5, 12), 'Male', room_preschool, None),
            ('Ava', 'Taylor', date(2022, 8, 30), 'Female', room_preschool, None),
            ('Leo', 'Roy', date(2022, 1, 18), 'Male', room_preschool, None),
        ]

        created_students = []
        for fn, ln, dob, gen, room, fam in children_data:
            s, _ = Student.objects.get_or_create(
                daycare=daycare,
                first_name=fn,
                last_name=ln,
                defaults={
                    'branch': branch,
                    'dob': dob,
                    'gender': gen,
                    'status': 'Active',
                    'admission_date': today - timedelta(days=180),
                    'allergies': 'Peanuts (Mild)' if fn == 'Liam' else '',
                    'dietary_restrictions': 'Halal' if fn == 'Lucas' else ''
                }
            )
            created_students.append(s)

            # Classroom Student Enrollment
            ClassroomStudent.objects.get_or_create(
                student=s,
                classroom=room,
                defaults={'status': 'Active', 'start_date': today - timedelta(days=180)}
            )

            # Family relationship
            if fam:
                FamilyChild.objects.get_or_create(family=fam, student=s)

            # Emergency Contact
            c_name = f'David {ln}' if fn == 'Liam' else f'Parent {ln}'
            StudentEmergencyContact.objects.get_or_create(
                student=s,
                name=c_name,
                defaults={'relationship': 'Father', 'mobile': '(416) 555-0999', 'is_primary': True}
            )

        # 8. Daily Operations (Attendance, Reports, Invoices)
        print("[8/9] Generating Operational Records (Attendance, Daily Reports, Billing)...")
        # Attendance & Reports for today
        for idx, student in enumerate(created_students):
            att_status = 'PRESENT' if idx < 7 else ('LATE' if idx == 7 else 'ABSENT')
            check_in_t = time(8, 15 + idx * 5) if att_status != 'ABSENT' else None

            att, _ = StudentAttendance.objects.get_or_create(
                daycare=daycare,
                student=student,
                attendance_date=today,
                defaults={
                    'classroom': student.classroom,
                    'attendance_status': att_status,
                    'check_in_time': check_in_t,
                    'is_late': att_status == 'LATE'
                }
            )

            # Past 7 days attendance history
            for day_back in range(1, 6):
                past_d = today - timedelta(days=day_back)
                if past_d.weekday() < 5:
                    StudentAttendance.objects.get_or_create(
                        daycare=daycare,
                        student=student,
                        attendance_date=past_d,
                        defaults={
                            'classroom': student.classroom,
                            'attendance_status': 'PRESENT',
                            'check_in_time': time(8, 30)
                        }
                    )

            # Daily Report for present students
            if att_status != 'ABSENT':
                rep, _ = DailyReport.objects.get_or_create(
                    daycare=daycare,
                    student=student,
                    report_date=today,
                    defaults={
                        'classroom': student.classroom,
                        'status': 'Published',
                        'teacher': staff_u,
                        'notes': f'{student.first_name} had a wonderful, energetic day engaging in creative sensory play!'
                    }
                )
                MealRecord.objects.get_or_create(
                    daily_report=rep,
                    meal_type='Morning Snack',
                    defaults={'amount_eaten': 'All', 'food_provided': 'Organic apple slices and whole grain crackers'}
                )
                MealRecord.objects.get_or_create(
                    daily_report=rep,
                    meal_type='Lunch',
                    defaults={'amount_eaten': 'Most', 'food_provided': 'Steamed brown rice with mild vegetable curry'}
                )
                NapRecord.objects.get_or_create(
                    daily_report=rep,
                    start_time=time(12, 30),
                    defaults={'end_time': time(14, 15), 'quality': 'Restful'}
                )
                ActivityRecord.objects.get_or_create(
                    daily_report=rep,
                    name='Sensory Water Table Play',
                    defaults={'activity_type': 'Sensory Play', 'description': 'Explored textures, floating toys, and measurement cups.'}
                )

        # Billing: Fee Structures & Invoices
        first_of_year = today.replace(month=1, day=1)
        fee_infant, _ = FeeStructure.objects.get_or_create(
            daycare=daycare,
            name='Infant Full-Time Monthly',
            defaults={'amount': Decimal('1450.00'), 'fee_type': 'MONTHLY', 'frequency': 'MONTHLY', 'effective_from': first_of_year, 'is_active': True}
        )
        fee_toddler, _ = FeeStructure.objects.get_or_create(
            daycare=daycare,
            name='Toddler Full-Time Monthly',
            defaults={'amount': Decimal('1250.00'), 'fee_type': 'MONTHLY', 'frequency': 'MONTHLY', 'effective_from': first_of_year, 'is_active': True}
        )
        fee_preschool, _ = FeeStructure.objects.get_or_create(
            daycare=daycare,
            name='Preschool Full-Time Monthly',
            defaults={'amount': Decimal('1050.00'), 'fee_type': 'MONTHLY', 'frequency': 'MONTHLY', 'effective_from': first_of_year, 'is_active': True}
        )

        # CWELCC Subsidies
        for s in created_students[:4]:
            ChildSubsidyProfile.objects.get_or_create(
                daycare=daycare,
                student=s,
                defaults={
                    'program_name': 'CWELCC Canada-Wide Early Learning',
                    'subsidy_type': 'PERCENTAGE',
                    'subsidy_rate': Decimal('52.75'),
                    'government_case_number': f'CW-2026-{s.first_name[:3].upper()}',
                    'effective_from': today.replace(month=1, day=1),
                    'is_active': True
                }
            )

        # Invoices for this month
        first_of_month = today.replace(day=1)
        for idx, student in enumerate(created_students[:6]):
            inv_num = f'INV-2026-{100 + idx}'
            inv_amount = Decimal('1250.00')
            inv_status = 'PAID' if idx < 3 else ('ISSUED' if idx < 5 else 'OVERDUE')

            inv, _ = Invoice.objects.get_or_create(
                daycare=daycare,
                invoice_number=inv_num,
                defaults={
                    'student': student,
                    'total_amount': inv_amount,
                    'balance_due': Decimal('0.00') if inv_status == 'PAID' else inv_amount,
                    'issue_date': first_of_month,
                    'due_date': first_of_month + timedelta(days=15),
                    'status': inv_status
                }
            )

            InvoiceItem.objects.get_or_create(
                invoice=inv,
                description='Monthly Childcare Tuition',
                defaults={'unit_price': inv_amount, 'quantity': Decimal('1.00'), 'subtotal': inv_amount, 'total': inv_amount}
            )

            if inv_status == 'PAID':
                Payment.objects.get_or_create(
                    invoice=inv,
                    defaults={
                        'daycare': daycare,
                        'student': student,
                        'amount': inv_amount,
                        'payment_date': first_of_month + timedelta(days=3),
                        'payment_method': 'CREDIT_CARD',
                        'status': 'COMPLETED',
                        'receipt_number': f'REC-2026-{100 + idx}',
                        'transaction_reference': f'TXN-CC-2026-{200 + idx}'
                    }
                )

        # 9. Center Announcements & Consents
        print("[9/9] Creating Announcements & Consent Forms...")
        Announcement.objects.get_or_create(
            daycare=daycare,
            title='Welcome to the Fall Term 2026!',
            defaults={
                'sender': admin_u,
                'content': 'We are excited to welcome all children and families to our center! Please ensure autumn weather clothes are labelled.',
                'status': 'Published',
                'published_at': now_dt - timedelta(days=3)
            }
        )
        Announcement.objects.get_or_create(
            daycare=daycare,
            title='Parent-Educator Conference Schedule Open',
            defaults={
                'sender': admin_u,
                'content': 'Sign-ups for our semester one family conferences are now available through the parent portal.',
                'status': 'Published',
                'published_at': now_dt - timedelta(days=1)
            }
        )

        ConsentForm.objects.get_or_create(
            daycare=daycare,
            title='Photo & Digital Media Release',
            defaults={
                'created_by': admin_u,
                'content': 'I grant permission for staff to take daily report activity photographs of my child.',
                'form_type': 'general',
                'requires_signature': True,
                'status': 'active',
                'version': 1,
                'created_at': now_dt,
                'updated_at': now_dt
            }
        )
        ConsentForm.objects.get_or_create(
            daycare=daycare,
            title='Sunscreen & Topical Medication Policy',
            defaults={
                'created_by': admin_u,
                'content': 'I authorize educators to apply broad-spectrum sunscreen prior to outdoor curriculum time.',
                'form_type': 'medical',
                'requires_signature': True,
                'status': 'active',
                'version': 1,
                'created_at': now_dt,
                'updated_at': now_dt
            }
        )

    print("=" * 65)
    print("ALL FEATURES SEEDED SUCCESSFULLY ON LOCAL SYSTEM!")
    print("=" * 65)
    print("Test Credentials:")
    print("  SuperAdmin Portal: /superadmin/login/")
    print("    - Username: superadmin / Password: superadmin123")
    print("    - Username: admin      / Password: admin123")
    print("  Daycare Portal:    /login/")
    print("    - Admin:    admin      / Password: admin123")
    print("    - Staff:    staff      / Password: admin123")
    print("    - Teacher:  teacher    / Password: admin123")
    print("    - Parent:   guardian   / Password: guardian123")
    print("  Django Admin:      /admin/ or /django-admin/")
    print("=" * 65)

if __name__ == '__main__':
    run()
