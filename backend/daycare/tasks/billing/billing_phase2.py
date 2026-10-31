"""
Automated Test Suite for Module 16 Phase 2: Discounts, Sibling Discounts, Credit Ledger, Late Fees, and Master Billing Engine.
"""

from datetime import date, timedelta
from decimal import Decimal
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
    Guardian,
    FamilyGuardian,
    DaycareSettings,
    FeeStructure,
    ChildFeeAssignment,
    DiscountRule,
    SiblingDiscountRule,
    CreditTransaction,
    LateFeeRule,
    AuditLog,
)
from daycare.services.billing import BillingCalculationService, quantize_money

User = get_user_model()


class BillingPhase2TestCase(TestCase):
    def setUp(self):
        # Setup Daycare A
        self.daycare_a = Daycare.objects.create(name="Sunshine Early Learning", status="Active")
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
        self.branch_a = Branch.objects.create(daycare=self.daycare_a, name="Uptown Campus")
        self.age_group_toddler, _ = AgeGroup.objects.get_or_create(
            daycare=self.daycare_a,
            name="Toddler",
            defaults={'min_age_months': 12, 'max_age_months': 24}
        )
        self.age_group_infant, _ = AgeGroup.objects.get_or_create(
            daycare=self.daycare_a,
            name="Infant",
            defaults={'min_age_months': 0, 'max_age_months': 12}
        )

        self.program_toddler = Program.objects.create(daycare=self.daycare_a, name="Toddler Full Time", program_fee=Decimal('1200.00'))
        self.classroom_toddler = Classroom.objects.create(
            daycare=self.daycare_a,
            program=self.program_toddler,
            branch=self.branch_a,
            age_group=self.age_group_toddler,
            room_name="Yellow Ducklings"
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
        self.family_user_a = User.objects.create_user(
            username="parent_a",
            email="parent_a@example.com",
            password="password123"
        )

        # Family A with 3 siblings (Child 1: Eldest, Child 2: Middle, Child 3: Youngest)
        self.family_a = Family.objects.create(daycare=self.daycare_a, family_name="Johnson Family")
        self.guardian_a = Guardian.objects.create(
            daycare=self.daycare_a,
            user=self.family_user_a,
            first_name="Sarah",
            last_name="Johnson",
            email="sarah.johnson@example.com"
        )
        FamilyGuardian.objects.create(family=self.family_a, guardian=self.guardian_a, is_primary=True)

        # Child 1 (Eldest, DOB: 2022-01-10)
        self.child_1 = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            first_name="Emma",
            last_name="Johnson",
            dob=date(2022, 1, 10),
            admission_date=date(2025, 9, 1),
            status="Active"
        )
        FamilyChild.objects.create(family=self.family_a, student=self.child_1)
        self.enrollment_1 = ClassroomStudent.objects.create(
            classroom=self.classroom_toddler,
            student=self.child_1,
            start_date=date(2025, 9, 1),
            status="Active"
        )

        # Child 2 (Middle, DOB: 2023-06-15)
        self.child_2 = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            first_name="Noah",
            last_name="Johnson",
            dob=date(2023, 6, 15),
            admission_date=date(2026, 1, 1),
            status="Active"
        )
        FamilyChild.objects.create(family=self.family_a, student=self.child_2)
        self.enrollment_2 = ClassroomStudent.objects.create(
            classroom=self.classroom_toddler,
            student=self.child_2,
            start_date=date(2026, 1, 1),
            status="Active"
        )

        # Child 3 (Youngest, DOB: 2024-11-20)
        self.child_3 = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            first_name="Liam",
            last_name="Johnson",
            dob=date(2024, 11, 20),
            admission_date=date(2026, 3, 1),
            status="Active"
        )
        FamilyChild.objects.create(family=self.family_a, student=self.child_3)
        self.enrollment_3 = ClassroomStudent.objects.create(
            classroom=self.classroom_toddler,
            student=self.child_3,
            start_date=date(2026, 3, 1),
            status="Active"
        )

        # Setup Fee Structure in Daycare A
        self.fee_monthly = FeeStructure.objects.create(
            daycare=self.daycare_a,
            name="Toddler Standard Monthly",
            fee_type="MONTHLY",
            frequency="MONTHLY",
            amount=Decimal('1000.00'),
            currency="CAD",
            effective_from=date(2026, 1, 1),
            is_active=True,
            applies_to="ALL"
        )

        # Setup Daycare B for Multi-Tenant Isolation tests
        self.daycare_b = Daycare.objects.create(name="Starlight Academy", status="Active")
        self.admin_user_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@example.com",
            password="password123",
            daycare=self.daycare_b
        )
        self.family_b = Family.objects.create(daycare=self.daycare_b, family_name="Smith Family")

        self.client = APIClient()

    # =========================================================================
    # PART A & B: DISCOUNT MODEL & SCOPING APPLICATION
    # =========================================================================

    def test_percentage_discount_resolution(self):
        """Test percentage-based discount resolved properly for a child."""
        # 15% discount for Emma (Child 1)
        discount = DiscountRule.objects.create(
            daycare=self.daycare_a,
            name="15% Early Enrolment Discount",
            discount_type="PERCENTAGE",
            value=Decimal('15.00'),
            applies_to="STUDENT",
            student=self.child_1,
            effective_from=date(2026, 1, 1),
            is_active=True
        )

        res = BillingCalculationService.resolve_discounts_for_student(
            student=self.child_1,
            target_date=date(2026, 6, 1),
            base_amount=Decimal('1000.00')
        )

        self.assertEqual(res['base_amount'], Decimal('1000.00'))
        self.assertEqual(res['total_discount'], Decimal('150.00')) # 15% of 1000 = 150
        self.assertEqual(res['net_amount_after_discounts'], Decimal('850.00'))
        self.assertEqual(len(res['discounts']), 1)
        self.assertEqual(res['discounts'][0]['rule_id'], str(discount.id))

    def test_fixed_amount_discount_resolution_and_capping(self):
        """Test fixed dollar discount with boundary conditions (cannot exceed base fee)."""
        # $100 fixed discount for Classroom
        DiscountRule.objects.create(
            daycare=self.daycare_a,
            name="$100 Classroom Promotion",
            discount_type="FIXED",
            value=Decimal('100.00'),
            applies_to="CLASSROOM",
            classroom=self.classroom_toddler,
            effective_from=date(2026, 1, 1),
            is_active=True
        )

        res = BillingCalculationService.resolve_discounts_for_student(
            student=self.child_2,
            target_date=date(2026, 6, 1),
            base_amount=Decimal('500.00')
        )
        self.assertEqual(res['total_discount'], Decimal('100.00'))
        self.assertEqual(res['net_amount_after_discounts'], Decimal('400.00'))

        # Boundary test: $100 discount on a $75 fee should cap discount at $75, net = $0.00
        res_capped = BillingCalculationService.resolve_discounts_for_student(
            student=self.child_2,
            target_date=date(2026, 6, 1),
            base_amount=Decimal('75.00')
        )
        self.assertEqual(res_capped['total_discount'], Decimal('75.00'))
        self.assertEqual(res_capped['net_amount_after_discounts'], Decimal('0.00'))

    def test_discount_rule_versioning_and_historical_traceability(self):
        """PART D: Test discount rule versioning does NOT affect historical calculations."""
        orig_rule = DiscountRule.objects.create(
            daycare=self.daycare_a,
            name="Community Partnership Discount",
            discount_type="PERCENTAGE",
            value=Decimal('10.00'),
            applies_to="ALL",
            effective_from=date(2026, 1, 1),
            is_active=True,
            version=1
        )

        # Create new version with 15% starting Sep 1, 2026
        new_version = BillingCalculationService.create_new_discount_version(
            existing_rule=orig_rule,
            new_value=Decimal('15.00'),
            effective_from=date(2026, 9, 1),
            actor=self.admin_user_a,
            notes="Annual rate adjustment"
        )

        orig_rule.refresh_from_db()
        self.assertEqual(orig_rule.effective_until, date(2026, 8, 31))
        self.assertEqual(orig_rule.value, Decimal('10.00')) # Historical rate preserved
        self.assertEqual(new_version.version, 2)
        self.assertEqual(new_version.value, Decimal('15.00'))

        # Query on June 2026 -> 10%
        res_june = BillingCalculationService.resolve_discounts_for_student(
            student=self.child_1,
            target_date=date(2026, 6, 1),
            base_amount=Decimal('1000.00')
        )
        self.assertEqual(res_june['total_discount'], Decimal('100.00'))

        # Query on October 2026 -> 15%
        res_oct = BillingCalculationService.resolve_discounts_for_student(
            student=self.child_1,
            target_date=date(2026, 10, 1),
            base_amount=Decimal('1000.00')
        )
        self.assertEqual(res_oct['total_discount'], Decimal('150.00'))

    # =========================================================================
    # PART C: SIBLING DISCOUNT LOGIC & MULTIPLE SIBLINGS
    # =========================================================================

    def test_sibling_discount_subsequent_children_by_age(self):
        """Test sibling discount applying to 2nd and subsequent children ordered by age."""
        # 10% discount on 2nd and subsequent children
        SiblingDiscountRule.objects.create(
            daycare=self.daycare_a,
            name="10% Sibling Policy",
            discount_type="PERCENTAGE",
            value=Decimal('10.00'),
            applies_to_target="SUBSEQUENT_CHILDREN",
            target_fee_selection="EQUAL_APPLY",
            ordering_criteria="AGE_DESCENDING",
            min_enrolled_siblings=2,
            effective_from=date(2026, 1, 1),
            is_active=True
        )

        # 3 children: Child 1 (Emma: Eldest), Child 2 (Noah: Middle), Child 3 (Liam: Youngest)
        res = BillingCalculationService.resolve_sibling_discounts_for_family(
            family=self.family_a,
            daycare=self.daycare_a,
            target_date=date(2026, 6, 1),
            student_fee_map={
                str(self.child_1.id): Decimal('1000.00'),
                str(self.child_2.id): Decimal('1000.00'),
                str(self.child_3.id): Decimal('1000.00'),
            }
        )

        self.assertTrue(res['has_sibling_discount'])
        self.assertEqual(res['sibling_count'], 3)
        # Child 1 (Eldest) -> $0.00 discount
        self.assertEqual(res['discounts_by_student'][str(self.child_1.id)], Decimal('0.00'))
        # Child 2 (Middle) -> $100.00 discount (10% of $1000)
        self.assertEqual(res['discounts_by_student'][str(self.child_2.id)], Decimal('100.00'))
        # Child 3 (Youngest) -> $100.00 discount (10% of $1000)
        self.assertEqual(res['discounts_by_student'][str(self.child_3.id)], Decimal('100.00'))
        self.assertEqual(res['total_sibling_discount'], Decimal('200.00'))

    def test_sibling_discount_second_child_only_lowest_fee(self):
        """Test sibling discount applying only to the child with lowest fee."""
        SiblingDiscountRule.objects.create(
            daycare=self.daycare_a,
            name="Lowest Fee Sibling Policy",
            discount_type="FIXED",
            value=Decimal('150.00'),
            applies_to_target="SECOND_CHILD",
            target_fee_selection="LOWEST_FEE",
            min_enrolled_siblings=2,
            effective_from=date(2026, 1, 1),
            is_active=True
        )

        res = BillingCalculationService.resolve_sibling_discounts_for_family(
            family=self.family_a,
            daycare=self.daycare_a,
            target_date=date(2026, 6, 1),
            student_fee_map={
                str(self.child_1.id): Decimal('1200.00'),
                str(self.child_2.id): Decimal('800.00'), # Lowest fee
                str(self.child_3.id): Decimal('1000.00'),
            }
        )

        self.assertTrue(res['has_sibling_discount'])
        self.assertEqual(res['discounts_by_student'][str(self.child_2.id)], Decimal('150.00'))
        self.assertEqual(res['discounts_by_student'][str(self.child_1.id)], Decimal('0.00'))
        self.assertEqual(res['discounts_by_student'][str(self.child_3.id)], Decimal('0.00'))
        self.assertEqual(res['total_sibling_discount'], Decimal('150.00'))

    def test_sibling_discount_all_siblings_policy(self):
        """Test ALL_SIBLINGS policy where every child in the family gets discounted."""
        SiblingDiscountRule.objects.create(
            daycare=self.daycare_a,
            name="All Siblings 5% Policy",
            discount_type="PERCENTAGE",
            value=Decimal('5.00'),
            applies_to_target="ALL_SIBLINGS",
            min_enrolled_siblings=2,
            effective_from=date(2026, 1, 1),
            is_active=True
        )

        res = BillingCalculationService.resolve_sibling_discounts_for_family(
            family=self.family_a,
            daycare=self.daycare_a,
            target_date=date(2026, 6, 1),
            student_fee_map={
                str(self.child_1.id): Decimal('1000.00'),
                str(self.child_2.id): Decimal('1000.00'),
            }
        )
        self.assertEqual(res['discounts_by_student'][str(self.child_1.id)], Decimal('50.00'))
        self.assertEqual(res['discounts_by_student'][str(self.child_2.id)], Decimal('50.00'))
        self.assertEqual(res['total_sibling_discount'], Decimal('100.00'))

    # =========================================================================
    # PART E: CREDIT LEDGER, APPLICATIONS & REVERSALS
    # =========================================================================

    def test_credit_grant_application_and_balance_tracking(self):
        """PART E: Test credit ledger maintaining immutable transactions without destructive balance overwrite."""
        # 1. Initial balance should be 0
        bal0 = BillingCalculationService.get_family_credit_balance(self.family_a, self.daycare_a)
        self.assertEqual(bal0, Decimal('0.00'))

        # 2. Grant overpayment credit $200
        tx1 = BillingCalculationService.grant_family_credit(
            daycare=self.daycare_a,
            family=self.family_a,
            amount=Decimal('200.00'),
            reason="Overpayment on Invoice INV-001",
            reference="INV-001",
            actor=self.admin_user_a
        )
        self.assertEqual(tx1.transaction_type, 'CREDIT')
        self.assertEqual(BillingCalculationService.get_family_credit_balance(self.family_a, self.daycare_a), Decimal('200.00'))

        # 3. Grant administrative compensation credit $50
        tx2 = BillingCalculationService.grant_family_credit(
            daycare=self.daycare_a,
            family=self.family_a,
            amount=Decimal('50.00'),
            reason="Weather closure compensation",
            actor=self.admin_user_a
        )
        self.assertEqual(BillingCalculationService.get_family_credit_balance(self.family_a, self.daycare_a), Decimal('250.00'))

        # 4. Apply $150 credit towards billing
        tx_apply = BillingCalculationService.apply_family_credit(
            daycare=self.daycare_a,
            family=self.family_a,
            amount=Decimal('150.00'),
            reference="INV-002",
            actor=self.admin_user_a
        )
        self.assertEqual(tx_apply.transaction_type, 'CREDIT_APPLIED')
        self.assertEqual(BillingCalculationService.get_family_credit_balance(self.family_a, self.daycare_a), Decimal('100.00'))

        # 5. Over-application attempt must fail with ValueError
        with self.assertRaises(ValueError):
            BillingCalculationService.apply_family_credit(
                daycare=self.daycare_a,
                family=self.family_a,
                amount=Decimal('150.00'), # Only $100 available
                reference="INV-003",
                actor=self.admin_user_a
            )

    def test_credit_reversal(self):
        """PART E: Test credit reversal maintaining ledger history."""
        # Grant $100 credit
        tx = BillingCalculationService.grant_family_credit(
            daycare=self.daycare_a,
            family=self.family_a,
            amount=Decimal('100.00'),
            reason="Incorrect charge compensation",
            actor=self.admin_user_a
        )
        self.assertEqual(BillingCalculationService.get_family_credit_balance(self.family_a, self.daycare_a), Decimal('100.00'))

        # Reverse credit
        rev_tx = BillingCalculationService.reverse_family_credit(
            credit_transaction=tx,
            reason="Issued in error",
            actor=self.admin_user_a
        )
        self.assertEqual(rev_tx.transaction_type, 'CREDIT_REVERSAL')
        self.assertEqual(rev_tx.amount, Decimal('100.00'))

        tx.refresh_from_db()
        self.assertEqual(tx.status, 'REVERSED')
        self.assertEqual(BillingCalculationService.get_family_credit_balance(self.family_a, self.daycare_a), Decimal('0.00'))

        # Cannot reverse an already reversed credit
        with self.assertRaises(ValueError):
            BillingCalculationService.reverse_family_credit(
                credit_transaction=tx,
                reason="Duplicate attempt",
                actor=self.admin_user_a
            )

    # =========================================================================
    # PART F & G: LATE FEE & GRACE PERIOD RULES
    # =========================================================================

    def test_late_fee_grace_period_and_calculation(self):
        """PART F & G: Test grace period enforcement and late fee calculation."""
        # Rule: 5 days grace period, $25 fixed late fee
        rule = LateFeeRule.objects.create(
            daycare=self.daycare_a,
            name="Standard Late Fee Policy",
            fee_type="FIXED",
            amount=Decimal('25.00'),
            grace_period_days=5,
            frequency="ONE_TIME",
            effective_from=date(2026, 1, 1),
            is_active=True
        )

        due_date = date(2026, 6, 1)

        # 1. Evaluated on June 4 (3 days overdue -> within 5 days grace)
        res_within = BillingCalculationService.calculate_late_fee(
            daycare=self.daycare_a,
            due_date=due_date,
            overdue_balance=Decimal('500.00'),
            evaluation_date=date(2026, 6, 4)
        )
        self.assertFalse(res_within['has_late_fee'])
        self.assertTrue(res_within['within_grace_period'])
        self.assertEqual(res_within['late_fee_amount'], Decimal('0.00'))

        # 2. Evaluated on June 6 (5 days overdue -> exact last day of grace period)
        res_exact_grace = BillingCalculationService.calculate_late_fee(
            daycare=self.daycare_a,
            due_date=due_date,
            overdue_balance=Decimal('500.00'),
            evaluation_date=date(2026, 6, 6)
        )
        self.assertFalse(res_exact_grace['has_late_fee'])
        self.assertTrue(res_exact_grace['within_grace_period'])
        self.assertEqual(res_exact_grace['late_fee_amount'], Decimal('0.00'))

        # 3. Evaluated on June 7 (6 days overdue -> past grace period)
        res_past = BillingCalculationService.calculate_late_fee(
            daycare=self.daycare_a,
            due_date=due_date,
            overdue_balance=Decimal('500.00'),
            evaluation_date=date(2026, 6, 7)
        )
        self.assertTrue(res_past['has_late_fee'])
        self.assertFalse(res_past['within_grace_period'])
        self.assertEqual(res_past['late_fee_amount'], Decimal('25.00'))

    def test_late_fee_percentage_max_cap_and_duplication_prevention(self):
        """Test percentage late fee with maximum amount cap and duplication prevention."""
        # 10% late fee capped at $50.00 max, 2 days grace period
        rule = LateFeeRule.objects.create(
            daycare=self.daycare_a,
            name="10% Capped Late Fee",
            fee_type="PERCENTAGE",
            amount=Decimal('10.00'),
            grace_period_days=2,
            frequency="ONE_TIME",
            max_amount=Decimal('50.00'),
            effective_from=date(2026, 1, 1),
            is_active=True
        )

        due_date = date(2026, 6, 1)
        eval_date = date(2026, 6, 10) # 9 days overdue

        # Overdue balance $1,000 -> 10% would be $100, but capped at $50
        res = BillingCalculationService.calculate_late_fee(
            daycare=self.daycare_a,
            due_date=due_date,
            overdue_balance=Decimal('1000.00'),
            evaluation_date=eval_date
        )
        self.assertEqual(res['late_fee_amount'], Decimal('50.00'))

        # Duplicate check: if $50 already applied, subsequent check returns 0.00
        res_dup = BillingCalculationService.calculate_late_fee(
            daycare=self.daycare_a,
            due_date=due_date,
            overdue_balance=Decimal('1000.00'),
            evaluation_date=eval_date,
            already_applied_fee=Decimal('50.00')
        )
        self.assertEqual(res_dup['late_fee_amount'], Decimal('0.00'))
        self.assertFalse(res_dup['has_late_fee'])

    # =========================================================================
    # PART H: MASTER DETERMINISTIC BILLING CALCULATION ENGINE
    # =========================================================================

    def test_master_deterministic_billing_calculation_breakdown(self):
        """
        PART H: Test complete master calculation breakdown.
        Deterministic Order:
        Base Fees - Standard Discounts - Sibling Discounts = Subtotal - Credits + Late Fees = Final Due.
        """
        # Child 1: $1000 base - $100 student discount = $900
        DiscountRule.objects.create(
            daycare=self.daycare_a,
            name="Emma Merit Discount",
            discount_type="FIXED",
            value=Decimal('100.00'),
            applies_to="STUDENT",
            student=self.child_1,
            effective_from=date(2026, 1, 1),
            is_active=True
        )

        # Sibling discount: 10% on 2nd and subsequent children
        SiblingDiscountRule.objects.create(
            daycare=self.daycare_a,
            name="10% Sibling Policy",
            discount_type="PERCENTAGE",
            value=Decimal('10.00'),
            applies_to_target="SUBSEQUENT_CHILDREN",
            min_enrolled_siblings=2,
            effective_from=date(2026, 1, 1),
            is_active=True
        )

        # Family Credit balance: $300 available
        BillingCalculationService.grant_family_credit(
            daycare=self.daycare_a,
            family=self.family_a,
            amount=Decimal('300.00'),
            reason="Deposit balance credit",
            actor=self.admin_user_a
        )

        # Calculate Family Breakdown for 2 children (Child 1 & Child 2)
        breakdown = BillingCalculationService.calculate_family_billing_breakdown(
            family=self.family_a,
            daycare=self.daycare_a,
            target_date=date(2026, 6, 1),
            target_students=[self.child_1, self.child_2],
            apply_available_credits=True
        )

        summary = breakdown['summary']
        # Total Base Fees: $1000 + $1000 = $2000
        self.assertEqual(summary['total_base_fees'], Decimal('2000.00'))
        # Standard Discounts: $100 (Child 1)
        self.assertEqual(summary['total_standard_discounts'], Decimal('100.00'))
        # Sibling Discounts: $100 (10% of Child 2)
        self.assertEqual(summary['total_sibling_discounts'], Decimal('100.00'))
        # Total Discounts: $200
        self.assertEqual(summary['total_discounts'], Decimal('200.00'))
        # Subtotal After Discounts: $2000 - $200 = $1800
        self.assertEqual(summary['subtotal_after_discounts'], Decimal('1800.00'))
        # Applied Credits: $300 (full credit used)
        self.assertEqual(summary['applied_credits'], Decimal('300.00'))
        # Remaining Credit Balance: $0.00
        self.assertEqual(summary['remaining_credit_balance'], Decimal('0.00'))
        # Final Invoice / Prepared Amount: $1800 - $300 = $1500
        self.assertEqual(summary['final_invoice_amount'], Decimal('1500.00'))

    # =========================================================================
    # PART I, J, K: API ENDPOINTS, RBAC & TENANT ISOLATION
    # =========================================================================

    def test_discount_and_credit_api_endpoints_and_audit_logging(self):
        """Test API views for discounts and credits with RBAC and AuditLog creation."""
        self.client.force_authenticate(user=self.admin_user_a)

        # 1. Create Discount Rule via API
        disc_payload = {
            'name': 'Corporate Partner Discount',
            'discount_type': 'PERCENTAGE',
            'value': '12.50',
            'applies_to': 'ALL',
            'effective_from': '2026-01-01',
            'is_active': True
        }
        res_disc = self.client.post('/api/daycare/billing/discounts/', disc_payload, format='json')
        self.assertEqual(res_disc.status_code, status.HTTP_201_CREATED)
        disc_id = res_disc.data['id']

        # Verify AuditLog created
        self.assertTrue(
            AuditLog.objects.filter(
                action='CREATE_DISCOUNT_RULE',
                entity_type='DiscountRule',
                entity_id=disc_id
            ).exists()
        )

        # 2. Grant Family Credit via API
        credit_payload = {
            'family': str(self.family_a.id),
            'amount': '175.00',
            'reason': 'Customer satisfaction goodwill credit'
        }
        res_credit = self.client.post('/api/daycare/billing/credits/grant/', credit_payload, format='json')
        self.assertEqual(res_credit.status_code, status.HTTP_201_CREATED)
        credit_id = res_credit.data['id']

        # Verify Credit balance API
        res_bal = self.client.get(f'/api/daycare/billing/credits/balance/?family_id={self.family_a.id}')
        self.assertEqual(res_bal.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(res_bal.data['available_credit_balance'])), Decimal('175.00'))

        # 3. Reverse Credit via API
        res_rev = self.client.post(f'/api/daycare/billing/credits/{credit_id}/reverse/', {'reason': 'Issued to wrong family'}, format='json')
        self.assertEqual(res_rev.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rev.data['status'], 'reversed')

    def test_cross_daycare_tenant_isolation(self):
        """Test strict cross-daycare isolation: Daycare B admin cannot access Daycare A's billing data."""
        # Create Daycare A discount rule
        rule_a = DiscountRule.objects.create(
            daycare=self.daycare_a,
            name="Daycare A Secret Promo",
            discount_type="FIXED",
            value=Decimal('50.00'),
            applies_to="ALL",
            effective_from=date(2026, 1, 1)
        )

        # Authenticate as Daycare B Admin
        self.client.force_authenticate(user=self.admin_user_b)

        # Attempt to retrieve Daycare A's discount rule -> 404
        res_get = self.client.get(f'/api/daycare/billing/discounts/{rule_a.id}/')
        self.assertEqual(res_get.status_code, status.HTTP_404_NOT_FOUND)

        # Attempt to list discounts -> Daycare A's rule NOT present
        res_list = self.client.get('/api/daycare/billing/discounts/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        items = res_list.data if isinstance(res_list.data, list) else res_list.data.get('results', [])
        self.assertEqual(len(items), 0)

        # Attempt to grant credit to Daycare A's family using Daycare B credentials -> 404
        res_credit = self.client.post('/api/daycare/billing/credits/grant/', {
            'family': str(self.family_a.id),
            'amount': '100.00',
            'reason': 'Cross-tenant attempt'
        }, format='json')
        self.assertEqual(res_credit.status_code, status.HTTP_404_NOT_FOUND)

    def test_family_user_cannot_mutate_balances(self):
        """PART I: Family users have no permission to grant credits or configure discount rules."""
        self.client.force_authenticate(user=self.family_user_a)

        res_disc = self.client.post('/api/daycare/billing/discounts/', {
            'name': 'Hacked Discount',
            'value': '99.00'
        }, format='json')
        self.assertEqual(res_disc.status_code, status.HTTP_403_FORBIDDEN)

        res_credit = self.client.post('/api/daycare/billing/credits/grant/', {
            'family': str(self.family_a.id),
            'amount': '1000.00',
            'reason': 'Self credit'
        }, format='json')
        self.assertEqual(res_credit.status_code, status.HTTP_403_FORBIDDEN)
