import datetime
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Daycare,
    Student,
    Family,
    Guardian,
    FamilyGuardian,
    FamilyChild,
    FeeStructure,
    ChildFeeAssignment,
    RegistrationFeeRecord,
    DepositRecord,
    DiscountRule,
    SiblingDiscountRule,
    CreditTransaction,
    LateFeeRule,
    Invoice,
    InvoiceItem,
    Payment,
    RecurringBillingProfile,
    StudentAttendance,
    Branch,
    AuditLog
)
from daycare.services.billing import BillingCalculationService, quantize_money

User = get_user_model()


class BillingPhase3Tests(TestCase):
    def setUp(self):
        # Create Daycares
        self.daycare = Daycare.objects.create(name="Sunshine Academy", address1="123 Sunny St")
        self.other_daycare = Daycare.objects.create(name="Star Daycare", address1="456 Star Rd")

        # Create Users
        self.admin_user = User.objects.create_user(
            username="admin_user",
            email="admin@sunshine.test",
            password="Password123!",
            daycare=self.daycare
        )
        self.other_admin_user = User.objects.create_user(
            username="other_admin",
            email="admin@star.test",
            password="Password123!",
            daycare=self.other_daycare
        )
        self.guardian_user = User.objects.create_user(
            username="guardian_user",
            email="guardian@family.test",
            password="Password123!",
            daycare=self.daycare
        )

        # Create Family and Guardian profile
        self.guardian = Guardian.objects.create(
            daycare=self.daycare,
            user=self.guardian_user,
            first_name="Jane",
            last_name="Doe",
            email="guardian@family.test",
            phone="555-0199"
        )
        self.family = Family.objects.create(
            daycare=self.daycare,
            family_name="Doe Family"
        )
        FamilyGuardian.objects.create(
            family=self.family,
            guardian=self.guardian,
            relationship="Mother",
            is_primary=True
        )

        # Create Students
        self.child1 = Student.objects.create(
            daycare=self.daycare,
            first_name="Tommy",
            last_name="Doe",
            dob=datetime.date(2022, 5, 10),
            admission_date=datetime.date(2025, 1, 1),
            status="Active"
        )
        self.child2 = Student.objects.create(
            daycare=self.daycare,
            first_name="Lily",
            last_name="Doe",
            dob=datetime.date(2023, 8, 15),
            admission_date=datetime.date(2025, 1, 1),
            status="Active"
        )
        FamilyChild.objects.create(family=self.family, student=self.child1)
        FamilyChild.objects.create(family=self.family, student=self.child2)

        # Create Fee Structures
        self.monthly_fee = FeeStructure.objects.create(
            daycare=self.daycare,
            name="Infant Full-Time Monthly",
            fee_type="MONTHLY",
            frequency="MONTHLY",
            amount=Decimal("1200.00"),
            currency="CAD",
            effective_from=datetime.date(2025, 1, 1),
            is_active=True
        )
        self.daily_fee = FeeStructure.objects.create(
            daycare=self.daycare,
            name="Drop-In Daily Care",
            fee_type="DAILY",
            frequency="DAILY",
            amount=Decimal("60.00"),
            currency="CAD",
            effective_from=datetime.date(2025, 1, 1),
            is_active=True
        )
        self.hourly_fee = FeeStructure.objects.create(
            daycare=self.daycare,
            name="Extended Hourly Care",
            fee_type="HOURLY",
            frequency="HOURLY",
            amount=Decimal("15.00"),
            currency="CAD",
            effective_from=datetime.date(2025, 1, 1),
            is_active=True
        )
        self.reg_fee = FeeStructure.objects.create(
            daycare=self.daycare,
            name="Annual Registration Fee",
            fee_type="REGISTRATION",
            frequency="ONE_TIME",
            amount=Decimal("150.00"),
            currency="CAD",
            effective_from=datetime.date(2025, 1, 1),
            is_active=True
        )

        # Assign child fees
        ChildFeeAssignment.objects.create(
            daycare=self.daycare,
            student=self.child1,
            fee_structure=self.monthly_fee,
            is_active=True,
            effective_from=datetime.date(2025, 1, 1)
        )
        ChildFeeAssignment.objects.create(
            daycare=self.daycare,
            student=self.child2,
            fee_structure=self.monthly_fee,
            is_active=True,
            effective_from=datetime.date(2025, 1, 1)
        )

        # Clients
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin_user)

        self.guardian_client = APIClient()
        self.guardian_client.force_authenticate(user=self.guardian_user)

        self.other_admin_client = APIClient()
        self.other_admin_client.force_authenticate(user=self.other_admin_user)

    def test_01_historical_pricing_snapshot(self):
        """
        Test that invoice line items freeze the rate snapshot at creation time,
        and subsequent fee structure edits do not alter the invoice total or line items.
        """
        issue_date = datetime.date(2026, 9, 1)
        inv = BillingCalculationService.create_student_invoice(
            daycare=self.daycare,
            student=self.child1,
            billing_period_start=datetime.date(2026, 9, 1),
            billing_period_end=datetime.date(2026, 9, 30),
            issue_date=issue_date,
            actor=self.admin_user
        )

        self.assertEqual(inv.total, Decimal("1200.00"))
        self.assertEqual(inv.items.count(), 1)
        item = inv.items.first()
        self.assertEqual(item.unit_price, Decimal("1200.00"))
        self.assertEqual(item.rate_snapshot.get('unit_price'), "1200.00")

        # Now update FeeStructure to $1500.00 and deactivate it
        self.monthly_fee.amount = Decimal("1500.00")
        self.monthly_fee.is_active = False
        self.monthly_fee.save()

        # Refresh invoice from db and verify snapshot didn't change
        inv.refresh_from_db()
        self.assertEqual(inv.total, Decimal("1200.00"))
        item.refresh_from_db()
        self.assertEqual(item.unit_price, Decimal("1200.00"))

    def test_02_registration_invoice_generation_and_duplicate_prevention(self):
        """
        Test generating a one-time registration invoice and checking duplicate prevention.
        """
        inv = BillingCalculationService.generate_registration_invoice(
            daycare=self.daycare,
            student=self.child1,
            fee_structure=self.reg_fee,
            issue_date=datetime.date(2026, 9, 1),
            actor=self.admin_user
        )
        self.assertEqual(inv.invoice_type, 'REGISTRATION')
        self.assertEqual(inv.total, Decimal("1500.00") if self.reg_fee.amount == Decimal("1500.00") else Decimal("150.00"))
        self.assertEqual(inv.items.first().fee_type_code, 'REGISTRATION')

        # Check RegistrationFeeRecord was created
        reg_record = RegistrationFeeRecord.objects.filter(student=self.child1).first()
        self.assertIsNotNone(reg_record)
        self.assertEqual(reg_record.status, 'INVOICED')

        # Attempting to generate again should raise ValueError
        with self.assertRaises(ValueError):
            BillingCalculationService.generate_registration_invoice(
                daycare=self.daycare,
                student=self.child1,
                fee_structure=self.reg_fee,
                issue_date=datetime.date(2026, 9, 2),
                actor=self.admin_user
            )

    def test_03_attendance_based_daily_and_hourly_billing(self):
        """
        Test billing calculation from actual student attendance records (daily and hourly).
        """
        # Create attendance records for child1: 3 days present, 8 hours each = 24 hours total
        p_start = datetime.date(2026, 9, 1)
        p_end = datetime.date(2026, 9, 5)

        for day_offset in [1, 2, 3]:
            att_date = datetime.date(2026, 9, day_offset)
            StudentAttendance.objects.create(
                daycare=self.daycare,
                student=self.child1,
                attendance_date=att_date,
                attendance_status='PRESENT',
                check_in_time=datetime.time(8, 0),
                check_out_time=datetime.time(16, 0)
            )

        # 1. Daily calculation: 3 days * $60 = $180
        daily_res = BillingCalculationService.calculate_attendance_based_fee(
            student=self.child1,
            fee_structure=self.daily_fee,
            period_start=p_start,
            period_end=p_end
        )
        self.assertEqual(daily_res['units'], Decimal("3"))
        self.assertEqual(daily_res['amount'], Decimal("180.00"))

        # 2. Hourly calculation: 3 days * 8h = 24 hours * $15 = $360
        hourly_res = BillingCalculationService.calculate_attendance_based_fee(
            student=self.child1,
            fee_structure=self.hourly_fee,
            period_start=p_start,
            period_end=p_end
        )
        self.assertEqual(hourly_res['units'], Decimal("24.00"))
        self.assertEqual(hourly_res['amount'], Decimal("360.00"))

    def test_04_sibling_discount_on_family_invoice(self):
        """
        Test that a sibling discount rule applies automatically to the second child on a family invoice.
        """
        # 10% discount on second child (ELDEST_FIRST means second oldest child gets discount)
        SiblingDiscountRule.objects.create(
            daycare=self.daycare,
            name="10% Sibling Discount",
            discount_type="PERCENTAGE",
            value=Decimal("10.00"),
            applies_to_target="SECOND_CHILD_ONWARDS",
            ordering_criteria="ELDEST_FIRST",
            effective_from=datetime.date(2025, 1, 1),
            is_active=True
        )

        inv = BillingCalculationService.create_family_invoice(
            daycare=self.daycare,
            family=self.family,
            billing_period_start=datetime.date(2026, 9, 1),
            billing_period_end=datetime.date(2026, 9, 30),
            issue_date=datetime.date(2026, 9, 1),
            actor=self.admin_user
        )

        # Child 1: $1200.00, Child 2: $1200.00 - 10% ($120.00) = $1080.00
        # Subtotal: $2400.00, Discount: $120.00, Total: $2280.00
        self.assertEqual(inv.subtotal, Decimal("2400.00"))
        self.assertEqual(inv.discount_total, Decimal("120.00"))
        self.assertEqual(inv.total, Decimal("2280.00"))
        self.assertEqual(inv.balance_due, Decimal("2280.00"))

    def test_05_credit_ledger_auto_application_and_manual_application(self):
        """
        Test granting credit to a family and applying it to an invoice.
        """
        # Grant $200 credit to family
        CreditTransaction.objects.create(
            daycare=self.daycare,
            family=self.family,
            amount=Decimal("200.00"),
            transaction_type="CREDIT",
            status="ACTIVE",
            reason="Early signup bonus"
        )
        self.assertEqual(BillingCalculationService.get_family_credit_balance(self.family, self.daycare), Decimal("200.00"))

        # Create invoice with auto-apply credits
        inv = BillingCalculationService.create_student_invoice(
            daycare=self.daycare,
            student=self.child1,
            billing_period_start=datetime.date(2026, 9, 1),
            billing_period_end=datetime.date(2026, 9, 30),
            issue_date=datetime.date(2026, 9, 1),
            apply_available_credits=True,
            actor=self.admin_user
        )

        # Total: $1200.00, Credit applied: $200.00, Balance due: $1000.00
        self.assertEqual(inv.total, Decimal("1200.00"))
        self.assertEqual(inv.credit_total, Decimal("200.00"))
        self.assertEqual(inv.balance_due, Decimal("1000.00"))
        self.assertEqual(inv.status, 'PARTIALLY_PAID')

        # Verify ledger balance is now 0
        self.assertEqual(BillingCalculationService.get_family_credit_balance(self.family, self.daycare), Decimal("0.00"))

    def test_06_held_deposit_application(self):
        """
        Test applying a held security deposit to an invoice.
        """
        # Create a held deposit record of $500
        dep = DepositRecord.objects.create(
            daycare=self.daycare,
            family=self.family,
            student=self.child1,
            amount_charged=Decimal("500.00"),
            amount_held=Decimal("500.00"),
            amount_applied=Decimal("0.00"),
            status="HELD"
        )

        inv = BillingCalculationService.create_student_invoice(
            daycare=self.daycare,
            student=self.child1,
            billing_period_start=datetime.date(2026, 9, 1),
            billing_period_end=datetime.date(2026, 9, 30),
            issue_date=datetime.date(2026, 9, 1),
            apply_available_deposits=True,
            actor=self.admin_user
        )

        self.assertEqual(inv.deposit_applied_total, Decimal("500.00"))
        self.assertEqual(inv.balance_due, Decimal("700.00"))

        dep.refresh_from_db()
        self.assertEqual(dep.amount_applied, Decimal("500.00"))
        self.assertEqual(dep.status, "FULLY_APPLIED")

    def test_07_late_fee_assessment(self):
        """
        Test assessing late fees on an overdue invoice.
        """
        LateFeeRule.objects.create(
            daycare=self.daycare,
            name="Standard Late Fee",
            fee_type="FIXED_AMOUNT",
            amount=Decimal("50.00"),
            grace_period_days=5,
            is_active=True
        )

        inv = BillingCalculationService.create_student_invoice(
            daycare=self.daycare,
            student=self.child1,
            billing_period_start=datetime.date(2026, 8, 1),
            billing_period_end=datetime.date(2026, 8, 31),
            issue_date=datetime.date(2026, 8, 1),
            due_date=datetime.date(2026, 8, 5),
            actor=self.admin_user
        )

        # Issue the invoice
        inv = BillingCalculationService.issue_invoice(inv, actor=self.admin_user)

        # Evaluate on Aug 15 (10 days past due, exceeds 5-day grace period)
        eval_date = datetime.date(2026, 8, 15)
        inv = BillingCalculationService.assess_late_fee_on_invoice(inv, evaluation_date=eval_date, actor=self.admin_user)

        self.assertEqual(inv.status, 'OVERDUE')
        self.assertEqual(inv.late_fee_total, Decimal("50.00"))
        self.assertEqual(inv.total, Decimal("1250.00"))
        self.assertEqual(inv.balance_due, Decimal("1250.00"))

    def test_08_recurring_billing_profile_execution_and_duplicate_prevention(self):
        """
        Test recurring billing profile run, advancing next_billing_date and duplicate prevention.
        """
        profile = RecurringBillingProfile.objects.create(
            daycare=self.daycare,
            profile_name="Tommy Monthly Advance",
            family=self.family,
            student=self.child1,
            fee_structure=self.monthly_fee,
            frequency="MONTHLY",
            billing_basis="CALENDAR_ADVANCE",
            next_billing_date=datetime.date(2026, 9, 1),
            is_active=True
        )

        # Process recurring billing run
        results = BillingCalculationService.process_recurring_billing_run(
            daycare=self.daycare,
            target_date=datetime.date(2026, 9, 1),
            profile=profile,
            actor=self.admin_user
        )

        self.assertEqual(results['total_profiles_processed'], 1)
        self.assertEqual(results['total_invoices_generated'], 1)

        # Verify next billing date advanced to Oct 1, 2026
        profile.refresh_from_db()
        self.assertEqual(profile.next_billing_date, datetime.date(2026, 10, 1))

        # Trying to run again for Sep 1 should process 0 profiles (next_billing_date is Oct 1)
        results2 = BillingCalculationService.process_recurring_billing_run(
            daycare=self.daycare,
            target_date=datetime.date(2026, 9, 1),
            profile=profile,
            actor=self.admin_user
        )
        self.assertEqual(results2['total_invoices_generated'], 0)

    def test_09_void_invoice_restores_credit_and_deposit(self):
        """
        Test that voiding an invoice restores applied ledger credit balances and deposit amounts.
        """
        # Grant $100 credit
        CreditTransaction.objects.create(
            daycare=self.daycare,
            family=self.family,
            amount=Decimal("100.00"),
            transaction_type="CREDIT",
            status="ACTIVE",
            reason="Promo"
        )
        dep = DepositRecord.objects.create(
            daycare=self.daycare,
            family=self.family,
            student=self.child1,
            amount_charged=Decimal("300.00"),
            amount_held=Decimal("300.00"),
            amount_applied=Decimal("0.00"),
            status="HELD"
        )

        inv = BillingCalculationService.create_student_invoice(
            daycare=self.daycare,
            student=self.child1,
            billing_period_start=datetime.date(2026, 9, 1),
            billing_period_end=datetime.date(2026, 9, 30),
            issue_date=datetime.date(2026, 9, 1),
            apply_available_credits=True,
            apply_available_deposits=True,
            actor=self.admin_user
        )

        self.assertEqual(inv.credit_total, Decimal("100.00"))
        self.assertEqual(inv.deposit_applied_total, Decimal("300.00"))
        self.assertEqual(BillingCalculationService.get_family_credit_balance(self.family, self.daycare), Decimal("0.00"))

        # Void invoice
        BillingCalculationService.void_invoice(inv, reason="Incorrect period", actor=self.admin_user)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'VOID')

        # Credit balance should be restored back to $100
        self.assertEqual(BillingCalculationService.get_family_credit_balance(self.family, self.daycare), Decimal("100.00"))

        # Deposit record should be restored to HELD with 0 applied
        dep.refresh_from_db()
        self.assertEqual(dep.amount_applied, Decimal("0.00"))
        self.assertEqual(dep.status, 'HELD')

    def test_10_rest_api_daycare_admin_crud_and_actions(self):
        """
        Test Daycare Admin REST API for listing, creating, issuing, voiding, and fetching stats.
        """
        # Create draft invoice via API
        payload = {
            'student': str(self.child1.id),
            'family': str(self.family.id),
            'issue_date': '2026-09-01',
            'due_date': '2026-09-15',
            'billing_period_start': '2026-09-01',
            'billing_period_end': '2026-09-30',
            'items': [
                {
                    'fee_structure': str(self.monthly_fee.id),
                    'description': 'Infant Full-Time Care',
                    'quantity': '1.00',
                    'unit_price': '1200.00',
                    'discount_amount': '0.00',
                    'tax_amount': '0.00',
                    'subtotal': '1200.00'
                }
            ]
        }
        res = self.admin_client.post('/api/daycare/billing/invoices/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        invoice_id = res.data['id']
        self.assertEqual(res.data['status'], 'DRAFT')
        self.assertEqual(res.data['total'], '1200.00')

        # Issue invoice via action
        issue_res = self.admin_client.post(f'/api/daycare/billing/invoices/{invoice_id}/issue/')
        self.assertEqual(issue_res.status_code, status.HTTP_200_OK)
        self.assertEqual(issue_res.data['status'], 'ISSUED')

        # Check stats endpoint
        stats_res = self.admin_client.get('/api/daycare/billing/invoices/stats/')
        self.assertEqual(stats_res.status_code, status.HTTP_200_OK)
        self.assertEqual(stats_res.data['counts']['issued'], 1)
        self.assertEqual(stats_res.data['total_outstanding'], '1200.00')

        # Void invoice via action
        void_res = self.admin_client.post(f'/api/daycare/billing/invoices/{invoice_id}/void/', {'reason': 'Parent relocated'}, format='json')
        self.assertEqual(void_res.status_code, status.HTTP_200_OK)
        self.assertEqual(void_res.data['status'], 'VOID')

    def test_11_rest_api_multi_tenant_isolation(self):
        """
        Test that Daycare Admin from Daycare A cannot see or manipulate Invoices from Daycare B.
        """
        # Create invoice in Daycare A
        inv_a = BillingCalculationService.create_student_invoice(
            daycare=self.daycare,
            student=self.child1,
            billing_period_start=datetime.date(2026, 9, 1),
            billing_period_end=datetime.date(2026, 9, 30),
            issue_date=datetime.date(2026, 9, 1),
            actor=self.admin_user
        )

        res = self.other_admin_client.get('/api/daycare/billing/invoices/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        items = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        ids = [item['id'] for item in items]
        self.assertNotIn(str(inv_a.id), ids)

        # Admin B tries to issue invoice A -> 404
        issue_res = self.other_admin_client.post(f'/api/daycare/billing/invoices/{inv_a.id}/issue/')
        self.assertEqual(issue_res.status_code, status.HTTP_404_NOT_FOUND)

    def test_12_family_portal_authorization_and_draft_exclusion(self):
        """
        Test that Guardian can only see their own family/children invoices,
        cannot see DRAFT invoices, and gets 403 on Daycare Admin billing routes.
        """
        # 1. Draft invoice
        draft_inv = BillingCalculationService.create_student_invoice(
            daycare=self.daycare,
            student=self.child1,
            billing_period_start=datetime.date(2026, 9, 1),
            billing_period_end=datetime.date(2026, 9, 30),
            issue_date=datetime.date(2026, 9, 1),
            actor=self.admin_user
        )

        # Guardian lists invoices -> draft should NOT appear
        res = self.guardian_client.get('/api/family/billing/invoices/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        invoices = res.data['invoices']
        self.assertEqual(len(invoices), 0)

        # Admin issues invoice
        BillingCalculationService.issue_invoice(draft_inv, actor=self.admin_user)

        # Guardian lists again -> now appears
        res2 = self.guardian_client.get('/api/family/billing/invoices/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res2.data['invoices']), 1)
        self.assertEqual(res2.data['invoices'][0]['id'], str(draft_inv.id))

        # Guardian detail view
        detail_res = self.guardian_client.get(f'/api/family/billing/invoices/{draft_inv.id}/')
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(detail_res.data['items']), 1)

        # Guardian trying to access Daycare Admin invoice endpoint directly -> 403 Forbidden
        admin_route_res = self.guardian_client.post(f'/api/daycare/billing/invoices/{draft_inv.id}/void/')
        self.assertEqual(admin_route_res.status_code, status.HTTP_403_FORBIDDEN)
