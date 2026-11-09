import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import SubscriptionFeature, SubscriptionPlan

FEATURES = [
    # 1. Children & Families
    {
        'code': 'students',
        'name': 'Child Management',
        'category': 'Children & Families',
        'description': 'Child roster, student profiles, medical alerts, dietary restrictions, and emergency contacts.',
        'order': 1
    },
    {
        'code': 'family_management',
        'name': 'Family Management',
        'category': 'Children & Families',
        'description': 'Family household directories, parent accounts, authorized pickup contacts, and custody notes.',
        'order': 2
    },
    {
        'code': 'admissions_waitlist',
        'name': 'Enrollment & Online Admissions',
        'category': 'Children & Families',
        'description': 'Public enrollment landing page, digital intake application review, and parent onboarding.',
        'order': 3
    },
    {
        'code': 'waitlist',
        'name': 'Waitlist Management',
        'category': 'Children & Families',
        'description': 'Priority prospective family queue, intake stages, sibling prioritization, and spot offer allocations.',
        'order': 4
    },
    {
        'code': 'consent_forms',
        'name': 'Consent Forms & Waivers',
        'category': 'Children & Families',
        'description': 'Custom waiver templates, digital signatures, photo/field trip permissions, and compliance status.',
        'order': 5
    },

    # 2. Classroom
    {
        'code': 'classrooms',
        'name': 'Classroom Management',
        'category': 'Classroom',
        'description': 'Room capacities, educator assignments, student rosters, room schedules, and licensed quotas.',
        'order': 10
    },
    {
        'code': 'ratio_monitoring',
        'name': 'Ratio Monitoring',
        'category': 'Classroom',
        'description': 'Real-time staff-to-child ratio gauges, automated shortage warnings, and provincial limits.',
        'order': 11
    },
    {
        'code': 'ratio_rules',
        'name': 'Provincial Ratio Rules',
        'category': 'Classroom',
        'description': 'Configurable baseline ratio rules by province/territory, age brackets, and center custom rules.',
        'order': 12
    },
    {
        'code': 'age_groups',
        'name': 'Programs & Age Groups',
        'category': 'Classroom',
        'description': 'Infant, Toddler, Preschool, Kindergarten program rules and room transitions.',
        'order': 13
    },
    {
        'code': 'out_of_school',
        'name': 'Before & After School',
        'category': 'Classroom',
        'description': 'Extended care schedules, school bus pickups, holiday camps, and PA day registrations.',
        'order': 14
    },
    {
        'code': 'branches',
        'name': 'Multi-Branch & Locations',
        'category': 'Classroom',
        'description': 'Multi-location center overview, branch switching, and cross-campus analytics.',
        'order': 15
    },

    # 3. Staff
    {
        'code': 'staff_management',
        'name': 'Employee Management',
        'category': 'Staff',
        'description': 'Staff directory, ECE profiles, emergency contacts, onboarding details, and roles.',
        'order': 20
    },
    {
        'code': 'staff_scheduling',
        'name': 'Staff Scheduling',
        'category': 'Staff',
        'description': 'Interactive weekly/monthly shift rosters, repeat schedules, and open shift filling.',
        'order': 21
    },
    {
        'code': 'staff_training',
        'name': 'Staff Training',
        'category': 'Staff',
        'description': 'Professional development logs, mandatory safety training tracking, and staff certifications.',
        'order': 22
    },
    {
        'code': 'staff_attendance',
        'name': 'Staff Clock-In & Attendance',
        'category': 'Staff',
        'description': 'Educator digital punch clock, GPS/kiosk clock in/out, and live floor attendance.',
        'order': 23
    },
    {
        'code': 'timesheet_approvals',
        'name': 'Timesheet Approvals',
        'category': 'Staff',
        'description': 'Review, modify, approve employee worked hours, breaks, and manager signatures.',
        'order': 24
    },
    {
        'code': 'leave_management',
        'name': 'Leave & Time-Off Requests',
        'category': 'Staff',
        'description': 'Vacation, sick, personal leave requests, supervisor approval workflows, and balance tracking.',
        'order': 25
    },
    {
        'code': 'shift_swaps',
        'name': 'Shift Swaps',
        'category': 'Staff',
        'description': 'Peer-to-peer shift trade requests, educator acceptances, and manager authorization.',
        'order': 26
    },
    {
        'code': 'staff_shortages',
        'name': 'Staff Shortages Center',
        'category': 'Staff',
        'description': 'Live educator deficit forecasting, emergency call-in dispatch, and room coverage.',
        'order': 27
    },
    {
        'code': 'overtime_timebank',
        'name': 'Overtime & Time Bank',
        'category': 'Staff',
        'description': '1.5x overtime calculation, banked hours accrual, payout ledgers, and payroll liabilities.',
        'order': 28
    },
    {
        'code': 'credential_compliance',
        'name': 'ECE Credential Tracking',
        'category': 'Staff',
        'description': 'RECE registration, First Aid/CPR certs, criminal record checks, and automated expiry alerts.',
        'order': 29
    },

    # 4. Daily Care
    {
        'code': 'attendance',
        'name': 'Attendance',
        'category': 'Daily Care',
        'description': 'Classroom roll call, digital check-in/out, absence tagging, and meal counts.',
        'order': 30
    },
    {
        'code': 'safe_arrival',
        'name': 'Safe Arrival',
        'category': 'Daily Care',
        'description': 'Parent absence reporting, expected arrival monitoring, and automated safety alerts.',
        'order': 31
    },
    {
        'code': 'daily_reports',
        'name': 'Daily Reports',
        'category': 'Daily Care',
        'description': '16-section real-time activity logging: diaper/potty, naps, meals, snacks, fluid, medications, mood, and learning.',
        'order': 32
    },
    {
        'code': 'health_medication',
        'name': 'Health & Medication',
        'category': 'Daily Care',
        'description': 'Prescription administration records, allergy alerts, medical dosage logs, and authorizations.',
        'order': 33
    },
    {
        'code': 'incidents',
        'name': 'Incidents',
        'category': 'Daily Care',
        'description': 'Incident & injury logs, supervisor review, parent signature acknowledgment, and reporting.',
        'order': 34
    },
    {
        'code': 'attendance_command',
        'name': 'Attendance Command Center',
        'category': 'Daily Care',
        'description': 'Real-time check-in matrix, active center headcount, and emergency evacuation roster.',
        'order': 35
    },
    {
        'code': 'pickup_verification',
        'name': 'Pickup Verification',
        'category': 'Daily Care',
        'description': 'Authorized guardian list, digital QR passes, security PIN release, and custody audit logs.',
        'order': 36
    },
    {
        'code': 'daily_reports_history',
        'name': 'Daily Reports History',
        'category': 'Daily Care',
        'description': 'Historical activity feeds, photo attachments, milestones export, and educator note summaries.',
        'order': 37
    },

    # 5. Finance
    {
        'code': 'billing',
        'name': 'Billing',
        'category': 'Finance',
        'description': 'Invoice generator, automated recurring tuition billing runs, email invoices, and balance tracking.',
        'order': 40
    },
    {
        'code': 'payments',
        'name': 'Payments',
        'category': 'Finance',
        'description': 'Online credit/debit card processing, recorded manual cash/checks, automated receipts & refunds.',
        'order': 41
    },
    {
        'code': 'subsidies_cwelcc',
        'name': 'Subsidy Management',
        'category': 'Finance',
        'description': 'Canada-Wide Early Learning & Child Care calculations, co-pay tracking, and government claims.',
        'order': 42
    },
    {
        'code': 'tax_receipts',
        'name': 'Tax Receipts & Statements',
        'category': 'Finance',
        'description': 'Annual childcare income tax slips, year-end tuition statements, and PDF tax report generation.',
        'order': 43
    },
    {
        'code': 'fee_structures',
        'name': 'Fee Structures & Rates',
        'category': 'Finance',
        'description': 'Daily, weekly, and monthly tuition rate matrices, age tier pricing, and security deposit plans.',
        'order': 44
    },
    {
        'code': 'discounts_credits',
        'name': 'Discounts & Late Fees',
        'category': 'Finance',
        'description': 'Sibling discounts, staff discounts, promotional credits, and automated late pickup fee engine.',
        'order': 45
    },

    # 6. Communication
    {
        'code': 'communication',
        'name': 'Communication',
        'category': 'Communication',
        'description': 'Center-wide announcements, broadcast messages, classroom channels, and parent chats.',
        'order': 50
    },
    {
        'code': 'sms',
        'name': 'SMS',
        'category': 'Communication',
        'description': 'Instant SMS text alerts, emergency closure notifications, and direct cellular broadcasts.',
        'order': 51
    },

    # 7. Compliance
    {
        'code': 'compliance_reports',
        'name': 'Compliance',
        'category': 'Compliance',
        'description': 'Provincial compliance & inspection logs, ratio compliance audits, and regulatory archives.',
        'order': 60
    },
    {
        'code': 'gov_reporting',
        'name': 'Government Reporting',
        'category': 'Compliance',
        'description': 'Provincial ministry reporting, annual childcare census exports, and regulatory filings.',
        'order': 61
    },
    {
        'code': 'emergency_info',
        'name': 'Emergency Protocols',
        'category': 'Compliance',
        'description': 'Evacuation plans, emergency hospital routing, fire marshals, and critical emergency contacts.',
        'order': 62
    },
    {
        'code': 'holidays_closures',
        'name': 'Holidays & Closures',
        'category': 'Compliance',
        'description': 'Statutory holidays, staff training days, weather closures, and center calendar management.',
        'order': 63
    },
    {
        'code': 'document_manager',
        'name': 'Document Vault',
        'category': 'Compliance',
        'description': 'Secure cloud vault for daycare licenses, insurance policies, inspection reports, and child forms.',
        'order': 64
    },

    # 8. Reports
    {
        'code': 'reports',
        'name': 'Reports',
        'category': 'Reports',
        'description': 'Consolidated operational reports, daily attendance logs, and staff timesheet exports.',
        'order': 70
    },
    {
        'code': 'analytics',
        'name': 'Analytics',
        'category': 'Reports',
        'description': 'SaaS & operational analytics, enrollment growth metrics, revenue trends, and KPI charts.',
        'order': 71
    },
    {
        'code': 'attendance_reports',
        'name': 'Attendance Registries',
        'category': 'Reports',
        'description': 'Official monthly attendance registries, funding claim summaries, and exportable CSV/PDFs.',
        'order': 72
    },
    {
        'code': 'staff_reports',
        'name': 'Staff Payroll Reports',
        'category': 'Reports',
        'description': 'Staff worked hours, punctuality logs, overtime summary reports, and payroll exports.',
        'order': 73
    },
    {
        'code': 'attendance_audit_trail',
        'name': 'Attendance Audit Trail',
        'category': 'Reports',
        'description': 'Immutable correction logs, timestamp modifications, and administrator override history.',
        'order': 74
    }
]

def seed_features():
    print("=" * 60)
    print("SEEDING DATABASE-DRIVEN SUBSCRIPTION FEATURES")
    print("=" * 60)

    created_count = 0
    updated_count = 0
    all_feature_objs = []

    for item in FEATURES:
        feature, created = SubscriptionFeature.objects.update_or_create(
            code=item['code'],
            defaults={
                'name': item['name'],
                'category': item['category'],
                'description': item['description'],
                'order': item['order']
            }
        )
        all_feature_objs.append(feature)
        if created:
            created_count += 1
            print(f"  [Created] {feature.category} -> {feature.name} ({feature.code})")
        else:
            updated_count += 1
            print(f"  [Updated] {feature.category} -> {feature.name} ({feature.code})")

    print(f"\nTotal Features Seeded: {len(all_feature_objs)} (Created: {created_count}, Updated: {updated_count})")

    # Update default subscription tiers
    starter_codes = [
        'students', 'family_management', 'admissions_waitlist', 'waitlist',
        'classrooms', 'ratio_monitoring',
        'staff_management', 'staff_scheduling',
        'attendance', 'safe_arrival', 'daily_reports',
        'billing', 'payments',
        'communication',
        'reports'
    ]

    growth_codes = starter_codes + [
        'consent_forms', 'ratio_rules', 'age_groups', 'out_of_school',
        'staff_attendance', 'timesheet_approvals', 'leave_management', 'shift_swaps', 'credential_compliance',
        'attendance_command', 'pickup_verification', 'daily_reports_history',
        'fee_structures', 'discounts_credits',
        'emergency_info', 'holidays_closures', 'document_manager',
        'attendance_reports', 'staff_reports'
    ]

    enterprise_codes = [f.code for f in all_feature_objs]

    plans = SubscriptionPlan.objects.all()
    if not plans.exists():
        print("\nCreating default subscription tiers...")
        starter = SubscriptionPlan.objects.create(
            name='Starter Care',
            description='Essential daycare management for small centers and home daycares.',
            monthly_price=49.00,
            quarterly_price=135.00,
            annual_price=490.00,
            trial_days=14,
            status='Active',
            max_students=30,
            max_teachers=5,
            max_staff=10,
            max_classrooms=3,
            max_branches=1,
            max_storage_mb=1024
        )
        starter.features.set([f for f in all_feature_objs if f.code in starter_codes])

        growth = SubscriptionPlan.objects.create(
            name='Growth & Compliance',
            description='Full-featured platform with live ratio monitoring, staff scheduling, and admissions.',
            monthly_price=99.00,
            quarterly_price=270.00,
            annual_price=990.00,
            trial_days=14,
            status='Active',
            max_students=100,
            max_teachers=15,
            max_staff=25,
            max_classrooms=8,
            max_branches=2,
            max_storage_mb=5120
        )
        growth.features.set([f for f in all_feature_objs if f.code in growth_codes])

        enterprise = SubscriptionPlan.objects.create(
            name='Enterprise All-In-One',
            description='Complete operating system with CWELCC billing, CRA tax receipts, multi-branch, and audit logs.',
            monthly_price=179.00,
            quarterly_price=490.00,
            annual_price=1790.00,
            trial_days=30,
            status='Active',
            max_students=0,
            max_teachers=0,
            max_staff=0,
            max_classrooms=0,
            max_branches=-1,
            max_storage_mb=25600
        )
        enterprise.features.set(all_feature_objs)
        print("  [Created] Starter Care, Growth & Compliance, and Enterprise All-In-One plans.")
    else:
        print("\nConfiguring features on existing subscription plans...")
        for p in plans:
            p_name = p.name.lower()
            if 'starter' in p_name:
                p.features.set([f for f in all_feature_objs if f.code in starter_codes])
                print(f"  [Assigned] {len(starter_codes)} features to Starter tier: {p.name}")
            elif 'growth' in p_name:
                p.features.set([f for f in all_feature_objs if f.code in growth_codes])
                print(f"  [Assigned] {len(growth_codes)} features to Growth tier: {p.name}")
            else:
                p.features.set(all_feature_objs)
                print(f"  [Assigned] ALL {len(all_feature_objs)} features to Enterprise tier: {p.name}")

    print("\n" + "=" * 60)
    print("ALL DAYCARE FEATURES CONFIGURED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == '__main__':
    seed_features()
