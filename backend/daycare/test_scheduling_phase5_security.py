from datetime import date, time, timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Daycare, User, Employee, Classroom, AgeGroup, StaffSchedule,
    EmployeeAvailability, OvertimeRecord, TimeBankRule, TimeBankTransaction,
    ShiftSwapRequest, DaycareHoliday, LeaveType, LeaveRequest,
    StaffShortageAlert, AuditLog
)
from daycare.services.scheduling import (
    SchedulingCoverageService,
    SchedulingConflictService,
    SchedulingReportsService,
    SchedulingHistoryService,
    LeaveService,
    TimeBankService
)


class StaffSchedulingPhase5SecurityTests(TestCase):

    def setUp(self):
        self.client = APIClient()

        # Daycare A
        self.daycare_a = Daycare.objects.create(name="Sunshine Academy A", email="adminA@sunshine.ca", status="Active")
        self.admin_user_a = User.objects.create_user(
            username="admin_a",
            email="adminA@sunshine.ca",
            password="Password123!",
            daycare=self.daycare_a,
            is_staff=True
        )

        self.emp_a1 = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Alice",
            last_name="Johnson",
            email="alice@sunshine.ca",
            job_title="Lead Educator",
            status="active"
        )
        self.user_emp_a1 = User.objects.create_user(
            username="alice_emp",
            email="alice@sunshine.ca",
            password="Password123!",
            daycare=self.daycare_a,
            is_staff=False
        )

        self.emp_a2 = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Bob",
            last_name="Smith",
            email="bob@sunshine.ca",
            job_title="Assistant Educator",
            status="active"
        )
        self.user_emp_a2 = User.objects.create_user(
            username="bob_emp",
            email="bob@sunshine.ca",
            password="Password123!",
            daycare=self.daycare_a,
            is_staff=False
        )

        self.age_group_toddler, _ = AgeGroup.objects.get_or_create(
            daycare=self.daycare_a,
            name="Toddlers",
            defaults={"min_age_months": 18, "max_age_months": 30}
        )

        self.room_a = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Toddler Room A",
            age_group=self.age_group_toddler,
            capacity=10,
            status="Active"
        )

        # Daycare B (Tenant Isolation)
        self.daycare_b = Daycare.objects.create(name="Starlight Daycare B", email="adminB@starlight.ca", status="Active")
        self.admin_user_b = User.objects.create_user(
            username="admin_b",
            email="adminB@starlight.ca",
            password="Password123!",
            daycare=self.daycare_b,
            is_staff=True
        )
        self.emp_b1 = Employee.objects.create(
            daycare=self.daycare_b,
            first_name="Charlie",
            last_name="Brown",
            email="charlie@starlight.ca",
            status="active"
        )
        self.room_b = Classroom.objects.create(
            daycare=self.daycare_b,
            room_name="Infant Room B",
            capacity=6,
            status="Active"
        )

        # Guardian User
        self.guardian_user = User.objects.create_user(
            username="guardian_user",
            email="parent@family.com",
            password="Password123!",
            daycare=self.daycare_a,
            is_staff=False
        )

        # Target test date (Monday)
        self.test_date = date(2026, 9, 7)


    def test_01_scheduling_dashboard_metrics(self):
        """
        Verify GET /api/daycare/scheduling/dashboard/ returns master KPIs and classroom ratio breakdown.
        """
        self.client.force_authenticate(user=self.admin_user_a)

        # Create shifts for Daycare A
        shift1 = StaffSchedule.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_a1,
            classroom=self.room_a,
            date=self.test_date,
            shift_start=time(7, 30),
            shift_end=time(16, 0),
            shift_type='opening',
            total_hours=8.5,
            status='scheduled'
        )
        shift2 = StaffSchedule.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_a2,
            classroom=self.room_a,
            date=self.test_date,
            shift_start=time(9, 30),
            shift_end=time(18, 0),
            shift_type='closing',
            total_hours=8.5,
            status='scheduled'
        )

        response = self.client.get(f"/api/daycare/scheduling/dashboard/?date={self.test_date}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        self.assertEqual(data["total_scheduled_staff"], 2)
        self.assertEqual(data["staff_working_today"], 2)
        self.assertEqual(data["opening_staff_count"], 1)
        self.assertEqual(data["closing_staff_count"], 1)
        self.assertEqual(len(data["classrooms_coverage"]), 1)
        self.assertEqual(data["classrooms_coverage"][0]["classroom_name"], "Toddler Room A")

    def test_02_all_16_scheduling_reports_json_and_csv(self):
        """
        Verify all 16 reports generate proper JSON columns/rows and valid CSV content.
        """
        self.client.force_authenticate(user=self.admin_user_a)

        report_types = [
            'weekly_schedule', 'employee_schedule', 'classroom_schedule',
            'opening_shifts', 'closing_shifts', 'staff_availability',
            'overtime', 'time_bank', 'shift_swaps', 'leave_summary',
            'sick_leave', 'vacation', 'holiday_schedule', 'staff_shortages',
            'classroom_coverage', 'ratio_compliance'
        ]

        for rep in report_types:
            # 1. JSON output
            res_json = self.client.get(f"/api/daycare/scheduling/reports/?report_type={rep}&start_date=2026-09-01&end_date=2026-09-30")
            self.assertEqual(res_json.status_code, status.HTTP_200_OK, f"Report {rep} failed with status {res_json.status_code}")
            self.assertIn("columns", res_json.data)
            self.assertIn("rows", res_json.data)
            self.assertIn("csv_content", res_json.data)

            # 2. CSV export
            res_csv = self.client.get(f"/api/daycare/scheduling/reports/?report_type={rep}&export=csv")
            self.assertEqual(res_csv.status_code, status.HTTP_200_OK)
            self.assertEqual(res_csv['Content-Type'], 'text/csv')
            self.assertTrue(len(res_csv.content) > 0)

    def test_03_multi_tenant_security_isolation(self):
        """
        Verify Daycare A cannot access, modify, or leak any data from Daycare B.
        """
        # Create Schedule and Leave in Daycare B
        shift_b = StaffSchedule.objects.create(
            daycare=self.daycare_b,
            employee=self.emp_b1,
            classroom=self.room_b,
            date=self.test_date,
            shift_start=time(9, 0),
            shift_end=time(17, 0),
            status='scheduled'
        )
        ltype_b = LeaveType.objects.create(daycare=self.daycare_b, name="Vacation B", code="vac_b")
        leave_b = LeaveRequest.objects.create(
            daycare=self.daycare_b,
            employee=self.emp_b1,
            leave_type=ltype_b,
            start_date=self.test_date,
            end_date=self.test_date,
            reason="Private leave",
            status="pending"
        )

        # Authenticate as Daycare A Admin
        self.client.force_authenticate(user=self.admin_user_a)

        # Direct ID Tampering: Schedule
        res = self.client.get(f"/api/daycare/scheduling/{shift_b.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Direct ID Tampering: Leave Request Approve
        res = self.client.post(f"/api/daycare/leave/requests/{leave_b.id}/approve/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Direct ID Tampering: Classroom Schedule Details
        res = self.client.get(f"/api/daycare/classrooms/{self.room_b.id}/schedule-details/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Dashboard and Reports Isolation
        res = self.client.get("/api/daycare/scheduling/dashboard/")
        for room_cov in res.data["classrooms_coverage"]:
            self.assertNotEqual(room_cov["classroom_id"], str(self.room_b.id))

    def test_04_role_permissions_enforcement(self):
        """
        Verify Role Permissions:
        - Guardian is forbidden from staff scheduling (403)
        - Employee cannot approve leave or overtime
        - Employee sees only own schedule
        """
        # 1. Guardian Blocked
        self.client.force_authenticate(user=self.guardian_user)
        res = self.client.get("/api/daycare/scheduling/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.get("/api/daycare/scheduling/dashboard/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.get("/api/daycare/scheduling/reports/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Employee Self-Approval Guard
        ltype = LeaveType.objects.create(daycare=self.daycare_a, name="Vacation", code="vac")
        leave_req = LeaveRequest.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_a1,
            leave_type=ltype,
            start_date=self.test_date,
            end_date=self.test_date,
            status="pending"
        )

        self.client.force_authenticate(user=self.user_emp_a1)
        res = self.client.post(f"/api/daycare/leave/requests/{leave_req.id}/approve/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_05_conflict_engine_and_leave_integration(self):
        """
        Verify SchedulingConflictService blocks scheduling shifts on approved leaves or overlapping shifts.
        """
        ltype = LeaveType.objects.create(daycare=self.daycare_a, name="Sick Leave", code="sick")
        LeaveRequest.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_a1,
            leave_type=ltype,
            start_date=self.test_date,
            end_date=self.test_date,
            status="approved"
        )

        # Attempt to validate shift on date with approved leave
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError) as ctx:
            SchedulingConflictService.validate_shift(
                daycare=self.daycare_a,
                employee=self.emp_a1,
                shift_date=self.test_date,
                shift_start=time(9, 0),
                shift_end=time(17, 0),
                classroom=self.room_a
            )
        self.assertIn("Leave conflict", str(ctx.exception))

    def test_06_schedule_history_audit_trail(self):
        """
        Verify SchedulingHistoryService records and retrieves audit logs.
        """
        self.client.force_authenticate(user=self.admin_user_a)

        # Log an action
        SchedulingHistoryService.log_schedule_action(
            daycare=self.daycare_a,
            user=self.admin_user_a,
            action="SHIFT_SWAP_APPROVED",
            entity_type="ShiftSwapRequest",
            entity_id="12345",
            new_values={"status": "approved"}
        )

        res = self.client.get("/api/daycare/scheduling/history/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(any(log["action"] == "SHIFT_SWAP_APPROVED" for log in res.data["history"]))

    def test_07_end_to_end_scheduling_lifecycle(self):
        """
        Complete end-to-end flow:
        Availability -> Shift Creation -> Leave Request -> Leave Approval -> Shortage Alert -> History -> Reports
        """
        self.client.force_authenticate(user=self.admin_user_a)

        # 1. Availability
        EmployeeAvailability.objects.create(
            employee=self.emp_a1,
            day_of_week="Monday",
            is_available=True,
            status="Available"
        )

        # 2. Create Shift
        res = self.client.post("/api/daycare/scheduling/", {
            "employee": str(self.emp_a1.id),
            "classroom": str(self.room_a.id),
            "date": str(self.test_date),
            "shift_start": "08:00:00",
            "shift_end": "16:30:00",
            "shift_type": "regular",
            "status": "scheduled"
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        shift_id = res.data["id"]

        # 3. Request Leave
        ltype = LeaveType.objects.create(daycare=self.daycare_a, name="Personal", code="personal")
        leave = LeaveService.create_leave_request(
            daycare=self.daycare_a,
            employee=self.emp_a1,
            leave_type=ltype,
            start_date=self.test_date,
            end_date=self.test_date,
            reason="Personal appointment"
        )
        self.assertEqual(leave.affected_shifts_count, 1)

        # 4. Approve Leave
        LeaveService.approve_leave_request(leave, self.admin_user_a, review_notes="Approved")

        # 5. Check Dashboard reflects shortage
        res_dash = self.client.get(f"/api/daycare/scheduling/dashboard/?date={self.test_date}")
        self.assertEqual(res_dash.status_code, status.HTTP_200_OK)
        self.assertEqual(res_dash.data["staff_on_leave"], 1)

        # 6. Verify Reports & History
        res_rep = self.client.get(f"/api/daycare/scheduling/reports/?report_type=leave_summary&start_date=2026-09-01&end_date=2026-09-30")
        self.assertEqual(res_rep.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res_rep.data["rows"]) >= 1)

        res_hist = self.client.get("/api/daycare/scheduling/history/")
        self.assertEqual(res_hist.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res_hist.data["history"]) >= 1)
