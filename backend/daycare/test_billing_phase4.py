import datetime
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Daycare,
    DaycareSettings,
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
    ChildSubsidyProfile,
    TaxReceipt,
    Branch,
    AuditLog
)
from daycare.services.billing import BillingCalculationService, quantize_money

User = get_user_model()


class BillingPhase4Tests(TestCase):
    def setUp(self):
        # Create Daycares
        self.daycare = Daycare.objects.create(name="Sunshine Academy", address1="123 Sunny St", license_number="LIC-12345")
        self.other_daycare = Daycare.objects.create(name="Star Daycare", address1="456 Star Rd", license_number="LIC-99999")

        # Daycare Settings
        self.settings = DaycareSettings.objects.create(
            daycare=self.daycare,
            currency="CAD",
            legal_name="Sunshine Academy Ltd.",
            business_number="123456789RT0001",
            address="123 Sunny St, Toronto, ON"
        )

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
        self.other_guardian_user = User.objects.create_user(
            username="other_guardian",
            email="other_guardian@family.test",
            password="Password123!",
            daycare=self.other_daycare
        )

        # Create Family and Guardian profiles
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

        # Other Family
        self.other_guardian = Guardian.objects.create(
            daycare=self.other_daycare,
            user=self.other_guardian_user,
            first_name="Bob",
            last_name="Smith",
            email="other_guardian@family.test"
        )
        self.other_family = Family.objects.create(
            daycare=self.other_daycare,
            family_name="Smith Family"
        )
        FamilyGuardian.objects.create(
            family=self.other_family,
            guardian=self.other_guardian,
            relationship="Father",
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
        FamilyChild.objects.create(family=self.family, student=self.child1)

        self.other_child = Student.objects.create(
            daycare=self.other_daycare,
            first_name="Alice",
            last_name="Smith",
            dob=datetime.date(2022, 9, 1),
            admission_date=datetime.date(2025, 1, 1),
            status="Active"
        )
        FamilyChild.objects.create(family=self.other_family, student=self.other_child)

        # Base monthly fee structure
        self.fee_structure = FeeStructure.objects.create(
            daycare=self.daycare,
            name="Toddler Full Time",
            fee_type="MONTHLY",
            frequency="MONTHLY",
            amount=Decimal("1200.00"),
            currency="CAD",
            effective_from=datetime.date(2025, 1, 1),
            is_active=True
        )

        # Create standard invoice
        self.invoice = Invoice.objects.create(
            daycare=self.daycare,
            family=self.family,
            student=self.child1,
            invoice_number="INV-SUN-202501-0001",
            invoice_type="STANDARD",
            issue_date=datetime.date(2025, 1, 1),
            due_date=datetime.date(2025, 1, 15),
            subtotal=Decimal("1200.00"),
            total_amount=Decimal("1200.00"),
            balance_due=Decimal("1200.00"),
            currency="CAD",
            status="ISSUED"
        )

        # API Clients
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin_user)

        self.other_admin_client = APIClient()
        self.other_admin_client.force_authenticate(user=self.other_admin_user)

        self.guardian_client = APIClient()
        self.guardian_client.force_authenticate(user=self.guardian_user)

        self.other_guardian_client = APIClient()
        self.other_guardian_client.force_authenticate(user=self.other_guardian_user)

    # --------------------------------------------------------------------------
    # 1. Payment Recording & Lifecycle
    # --------------------------------------------------------------------------
    def test_record_payment_full_clears_invoice(self):
        """Recording a full payment decrements balance_due to 0 and transitions status to PAID."""
        payment = BillingCalculationService.record_payment(
            daycare=self.daycare,
            invoice=self.invoice,
            amount=Decimal("1200.00"),
            payment_method="ETRANSFER",
            payment_date=datetime.date(2025, 1, 5),
            transaction_reference="INTERAC-REF-101",
            actor=self.admin_user
        )

        self.assertIsNotNone(payment.id)
        self.assertTrue(payment.receipt_number.startswith("RCP-"))
        self.assertEqual(payment.amount, Decimal("1200.00"))
        self.assertEqual(payment.status, "COMPLETED")

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance_due, Decimal("0.00"))
        self.assertEqual(self.invoice.status, "PAID")

    def test_record_payment_partial(self):
        """Recording a partial payment decrements balance_due and sets status to PARTIALLY_PAID."""
        payment = BillingCalculationService.record_payment(
            daycare=self.daycare,
            invoice=self.invoice,
            amount=Decimal("500.00"),
            payment_method="CREDIT_CARD",
            payment_date=datetime.date(2025, 1, 5),
            actor=self.admin_user
        )

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance_due, Decimal("700.00"))
        self.assertEqual(self.invoice.status, "PARTIALLY_PAID")

    def test_record_payment_invalid_amount_or_void_invoice(self):
        """Payment recording fails if amount <= 0 or invoice is void/cancelled."""
        with self.assertRaises(ValueError):
            BillingCalculationService.record_payment(
                daycare=self.daycare,
                invoice=self.invoice,
                amount=Decimal("0.00")
            )

        self.invoice.status = "VOID"
        self.invoice.save()

        with self.assertRaises(ValueError):
            BillingCalculationService.record_payment(
                daycare=self.daycare,
                invoice=self.invoice,
                amount=Decimal("100.00")
            )

    def test_record_payment_clears_registration_fee_record(self):
        """Full payment on a registration invoice transitions matching RegistrationFeeRecord to PAID."""
        reg_fee_struct = FeeStructure.objects.create(
            daycare=self.daycare,
            name="Registration Fee",
            fee_type="REGISTRATION",
            frequency="ONE_TIME",
            amount=Decimal("150.00"),
            currency="CAD",
            effective_from=datetime.date(2025, 1, 1),
            is_active=True
        )
        reg_record = RegistrationFeeRecord.objects.create(
            daycare=self.daycare,
            student=self.child1,
            family=self.family,
            fee_structure=reg_fee_struct,
            amount=Decimal("150.00"),
            status="INVOICED"
        )
        reg_invoice = Invoice.objects.create(
            daycare=self.daycare,
            family=self.family,
            student=self.child1,
            invoice_number="INV-SUN-REG-0001",
            invoice_type="REGISTRATION",
            issue_date=datetime.date(2025, 1, 1),
            due_date=datetime.date(2025, 1, 10),
            subtotal=Decimal("150.00"),
            total_amount=Decimal("150.00"),
            balance_due=Decimal("150.00"),
            status="ISSUED"
        )

        payment = BillingCalculationService.record_payment(
            daycare=self.daycare,
            invoice=reg_invoice,
            amount=Decimal("150.00"),
            actor=self.admin_user
        )

        reg_record.refresh_from_db()
        self.assertEqual(reg_record.status, "PAID")

    def test_record_payment_clears_deposit_record(self):
        """Full payment on a deposit invoice transitions matching DepositRecord to HELD."""
        dep_fee_struct = FeeStructure.objects.create(
            daycare=self.daycare,
            name="Security Deposit",
            fee_type="DEPOSIT",
            frequency="ONE_TIME",
            amount=Decimal("500.00"),
            currency="CAD",
            effective_from=datetime.date(2025, 1, 1),
            is_active=True
        )
        dep_record = DepositRecord.objects.create(
            daycare=self.daycare,
            student=self.child1,
            family=self.family,
            fee_structure=dep_fee_struct,
            amount_charged=Decimal("500.00"),
            amount_held=Decimal("0.00"),
            status="CHARGED"
        )
        dep_invoice = Invoice.objects.create(
            daycare=self.daycare,
            family=self.family,
            student=self.child1,
            invoice_number="INV-SUN-DEP-0001",
            invoice_type="DEPOSIT",
            issue_date=datetime.date(2025, 1, 1),
            due_date=datetime.date(2025, 1, 10),
            subtotal=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            balance_due=Decimal("500.00"),
            status="ISSUED"
        )

        payment = BillingCalculationService.record_payment(
            daycare=self.daycare,
            invoice=dep_invoice,
            amount=Decimal("500.00"),
            payment_date=datetime.date(2025, 1, 3),
            actor=self.admin_user
        )

        dep_record.refresh_from_db()
        self.assertEqual(dep_record.status, "HELD")
        self.assertEqual(dep_record.amount_held, Decimal("500.00"))
        self.assertEqual(dep_record.received_date, datetime.date(2025, 1, 3))

    # --------------------------------------------------------------------------
    # 2. Refunds & Balance Restoration
    # --------------------------------------------------------------------------
    def test_process_refund_partial_and_full(self):
        """Processing refunds updates payment refunded_amount and restores invoice balance_due."""
        payment = BillingCalculationService.record_payment(
            daycare=self.daycare,
            invoice=self.invoice,
            amount=Decimal("1200.00"),
            actor=self.admin_user
        )
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, "PAID")

        # Partial Refund $300
        BillingCalculationService.process_refund(
            payment=payment,
            refund_amount=Decimal("300.00"),
            reason="Family requested week off refund",
            actor=self.admin_user
        )

        payment.refresh_from_db()
        self.invoice.refresh_from_db()
        self.assertEqual(payment.refunded_amount, Decimal("300.00"))
        self.assertEqual(payment.status, "PARTIALLY_REFUNDED")
        self.assertEqual(self.invoice.balance_due, Decimal("300.00"))
        self.assertEqual(self.invoice.status, "PARTIALLY_PAID")

        # Full remaining refund $900
        BillingCalculationService.process_refund(
            payment=payment,
            refund_amount=Decimal("900.00"),
            reason="Full balance refund",
            actor=self.admin_user
        )

        payment.refresh_from_db()
        self.invoice.refresh_from_db()
        self.assertEqual(payment.refunded_amount, Decimal("1200.00"))
        self.assertEqual(payment.status, "REFUNDED")
        self.assertEqual(self.invoice.balance_due, Decimal("1200.00"))
        self.assertEqual(self.invoice.status, "ISSUED")

    # --------------------------------------------------------------------------
    # 3. Government Subsidies & CWELCC Calculations
    # --------------------------------------------------------------------------
    def test_subsidy_profile_percentage_and_deduction(self):
        """CWELCC 52.75% subsidy reduces parent payable portion correctly."""
        subsidy = ChildSubsidyProfile.objects.create(
            daycare=self.daycare,
            student=self.child1,
            family=self.family,
            program_name="CWELCC Fee Reduction",
            subsidy_type="PERCENTAGE",
            subsidy_rate=Decimal("52.75"),
            currency="CAD",
            effective_from=datetime.date(2025, 1, 1),
            is_active=True
        )

        resolved = BillingCalculationService.resolve_effective_subsidy(self.child1, target_date=datetime.date(2025, 1, 15))
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved['subsidy_rate'], Decimal("52.75"))

        calc = BillingCalculationService.calculate_subsidy_deduction(
            gross_amount=Decimal("1000.00"),
            subsidy_profile=subsidy
        )
        self.assertEqual(calc['subsidy_amount'], Decimal("527.50"))
        self.assertEqual(calc['parent_portion'], Decimal("472.50"))

    def test_subsidy_profile_fixed_daily(self):
        """Fixed daily provincial subsidy (e.g. $25/day for 20 days)."""
        subsidy = ChildSubsidyProfile.objects.create(
            daycare=self.daycare,
            student=self.child1,
            family=self.family,
            program_name="Provincial Child Care Subsidy",
            subsidy_type="FIXED_DAILY",
            subsidy_rate=Decimal("25.00"),
            currency="CAD",
            effective_from=datetime.date(2025, 1, 1),
            is_active=True
        )

        calc = BillingCalculationService.calculate_subsidy_deduction(
            gross_amount=Decimal("800.00"),
            subsidy_profile=subsidy,
            days_count=20
        )
        self.assertEqual(calc['subsidy_amount'], Decimal("500.00"))
        self.assertEqual(calc['parent_portion'], Decimal("300.00"))

    # --------------------------------------------------------------------------
    # 4. Annual Childcare Expense Tax Receipts
    # --------------------------------------------------------------------------
    def test_generate_tax_receipt_single_family(self):
        """Tax receipt aggregates all completed eligible payments in the calendar tax year."""
        # Record 2 payments in 2025
        BillingCalculationService.record_payment(
            daycare=self.daycare,
            invoice=self.invoice,
            amount=Decimal("600.00"),
            payment_date=datetime.date(2025, 3, 1),
            actor=self.admin_user
        )
        BillingCalculationService.record_payment(
            daycare=self.daycare,
            invoice=self.invoice,
            amount=Decimal("600.00"),
            payment_date=datetime.date(2025, 6, 1),
            actor=self.admin_user
        )

        receipt = BillingCalculationService.generate_tax_receipt(
            daycare=self.daycare,
            family=self.family,
            tax_year=2025,
            actor=self.admin_user
        )

        self.assertIsNotNone(receipt.id)
        self.assertEqual(receipt.tax_year, 2025)
        self.assertEqual(receipt.total_eligible_fees_paid, Decimal("1200.00"))
        self.assertEqual(receipt.net_claimable_amount, Decimal("1200.00"))
        self.assertEqual(receipt.daycare_legal_name, "Sunshine Academy Ltd.")
        self.assertEqual(receipt.daycare_business_number, "123456789RT0001")
        self.assertTrue(receipt.receipt_number.startswith("TAX-"))

    def test_generate_batch_tax_receipts(self):
        """Batch generation creates receipts for all families with payment activity in the year."""
        BillingCalculationService.record_payment(
            daycare=self.daycare,
            invoice=self.invoice,
            amount=Decimal("1200.00"),
            payment_date=datetime.date(2025, 5, 1),
            actor=self.admin_user
        )

        res = BillingCalculationService.generate_batch_tax_receipts(
            daycare=self.daycare,
            tax_year=2025,
            actor=self.admin_user
        )

        self.assertEqual(res['tax_year'], 2025)
        self.assertEqual(res['generated_count'], 1)
        self.assertEqual(TaxReceipt.objects.filter(daycare=self.daycare, tax_year=2025).count(), 1)

    # --------------------------------------------------------------------------
    # 5. Statements of Account
    # --------------------------------------------------------------------------
    def test_family_account_statement_running_balance(self):
        """Statement of account compiles chronological invoice debits and payment credits with running balance."""
        BillingCalculationService.record_payment(
            daycare=self.daycare,
            invoice=self.invoice,
            amount=Decimal("500.00"),
            payment_date=datetime.date(2025, 1, 10),
            actor=self.admin_user
        )

        statement = BillingCalculationService.get_family_account_statement(
            daycare=self.daycare,
            family=self.family,
            start_date=datetime.date(2025, 1, 1),
            end_date=datetime.date(2025, 1, 31)
        )

        self.assertEqual(statement['family_name'], "Doe Family")
        self.assertEqual(statement['total_invoiced'], "1200.00")
        self.assertEqual(statement['total_paid'], "500.00")
        self.assertEqual(statement['closing_balance'], "700.00")
        self.assertEqual(len(statement['entries']), 2)
        self.assertEqual(statement['entries'][0]['type'], 'INVOICE')
        self.assertEqual(statement['entries'][1]['type'], 'PAYMENT')

    # --------------------------------------------------------------------------
    # 6. REST API Endpoints (Admin & Family Portal)
    # --------------------------------------------------------------------------
    def test_admin_record_payment_api(self):
        """POST /api/daycare/billing/payments/ creates payment via API."""
        url = "/api/daycare/billing/payments/"
        payload = {
            "invoice_id": str(self.invoice.id),
            "amount": "600.00",
            "payment_method": "ETRANSFER",
            "payment_date": "2025-01-10",
            "transaction_reference": "REF-9988",
            "payer_name": "Jane Doe"
        }
        res = self.admin_client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['receipt_number'].startswith("RCP-"))

        # Verify summary endpoint
        sum_res = self.admin_client.get("/api/daycare/billing/payments/summary/")
        self.assertEqual(sum_res.status_code, status.HTTP_200_OK)
        self.assertEqual(sum_res.data['total_collected'], "600.00")

    def test_admin_tax_receipt_endpoints(self):
        """Admin can generate, view print slip, and void tax receipts."""
        BillingCalculationService.record_payment(
            daycare=self.daycare,
            invoice=self.invoice,
            amount=Decimal("1200.00"),
            payment_date=datetime.date(2025, 2, 1),
            actor=self.admin_user
        )

        gen_url = "/api/daycare/billing/tax-receipts/generate/"
        gen_res = self.admin_client.post(gen_url, {"family_id": str(self.family.id), "tax_year": 2025}, format='json')
        self.assertEqual(gen_res.status_code, status.HTTP_201_CREATED)
        receipt_id = gen_res.data['id']

        # Print slip
        slip_url = f"/api/daycare/billing/tax-receipts/{receipt_id}/print_slip/"
        slip_res = self.admin_client.get(slip_url)
        self.assertEqual(slip_res.status_code, status.HTTP_200_OK)
        self.assertEqual(slip_res.data['financials']['net_claimable_amount'], "1200.00")

        # Void receipt
        void_url = f"/api/daycare/billing/tax-receipts/{receipt_id}/void/"
        void_res = self.admin_client.post(void_url, {"reason": "Incorrect name on slip"}, format='json')
        self.assertEqual(void_res.status_code, status.HTTP_200_OK)
        self.assertEqual(void_res.data['status'], "VOID")

    def test_family_portal_isolation(self):
        """Guardian can only see their family's payments, tax receipts, and statement."""
        # Sunshine family payment
        sunshine_payment = BillingCalculationService.record_payment(
            daycare=self.daycare,
            invoice=self.invoice,
            amount=Decimal("500.00"),
            payment_date=datetime.date(2025, 1, 10),
            actor=self.admin_user
        )

        # Star family invoice & payment
        star_invoice = Invoice.objects.create(
            daycare=self.other_daycare,
            family=self.other_family,
            student=self.other_child,
            invoice_number="INV-STAR-2025-001",
            invoice_type="STANDARD",
            issue_date=datetime.date(2025, 1, 1),
            due_date=datetime.date(2025, 1, 15),
            subtotal=Decimal("800.00"),
            total_amount=Decimal("800.00"),
            balance_due=Decimal("800.00"),
            status="ISSUED"
        )
        star_payment = BillingCalculationService.record_payment(
            daycare=self.other_daycare,
            invoice=star_invoice,
            amount=Decimal("800.00"),
            payment_date=datetime.date(2025, 1, 10),
            actor=self.other_admin_user
        )

        # Guardian 1 (Jane Doe) checks payments
        res = self.guardian_client.get("/api/family/billing/payments/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        payment_ids = [p['id'] for p in res.data]
        self.assertIn(str(sunshine_payment.id), payment_ids)
        self.assertNotIn(str(star_payment.id), payment_ids)

        # Guardian 1 checks receipt endpoint for Star payment -> 404 access denied
        receipt_res = self.guardian_client.get(f"/api/family/billing/payments/{star_payment.id}/receipt/")
        self.assertEqual(receipt_res.status_code, status.HTTP_404_NOT_FOUND)

        # Guardian 1 checks own receipt
        own_receipt_res = self.guardian_client.get(f"/api/family/billing/payments/{sunshine_payment.id}/receipt/")
        self.assertEqual(own_receipt_res.status_code, status.HTTP_200_OK)
        self.assertEqual(own_receipt_res.data['receipt_number'], sunshine_payment.receipt_number)

    def test_multi_tenant_admin_isolation(self):
        """Daycare A Admin cannot access or refund payments belonging to Daycare B."""
        star_invoice = Invoice.objects.create(
            daycare=self.other_daycare,
            family=self.other_family,
            student=self.other_child,
            invoice_number="INV-STAR-2025-002",
            invoice_type="STANDARD",
            issue_date=datetime.date(2025, 1, 1),
            due_date=datetime.date(2025, 1, 15),
            subtotal=Decimal("900.00"),
            total_amount=Decimal("900.00"),
            balance_due=Decimal("900.00"),
            status="ISSUED"
        )
        star_payment = BillingCalculationService.record_payment(
            daycare=self.other_daycare,
            invoice=star_invoice,
            amount=Decimal("900.00"),
            actor=self.other_admin_user
        )

        # Admin of Sunshine tries to refund Star payment -> 404
        refund_url = f"/api/daycare/billing/payments/{star_payment.id}/refund/"
        res = self.admin_client.post(refund_url, {"refund_amount": "100.00"}, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
