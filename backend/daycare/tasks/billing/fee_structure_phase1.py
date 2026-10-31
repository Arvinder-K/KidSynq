"""
Automated Test Suite for Module 16 Phase 1: Fee Structure & Billing Configuration.
"""

from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Daycare,
    Branch,
    Program,
    Classroom,
    AgeGroup,
    Student,
    ClassroomStudent,
    Family,
    FamilyChild,
    DaycareSettings,
    FeeStructure,
    ChildFeeAssignment,
    RegistrationFeeRecord,
    DepositRecord,
    AuditLog,
)
from daycare.services.billing import BillingCalculationService, quantize_money

User = get_user_model()


class FeeStructurePhase1TestCase(TestCase):
    def setUp(self):
        # Setup Daycare A
        self.daycare_a = Daycare.objects.create(name="Sunshine Academy", status="Active")
        self.settings_a = DaycareSettings.objects.create(
            daycare=self.daycare_a,
            timezone="America/Toronto",
            date_format="YYYY-MM-DD",
            time_format="12h",
            currency="CAD",
            default_language="en",
            week_start_day="Monday",
            allow_parent_notifications=True,
            allow_staff_notifications=True,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
        self.branch_a = Branch.objects.create(daycare=self.daycare_a, name="Main Campus")
        self.age_group, _ = AgeGroup.objects.get_or_create(
            daycare=self.daycare_a,
            name="Toddler",
            defaults={'min_age_months': 12, 'max_age_months': 24}
        )
        self.program_a = Program.objects.create(daycare=self.daycare_a, name="Full-Time Toddler Care", program_fee=Decimal('1200.00'))
        self.classroom_a = Classroom.objects.create(
            daycare=self.daycare_a,
            program=self.program_a,
            branch=self.branch_a,
            age_group=self.age_group,
            room_name="Blue Birds Room"
        )

        # Users for Daycare A
        self.admin_user_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@example.com",
            password="password123",
            daycare=self.daycare_a
        )
        self.staff_user_a = User.objects.create_user(
            username="staff_a",
            email="staff_a@example.com",
            password="password123",
            daycare=self.daycare_a
        )

        # Student in Daycare A
        self.student_a = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            first_name="Lucas",
            last_name="Smith",
            dob=date(2023, 5, 10),
            status="Active"
        )
        self.family_a = Family.objects.create(daycare=self.daycare_a, family_name="Smith Family")
        FamilyChild.objects.create(family=self.family_a, student=self.student_a)
        self.enrollment_a = ClassroomStudent.objects.create(
            classroom=self.classroom_a,
            student=self.student_a,
            start_date=date(2026, 1, 1),
            status="Active"
        )

        # Setup Daycare B for Tenant Isolation tests
        self.daycare_b = Daycare.objects.create(name="Starlight Montessori", status="Active")
        self.admin_user_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@example.com",
            password="password123",
            daycare=self.daycare_b
        )

        self.client = APIClient()

    # 1. Decimal Precision & Quantization
    def test_decimal_precision_and_quantize_money(self):
        self.assertEqual(quantize_money(Decimal('100.555')), Decimal('100.56'))
        self.assertEqual(quantize_money(Decimal('100.554')), Decimal('100.55'))
        self.assertEqual(quantize_money(Decimal('0')), Decimal('0.00'))
        self.assertEqual(quantize_money(None), Decimal('0.00'))
        self.assertIsInstance(quantize_money('1250.75'), Decimal)

    # 2. FeeStructure Model CRUD & Types (PART A, B, C)
    def test_fee_structure_types_and_frequencies(self):
        fee_monthly = FeeStructure.objects.create(
            daycare=self.daycare_a,
            name="Infant Full-Time Monthly",
            fee_type="MONTHLY",
            frequency="MONTHLY",
            amount=Decimal('1350.00'),
            currency="CAD",
            effective_from=date(2026, 1, 1),
            is_active=True,
            applies_to="ALL"
        )
        self.assertEqual(str(fee_monthly.amount), '1350.00')
        self.assertEqual(fee_monthly.currency, 'CAD')
        self.assertTrue(fee_monthly.is_effective_on(date(2026, 6, 15)))

        fee_reg = FeeStructure.objects.create(
            daycare=self.daycare_a,
            name="Annual Registration Fee",
            fee_type="REGISTRATION",
            frequency="ONE_TIME",
            amount=Decimal('75.00'),
            currency="CAD",
            effective_from=date(2026, 1, 1),
            is_active=True
        )
        self.assertEqual(fee_reg.frequency, 'ONE_TIME')

        fee_hourly = FeeStructure.objects.create(
            daycare=self.daycare_a,
            name="Extended Hours Care",
            fee_type="HOURLY",
            frequency="HOURLY",
            amount=Decimal('15.50'),
            currency="CAD",
            effective_from=date(2026, 1, 1)
        )
        self.assertEqual(fee_hourly.fee_type, 'HOURLY')

    # 3. Effective Dates & Historical Pricing Versioning (PART D)
    def test_fee_structure_versioning_and_historical_preservation(self):
        original_fee = FeeStructure.objects.create(
            daycare=self.daycare_a,
            name="Toddler Monthly Fee",
            fee_type="MONTHLY",
            frequency="MONTHLY",
            amount=Decimal('1000.00'),
            currency="CAD",
            effective_from=date(2026, 1, 1),
            is_active=True,
            version=1
        )

        # Create new version starting Sep 1, 2026 with $1,100
        new_version = BillingCalculationService.create_new_fee_version(
            existing_fee=original_fee,
            new_amount=Decimal('1100.00'),
            effective_from=date(2026, 9, 1),
            actor=self.admin_user_a,
            notes="Annual rate revision"
        )

        original_fee.refresh_from_db()
        self.assertEqual(original_fee.effective_until, date(2026, 8, 31))
        self.assertEqual(original_fee.amount, Decimal('1000.00')) # Historical amount UNCHANGED

        self.assertEqual(new_version.version, 2)
        self.assertEqual(new_version.amount, Decimal('1100.00'))
        self.assertEqual(new_version.effective_from, date(2026, 9, 1))
        self.assertIsNone(new_version.effective_until)
        self.assertEqual(new_version.parent_fee, original_fee)

        # Verify historical dates resolution
        self.assertTrue(original_fee.is_effective_on(date(2026, 5, 10)))
        self.assertFalse(original_fee.is_effective_on(date(2026, 9, 5)))
        self.assertTrue(new_version.is_effective_on(date(2026, 9, 5)))

    # 4. Registration Fee Duplicate Prevention (PART E)
    def test_registration_fee_record_duplicate_prevention(self):
        reg_fee = FeeStructure.objects.create(
            daycare=self.daycare_a,
            name="New Enrolment Fee",
            fee_type="REGISTRATION",
            frequency="ONE_TIME",
            amount=Decimal('100.00'),
            currency="CAD",
            effective_from=date(2026, 1, 1)
        )

        # First recording
        res1 = BillingCalculationService.record_or_check_registration_fee(
            daycare=self.daycare_a,
            student=self.student_a,
            fee_structure=reg_fee,
            actor=self.admin_user_a
        )
        self.assertTrue(res1['created'])
        self.assertFalse(res1['already_exists'])
        self.assertEqual(res1['status'], 'PENDING')

        # Second recording attempt -> Must NOT duplicate
        res2 = BillingCalculationService.record_or_check_registration_fee(
            daycare=self.daycare_a,
            student=self.student_a,
            fee_structure=reg_fee,
            actor=self.admin_user_a
        )
        self.assertFalse(res2['created'])
        self.assertTrue(res2['already_exists'])
        self.assertEqual(RegistrationFeeRecord.objects.filter(daycare=self.daycare_a, student=self.student_a).count(), 1)

    # 5. Deposit Lifecycle (PART F)
    def test_deposit_lifecycle_charged_held_applied_refunded(self):
        deposit = DepositRecord.objects.create(
            daycare=self.daycare_a,
            student=self.student_a,
            amount_charged=Decimal('500.00'),
            currency="CAD",
            status="CHARGED",
            created_by=self.admin_user_a
        )
        self.assertEqual(deposit.remaining_held, Decimal('0.00'))

        # 1. Receive deposit into trust
        BillingCalculationService.process_deposit_action(
            deposit_record=deposit,
            action_type='RECEIVE_DEPOSIT',
            amount=Decimal('500.00'),
            actor=self.admin_user_a
        )
        deposit.refresh_from_db()
        self.assertEqual(deposit.status, 'HELD')
        self.assertEqual(deposit.amount_held, Decimal('500.00'))
        self.assertEqual(deposit.remaining_held, Decimal('500.00'))

        # 2. Apply $200 towards childcare invoice
        BillingCalculationService.process_deposit_action(
            deposit_record=deposit,
            action_type='APPLY_TO_BILLING',
            amount=Decimal('200.00'),
            actor=self.admin_user_a
        )
        deposit.refresh_from_db()
        self.assertEqual(deposit.status, 'PARTIALLY_APPLIED')
        self.assertEqual(deposit.amount_applied, Decimal('200.00'))
        self.assertEqual(deposit.remaining_held, Decimal('300.00'))

        # 3. Refund $300 to parent upon graduation
        BillingCalculationService.process_deposit_action(
            deposit_record=deposit,
            action_type='REFUND_DEPOSIT',
            amount=Decimal('300.00'),
            actor=self.admin_user_a
        )
        deposit.refresh_from_db()
        self.assertEqual(deposit.status, 'REFUNDED')
        self.assertEqual(deposit.remaining_held, Decimal('0.00'))

    # 6. Child Fee Assignment & Custom Rates (PART G)
    def test_child_fee_assignment_and_resolution_hierarchy(self):
        default_fee = FeeStructure.objects.create(
            daycare=self.daycare_a,
            name="General Monthly Fee",
            fee_type="MONTHLY",
            frequency="MONTHLY",
            amount=Decimal('1000.00'),
            currency="CAD",
            effective_from=date(2026, 1, 1),
            applies_to="ALL"
        )

        # 1. Without custom assignment -> Resolves Daycare Default
        resolved = BillingCalculationService.resolve_effective_fee_for_student(self.student_a, date(2026, 3, 1))
        self.assertEqual(resolved['effective_amount'], Decimal('1000.00'))
        self.assertEqual(resolved['source'], 'DAYCARE_DEFAULT')

        # 2. Add custom assignment with 15% discount
        assignment = ChildFeeAssignment.objects.create(
            daycare=self.daycare_a,
            student=self.student_a,
            fee_structure=default_fee,
            discount_percentage=Decimal('15.00'),
            discount_reason="Staff child subsidy",
            currency="CAD",
            effective_from=date(2026, 1, 1),
            is_active=True
        )
        self.assertEqual(assignment.effective_rate, Decimal('850.00'))

        # Now resolution picks CUSTOM_ASSIGNMENT
        resolved2 = BillingCalculationService.resolve_effective_fee_for_student(self.student_a, date(2026, 3, 1))
        self.assertEqual(resolved2['source'], 'CUSTOM_ASSIGNMENT')
        self.assertEqual(resolved2['effective_amount'], Decimal('850.00'))

    # 7. Prorated Monthly Calculation
    def test_prorated_monthly_calculation(self):
        res = BillingCalculationService.calculate_prorated_monthly_fee(
            monthly_amount=Decimal('1000.00'),
            start_date=date(2026, 4, 16), # April has 30 days. 16-30 is 15 days -> exactly 50% = 500.00
            end_date=None,
            year=2026,
            month=4
        )
        self.assertTrue(res['is_prorated'])
        self.assertEqual(res['enrolled_days'], 15)
        self.assertEqual(res['days_in_month'], 30)
        self.assertEqual(res['prorated_amount'], Decimal('500.00'))

    # 8. Sibling Discount Calculation
    def test_sibling_discount_calculation(self):
        # 1st child -> no discount
        res1 = BillingCalculationService.calculate_sibling_discount(Decimal('1000.00'), sibling_count_in_daycare=1)
        self.assertFalse(res1['has_discount'])
        self.assertEqual(res1['final_amount'], Decimal('1000.00'))

        # 2nd child -> 10% discount
        res2 = BillingCalculationService.calculate_sibling_discount(Decimal('1000.00'), sibling_count_in_daycare=2, sibling_discount_percentage=Decimal('10.00'))
        self.assertTrue(res2['has_discount'])
        self.assertEqual(res2['discount_amount'], Decimal('100.00'))
        self.assertEqual(res2['final_amount'], Decimal('900.00'))

    # 9. Tenant Isolation & Permissions (PART K)
    def test_tenant_isolation_daycare_admin_endpoints(self):
        fee_a = FeeStructure.objects.create(
            daycare=self.daycare_a,
            name="Daycare A Exclusive Fee",
            fee_type="MONTHLY",
            frequency="MONTHLY",
            amount=Decimal('1200.00'),
            currency="CAD",
            effective_from=date(2026, 1, 1)
        )
        fee_b = FeeStructure.objects.create(
            daycare=self.daycare_b,
            name="Daycare B Exclusive Fee",
            fee_type="MONTHLY",
            frequency="MONTHLY",
            amount=Decimal('1400.00'),
            currency="CAD",
            effective_from=date(2026, 1, 1)
        )

        # Login as Admin A
        self.client.force_authenticate(user=self.admin_user_a)
        response = self.client.get('/api/daycare/billing/fee-structures/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        ids = [str(item['id']) for item in results]
        self.assertIn(str(fee_a.id), ids)
        self.assertNotIn(str(fee_b.id), ids) # Daycare B fee NOT visible!

        # Attempt to modify Daycare B fee -> 404
        patch_res = self.client.patch(f'/api/daycare/billing/fee-structures/{fee_b.id}/', {'amount': '999.00'})
        self.assertEqual(patch_res.status_code, status.HTTP_404_NOT_FOUND)

    # 10. Audit Logging (PART L)
    def test_audit_logging_on_fee_creation_and_actions(self):
        self.client.force_authenticate(user=self.admin_user_a)
        payload = {
            'name': 'API Created Fee',
            'fee_type': 'MONTHLY',
            'frequency': 'MONTHLY',
            'amount': '1150.00',
            'currency': 'CAD',
            'effective_from': '2026-06-01',
            'is_active': True,
            'applies_to': 'ALL'
        }
        res = self.client.post('/api/daycare/billing/fee-structures/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Verify AuditLog entry was recorded
        audit = AuditLog.objects.filter(
            action='CREATE_FEE_STRUCTURE',
            entity_type='FeeStructure',
            user=self.admin_user_a
        ).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.new_values['name'], 'API Created Fee')
