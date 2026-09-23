from datetime import date, time, timedelta
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Daycare, User, Employee, Classroom, AgeGroup,
    StaffSchedule, ShiftBreak, EmployeeAvailability,
    StaffAttendance, OvertimeRecord, TimeBankRule,
    TimeBankTransaction, ShiftSwapRequest
)
from daycare.services.scheduling import OvertimeService, TimeBankService, ShiftSwapService


class SchedulingPhase3TestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Daycare Setup
        self.daycare = Daycare.objects.create(
            name="Sunshine Early Learning",
            daycare_code="SUN001",
            status="Active"
        )

        # 2. Admin User
        self.admin_user = User.objects.create_user(
            username="admin@sunshine.com",
            email="admin@sunshine.com",
            password="Password123!",
            daycare=self.daycare,
            is_staff=True
        )

        # 3. Employees
        self.emp_alice = Employee.objects.create(
            daycare=self.daycare,
            first_name="Alice",
            last_name="Johnson",
            email="alice@sunshine.com",
            status="active"
        )
        self.emp_bob = Employee.objects.create(
            daycare=self.daycare,
            first_name="Bob",
            last_name="Smith",
            email="bob@sunshine.com",
            status="active"
        )
        self.emp_inactive = Employee.objects.create(
            daycare=self.daycare,
            first_name="Carol",
            last_name="Inactive",
            email="carol@sunshine.com",
            status="inactive"
        )

        # 4. User Accounts for Employees (for self-approval testing)
        self.alice_user = User.objects.create_user(
            username="alice@sunshine.com",
            email="alice@sunshine.com",
            password="Password123!",
            daycare=self.daycare
        )
        self.emp_alice.user = self.alice_user
        self.emp_alice.save()

        # 5. Availabilities (Monday)
        EmployeeAvailability.objects.create(
            employee=self.emp_alice,
            day_of_week="Monday",
            status="Available",
            is_available=True
        )
        EmployeeAvailability.objects.create(
            employee=self.emp_bob,
            day_of_week="Monday",
            status="Available",
            is_available=True
        )
        # Bob unavailable on Tuesday
        EmployeeAvailability.objects.create(
            employee=self.emp_bob,
            day_of_week="Tuesday",
            status="Unavailable",
            is_available=False
        )

        # 6. Secondary Daycare (Tenant Isolation)
        self.daycare_other = Daycare.objects.create(
            name="Other Daycare",
            daycare_code="OTH001",
            status="Active"
        )
        self.other_user = User.objects.create_user(
            username="other@other.com",
            email="other@other.com",
            password="Password123!",
            daycare=self.daycare_other,
            is_staff=True
        )
        self.other_emp = Employee.objects.create(
            daycare=self.daycare_other,
            first_name="Dan",
            last_name="Other",
            email="dan@other.com",
            status="active"
        )

        # 7. Base Date
        self.test_date = date(2026, 9, 7)  # Monday

        # Authenticate Admin by default
        self.client.force_authenticate(user=self.admin_user)

    # -------------------------------------------------------------
    # 1. OVERTIME TESTS
    # -------------------------------------------------------------
    def test_overtime_calculation_with_timesheet_and_without(self):
        """Test actual worked hours from StaffAttendance are used and schedule alone doesn't invent actual hours."""
        # Scheduled shift: 08:00 - 17:00 (9 hours)
        shift = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            date=self.test_date,
            shift_start=time(8, 0),
            shift_end=time(17, 0),
            status="scheduled"
        )

        # 1. Without Attendance: actual_hours is None, overtime is 0.0
        res1 = self.client.post("/api/daycare/scheduling/overtime/calculate/", {
            "date": str(self.test_date),
            "employee_id": str(self.emp_alice.id)
        }, format="json")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertIsNone(res1.data[0]["actual_hours"])
        self.assertEqual(float(res1.data[0]["overtime_hours"]), 0.0)

        # 2. With Actual Timesheet: Check-in 07:30, Check-out 17:30 (10.0 hours actual)
        StaffAttendance.objects.create(
            employee=self.emp_alice,
            date=self.test_date,
            status="Present",
            check_in_time=time(7, 30),
            check_out_time=time(17, 30),
            created_at="2026-09-07T07:30:00Z",
            updated_at="2026-09-07T17:30:00Z"
        )

        res2 = self.client.post("/api/daycare/scheduling/overtime/calculate/", {
            "date": str(self.test_date),
            "employee_id": str(self.emp_alice.id),
            "regular_hours_threshold": 8.0
        }, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        record = res2.data[0]
        self.assertEqual(float(record["actual_hours"]), 10.0)
        self.assertEqual(float(record["overtime_hours"]), 2.0)  # 10.0 - 8.0 = 2.0h overtime

    def test_overtime_approval_and_send_to_time_bank(self):
        """Test approving overtime record and sending approved hours to Time Bank."""
        ot = OvertimeRecord.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            date=self.test_date,
            scheduled_hours=8.0,
            actual_hours=10.0,
            regular_hours=8.0,
            overtime_hours=2.0,
            status="pending"
        )

        res = self.client.post(f"/api/daycare/scheduling/overtime/{ot.id}/approve/", {
            "send_to_time_bank": True
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "approved")

        # Verify time bank balance increased by 2.0 hours
        balance = TimeBankService.get_balance(self.daycare, self.emp_alice)
        self.assertEqual(balance, 2.0)

    def test_overtime_rejection(self):
        """Test rejecting overtime record with reason notes."""
        ot = OvertimeRecord.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            date=self.test_date,
            scheduled_hours=8.0,
            actual_hours=9.5,
            regular_hours=8.0,
            overtime_hours=1.5,
            status="pending"
        )

        res = self.client.post(f"/api/daycare/scheduling/overtime/{ot.id}/reject/", {
            "notes": "Unapproved late stay."
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "rejected")
        self.assertEqual(res.data["notes"], "Unapproved late stay.")

    # -------------------------------------------------------------
    # 2. TIME BANK TESTS
    # -------------------------------------------------------------
    def test_time_bank_credit_and_debit_ledger(self):
        """Test immutable transaction ledger and balance calculations."""
        # 1. Credit 5 hours
        TimeBankService.add_transaction(
            daycare=self.daycare,
            employee=self.emp_alice,
            transaction_type="overtime_credit",
            hours=5.0,
            reason="Weekend coverage overtime",
            approved_by_user=self.admin_user
        )
        self.assertEqual(TimeBankService.get_balance(self.daycare, self.emp_alice), 5.0)

        # 2. Debit 2 hours (taking time off)
        TimeBankService.add_transaction(
            daycare=self.daycare,
            employee=self.emp_alice,
            transaction_type="time_off_debit",
            hours=2.0,
            reason="Early leave on Friday",
            approved_by_user=self.admin_user
        )
        self.assertEqual(TimeBankService.get_balance(self.daycare, self.emp_alice), 3.0)

        # 3. Manual Adjustment +1.5h
        TimeBankService.add_transaction(
            daycare=self.daycare,
            employee=self.emp_alice,
            transaction_type="manual_adjustment",
            hours=1.5,
            reason="Manager bonus credit",
            approved_by_user=self.admin_user
        )
        self.assertEqual(TimeBankService.get_balance(self.daycare, self.emp_alice), 4.5)

        # Verify summary endpoint
        res = self.client.get("/api/daycare/scheduling/time-bank/summary/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        alice_summary = next(b for b in res.data["employee_balances"] if b["employee_id"] == str(self.emp_alice.id))
        self.assertEqual(alice_summary["balance_hours"], 4.5)
        self.assertEqual(alice_summary["total_credited_hours"], 6.5)
        self.assertEqual(alice_summary["total_debited_hours"], 2.0)

    def test_time_bank_rules_max_balance(self):
        """Test that time banking respects configured maximum balance."""
        rule = TimeBankService.get_or_create_rules(self.daycare)
        rule.max_balance_hours = 10.0
        rule.save()

        # Credit 8 hours -> OK
        TimeBankService.add_transaction(
            daycare=self.daycare,
            employee=self.emp_bob,
            transaction_type="overtime_credit",
            hours=8.0,
            reason="Overtime credit",
            approved_by_user=self.admin_user
        )

        # Attempt to credit 4 more hours -> Total 12h > 10h limit -> Fails
        res = self.client.post("/api/daycare/scheduling/time-bank/adjust/", {
            "employee_id": str(self.emp_bob.id),
            "transaction_type": "manual_adjustment",
            "hours": 4.0,
            "reason": "Exceeding limit"
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("hours", res.data)

    # -------------------------------------------------------------
    # 3. SHIFT SWAP TESTS
    # -------------------------------------------------------------
    def test_shift_swap_successful_approval(self):
        """Test shift swap workflow: Request -> Validate -> Approve -> Schedule Updated."""
        shift_a = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            date=self.test_date,  # Monday
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            status="scheduled"
        )
        shift_b = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp_bob,
            date=self.test_date,  # Monday
            shift_start=time(10, 0),
            shift_end=time(18, 0),
            status="scheduled"
        )

        # Create Swap Request
        res_create = self.client.post("/api/daycare/scheduling/swaps/", {
            "requesting_employee": str(self.emp_alice.id),
            "target_employee": str(self.emp_bob.id),
            "requesting_shift": str(shift_a.id),
            "target_shift": str(shift_b.id),
            "reason": "Doctor appointment in morning"
        }, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        swap_id = res_create.data["id"]

        # Admin Approves Swap
        res_approve = self.client.post(f"/api/daycare/scheduling/swaps/{swap_id}/approve/", {
            "admin_notes": "Approved by supervisor."
        }, format="json")
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)
        self.assertEqual(res_approve.data["status"], "approved")

        # Verify shifts updated atomically
        shift_a.refresh_from_db()
        shift_b.refresh_from_db()
        self.assertEqual(shift_a.employee_id, self.emp_bob.id)
        self.assertEqual(shift_b.employee_id, self.emp_alice.id)

    def test_shift_swap_availability_conflict(self):
        """Test swap fails if target employee is marked unavailable on target shift day."""
        tuesday_date = date(2026, 9, 8)  # Bob is unavailable on Tuesday
        shift_alice_tue = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            date=tuesday_date,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            status="scheduled"
        )

        res = self.client.post("/api/daycare/scheduling/swaps/", {
            "requesting_employee": str(self.emp_alice.id),
            "target_employee": str(self.emp_bob.id),
            "requesting_shift": str(shift_alice_tue.id),
            "reason": "Swap on Tuesday"
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("target_employee", res.data)

    def test_shift_swap_self_approval_denied(self):
        """Test employees cannot approve their own shift swap requests."""
        shift_a = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            date=self.test_date,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            status="scheduled"
        )
        swap = ShiftSwapRequest.objects.create(
            daycare=self.daycare,
            requesting_employee=self.emp_alice,
            target_employee=self.emp_bob,
            requesting_shift=shift_a,
            status="pending"
        )

        # Authenticate as Alice (Employee, not staff/admin)
        self.client.force_authenticate(user=self.alice_user)

        res = self.client.post(f"/api/daycare/scheduling/swaps/{swap.id}/approve/", format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_shift_swap_cancellation(self):
        """Test employee can cancel their pending swap request."""
        shift_a = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            date=self.test_date,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            status="scheduled"
        )
        swap = ShiftSwapRequest.objects.create(
            daycare=self.daycare,
            requesting_employee=self.emp_alice,
            target_employee=self.emp_bob,
            requesting_shift=shift_a,
            status="pending"
        )

        res = self.client.post(f"/api/daycare/scheduling/swaps/{swap.id}/cancel/", format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "cancelled")

    def test_cross_daycare_isolation(self):
        """Test daycare tenant isolation for overtime and swap requests."""
        ot_sunshine = OvertimeRecord.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            date=self.test_date,
            scheduled_hours=8.0,
            actual_hours=9.0,
            regular_hours=8.0,
            overtime_hours=1.0,
            status="pending"
        )

        # Switch client to Other Daycare Admin
        self.client.force_authenticate(user=self.other_user)

        # Cannot see or approve Sunshine daycare overtime
        res_list = self.client.get("/api/daycare/scheduling/overtime/")
        self.assertEqual(len(res_list.data["results"] if isinstance(res_list.data, dict) else res_list.data), 0)

        res_approve = self.client.post(f"/api/daycare/scheduling/overtime/{ot_sunshine.id}/approve/", format="json")
        self.assertEqual(res_approve.status_code, status.HTTP_404_NOT_FOUND)

        # Cannot swap with employee from another daycare
        shift_other = StaffSchedule.objects.create(
            daycare=self.daycare_other,
            employee=self.other_emp,
            date=self.test_date,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            status="scheduled"
        )
        res_swap = self.client.post("/api/daycare/scheduling/swaps/", {
            "requesting_employee": str(self.other_emp.id),
            "target_employee": str(self.emp_alice.id),
            "requesting_shift": str(shift_other.id)
        }, format="json")
        self.assertEqual(res_swap.status_code, status.HTTP_404_NOT_FOUND)
