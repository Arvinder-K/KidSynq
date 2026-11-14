from datetime import date, time, timedelta
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Daycare, User, Employee, Classroom, AgeGroup,
    StaffSchedule, DaycareHoliday, LeaveType,
    LeaveRequest, StaffShortageAlert, StaffNotification
)
from daycare.services.scheduling import (
    LeaveService, ShortageDetectionService, NotificationService
)


class SchedulingPhase4TestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Primary Daycare
        self.daycare = Daycare.objects.create(
            name="Sunshine Learning Centre",
            daycare_code="SUN002",
            status="Active",
            opening_time=time(7, 0),
            closing_time=time(18, 0)
        )

        # 2. Admin User
        self.admin_user = User.objects.create_user(
            username="admin@sunshine.org",
            email="admin@sunshine.org",
            password="Password123!",
            daycare=self.daycare,
            is_staff=True
        )

        # 3. Employees
        self.emp_alice = Employee.objects.create(
            daycare=self.daycare,
            first_name="Alice",
            last_name="Johnson",
            email="alice@sunshine.org",
            status="active"
        )
        self.emp_bob = Employee.objects.create(
            daycare=self.daycare,
            first_name="Bob",
            last_name="Smith",
            email="bob@sunshine.org",
            status="active"
        )

        # Employee User (for Alice)
        self.alice_user = User.objects.create_user(
            username="alice@sunshine.org",
            email="alice@sunshine.org",
            password="Password123!",
            daycare=self.daycare
        )
        self.emp_alice.user = self.alice_user
        self.emp_alice.save()

        # 4. Age Group & Classroom
        self.age_toddler = AgeGroup.objects.filter(daycare=self.daycare, name="Toddler").first() or AgeGroup.objects.create(
            name="Toddler",
            min_age_months=18,
            max_age_months=36,
            daycare=self.daycare
        )

        self.room_toddler = Classroom.objects.create(
            room_name="Toddler Room A",
            daycare=self.daycare,
            age_group=self.age_toddler,
            capacity=8,
            status="Active"
        )


        # 5. Seed Default Leave Types
        LeaveService.get_or_create_default_leave_types(self.daycare)
        self.leave_sick = LeaveType.objects.get(daycare=self.daycare, code="sick")
        self.leave_vacation = LeaveType.objects.get(daycare=self.daycare, code="vacation")

        # 6. Secondary Daycare (Tenant Isolation)
        self.daycare_other = Daycare.objects.create(
            name="Other Daycare",
            daycare_code="OTH002",
            status="Active"
        )
        self.other_admin = User.objects.create_user(
            username="other@admin.org",
            email="other@admin.org",
            password="Password123!",
            daycare=self.daycare_other,
            is_staff=True
        )
        self.other_emp = Employee.objects.create(
            daycare=self.daycare_other,
            first_name="David",
            last_name="Other",
            email="david@other.org",
            status="active"
        )
        LeaveService.get_or_create_default_leave_types(self.daycare_other)

        # Default auth: Admin
        self.client.force_authenticate(user=self.admin_user)
        self.test_date = date(2026, 9, 14)  # Monday

    # -------------------------------------------------------------
    # 1. LEAVE REQUEST & APPROVAL TESTS
    # -------------------------------------------------------------
    def test_sick_leave_request_and_approval(self):
        """Test employee requesting sick leave and admin approval."""
        res_create = self.client.post("/api/daycare/leave/requests/", {
            "employee": str(self.emp_alice.id),
            "leave_type": str(self.leave_sick.id),
            "start_date": str(self.test_date),
            "end_date": str(self.test_date),
            "reason": "Mild flu"
        }, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        leave_id = res_create.data["id"]
        self.assertEqual(res_create.data["status"], "pending")

        # Admin approves leave
        res_approve = self.client.post(f"/api/daycare/leave/requests/{leave_id}/approve/", {
            "notes": "Approved. Get well soon."
        }, format="json")
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)
        self.assertEqual(res_approve.data["status"], "approved")

        # Verify notification sent to Alice
        notifs = StaffNotification.objects.filter(employee=self.emp_alice, notification_type='leave_approved')
        self.assertTrue(notifs.exists())

    def test_vacation_leave_detects_schedule_conflicts(self):
        """Test vacation request identifies affected scheduled shifts without deleting them."""
        # Schedule shift on test_date
        shift = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            date=self.test_date,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            classroom=self.room_toddler,
            status="scheduled"
        )

        res = self.client.post("/api/daycare/leave/requests/", {
            "employee": str(self.emp_alice.id),
            "leave_type": str(self.leave_vacation.id),
            "start_date": str(self.test_date),
            "end_date": str(self.test_date + timedelta(days=2)),
            "reason": "Family trip"
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["affected_shifts_count"], 1)
        self.assertEqual(len(res.data["affected_shifts"]), 1)
        self.assertEqual(res.data["affected_shifts"][0]["shift_id"], str(shift.id))

        # Ensure scheduled shift was NOT deleted
        shift.refresh_from_db()
        self.assertEqual(shift.status, "scheduled")

    def test_leave_rejection_with_reason(self):
        """Test admin rejecting leave with mandatory rejection reason."""
        leave = LeaveRequest.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            leave_type=self.leave_vacation,
            start_date=self.test_date,
            end_date=self.test_date,
            status="pending"
        )

        # Empty reason -> Fails
        res_fail = self.client.post(f"/api/daycare/leave/requests/{leave.id}/reject/", {
            "rejection_reason": ""
        }, format="json")
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid reason -> Succeeds
        res_ok = self.client.post(f"/api/daycare/leave/requests/{leave.id}/reject/", {
            "rejection_reason": "High student attendance that week. Need coverage."
        }, format="json")
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ok.data["status"], "rejected")
        self.assertEqual(res_ok.data["rejection_reason"], "High student attendance that week. Need coverage.")

    def test_leave_self_approval_prevented(self):
        """Test employees cannot approve their own leave requests."""
        leave = LeaveRequest.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            leave_type=self.leave_vacation,
            start_date=self.test_date,
            end_date=self.test_date,
            status="pending"
        )

        # Alice logs in
        self.client.force_authenticate(user=self.alice_user)
        res = self.client.post(f"/api/daycare/leave/requests/{leave.id}/approve/", format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_leave_cancellation(self):
        """Test employee can cancel their leave request."""
        leave = LeaveRequest.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            leave_type=self.leave_vacation,
            start_date=self.test_date,
            end_date=self.test_date,
            status="pending"
        )

        res = self.client.post(f"/api/daycare/leave/requests/{leave.id}/cancel/", format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "cancelled")

    # -------------------------------------------------------------
    # 2. HOLIDAYS & SHORTAGE DETECTION TESTS
    # -------------------------------------------------------------
    def test_holiday_integration_suppresses_shortage(self):
        """Test that DaycareHoliday closure suppresses normal staffing shortage alerts."""
        # Create Daycare Holiday on test_date
        DaycareHoliday.objects.create(
            daycare=self.daycare,
            name="Labour Day",
            holiday_date=self.test_date,
            status="Active",
            created_at="2026-09-01T00:00:00Z",
            updated_at="2026-09-01T00:00:00Z"
        )

        res = ShortageDetectionService.detect_shortages_for_date(self.daycare, self.test_date)
        self.assertTrue(res["is_holiday"])
        self.assertEqual(res["holiday_name"], "Labour Day")
        self.assertEqual(len(res["shortages"]), 0)

    def test_staff_shortage_critical_detection(self):
        """Test detecting critical shortage when scheduled educators < required educators."""
        # Toddler room capacity 8, ratio 1:4 -> required staff = 2
        # Schedule only 1 educator (Alice)
        StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            classroom=self.room_toddler,
            date=self.test_date,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            status="scheduled"
        )

        res = self.client.post("/api/daycare/scheduling/shortages/scan/", {
            "start_date": str(self.test_date),
            "end_date": str(self.test_date)
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Verify critical alert created
        alerts = StaffShortageAlert.objects.filter(daycare=self.daycare, date=self.test_date, status="active")
        self.assertTrue(alerts.exists())
        alert = alerts.first()
        self.assertEqual(alert.alert_level, "critical")
        self.assertEqual(alert.required_staff, 2)
        self.assertEqual(alert.scheduled_staff, 1)
        self.assertEqual(alert.shortage_count, 1)

    def test_leave_causes_shortage(self):
        """Test approving leave for scheduled educator turns compliant coverage into critical shortage."""
        # Schedule both Alice and Bob (2 required)
        shift_a = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            classroom=self.room_toddler,
            date=self.test_date,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            status="scheduled"
        )
        shift_b = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp_bob,
            classroom=self.room_toddler,
            date=self.test_date,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            status="scheduled"
        )

        # Alice takes approved sick leave
        leave = LeaveRequest.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            leave_type=self.leave_sick,
            start_date=self.test_date,
            end_date=self.test_date,
            status="pending"
        )
        LeaveService.approve_leave_request(leave, self.admin_user)

        # Detect shortages: active scheduled staff is now 1 (Bob only), so shortage is 1
        alerts = StaffShortageAlert.objects.filter(daycare=self.daycare, date=self.test_date, status="active")
        self.assertTrue(alerts.exists())
        self.assertEqual(alerts.first().alert_level, "critical")
        self.assertIn("Alice", alerts.first().reason)

    def test_notification_deduplication(self):
        """Test NotificationService prevents sending duplicate alert spam within 60 minutes."""
        n1 = NotificationService.send_notification(
            daycare=self.daycare,
            user=self.admin_user,
            notification_type="staff_shortage",
            title="Shortage Alert",
            message="Deficit in Toddler Room"
        )
        self.assertIsNotNone(n1)

        # Immediate duplicate attempt -> Returns None (suppressed)
        n2 = NotificationService.send_notification(
            daycare=self.daycare,
            user=self.admin_user,
            notification_type="staff_shortage",
            title="Shortage Alert",
            message="Deficit in Toddler Room"
        )
        self.assertIsNone(n2)
        self.assertEqual(StaffNotification.objects.filter(daycare=self.daycare, title="Shortage Alert").count(), 1)

    def test_cross_daycare_leave_isolation(self):
        """Test daycare tenant isolation for leave requests."""
        leave_sunshine = LeaveRequest.objects.create(
            daycare=self.daycare,
            employee=self.emp_alice,
            leave_type=self.leave_vacation,
            start_date=self.test_date,
            end_date=self.test_date,
            status="pending"
        )

        # Switch client to Other Daycare Admin
        self.client.force_authenticate(user=self.other_admin)

        # Cannot see Sunshine daycare leaves
        res_list = self.client.get("/api/daycare/leave/requests/")
        results = res_list.data["results"] if isinstance(res_list.data, dict) else res_list.data
        self.assertEqual(len(results), 0)

        # Cannot approve Sunshine daycare leave
        res_approve = self.client.post(f"/api/daycare/leave/requests/{leave_sunshine.id}/approve/", format="json")
        self.assertEqual(res_approve.status_code, status.HTTP_404_NOT_FOUND)
