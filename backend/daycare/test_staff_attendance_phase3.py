import uuid
from datetime import datetime, date, time, timedelta
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Daycare, Branch, Classroom, Employee, User,
    StaffSchedule, LeaveType, LeaveRequest, StaffAttendance,
    StaffBreak, AuditLog
)
from daycare.services.staff_attendance import StaffAttendanceService


class StaffAttendancePhase3Tests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Daycare 1
        self.daycare1 = Daycare.objects.create(
            name="Sunshine Early Learning Center",
            status="active"
        )
        self.branch1 = Branch.objects.create(
            name="Main Branch",
            daycare=self.daycare1
        )
        self.classroom1 = Classroom.objects.create(
            room_name="Butterflies (Toddlers)",
            room_code="TOD-101",
            capacity=15,
            status="active",
            daycare=self.daycare1,
            branch=self.branch1
        )

        # Users & Employees in Daycare 1
        self.admin_user1 = User.objects.create_user(
            username="admin1",
            email="admin1@sunshine.test",
            password="Password123!",
            is_staff=True,
            daycare=self.daycare1
        )
        self.admin_user1.role = "Daycare Admin"
        self.admin_user1.save()

        self.staff_user1 = User.objects.create_user(
            username="teacher1",
            email="teacher1@sunshine.test",
            password="Password123!",
            is_staff=False,
            daycare=self.daycare1
        )
        self.staff_user1.role = "Staff"
        self.staff_user1.save()

        self.employee1 = Employee.objects.create(
            daycare=self.daycare1,
            user=self.staff_user1,
            first_name="Alice",
            last_name="Smith",
            email="alice@sunshine.test",
            role="Lead Teacher",
            status="active"
        )

        self.staff_user2 = User.objects.create_user(
            username="teacher2",
            email="teacher2@sunshine.test",
            password="Password123!",
            is_staff=False,
            daycare=self.daycare1
        )
        self.staff_user2.role = "Staff"
        self.staff_user2.save()

        self.employee2 = Employee.objects.create(
            daycare=self.daycare1,
            user=self.staff_user2,
            first_name="Bob",
            last_name="Jones",
            email="bob@sunshine.test",
            role="Assistant Teacher",
            status="active"
        )

        # Inactive Employee
        self.inactive_employee = Employee.objects.create(
            daycare=self.daycare1,
            first_name="Inactive",
            last_name="Staff",
            email="inactive@sunshine.test",
            role="Support Staff",
            status="inactive"
        )

        # Daycare 2 (Tenant Isolation)
        self.daycare2 = Daycare.objects.create(
            name="Little Stars Montessori",
            status="active"
        )
        self.admin_user2 = User.objects.create_user(
            username="admin2",
            email="admin2@littlestars.test",
            password="Password123!",
            is_staff=True,
            daycare=self.daycare2
        )
        self.admin_user2.role = "Daycare Admin"
        self.admin_user2.save()

        self.employee3 = Employee.objects.create(
            daycare=self.daycare2,
            first_name="Charlie",
            last_name="Brown",
            email="charlie@littlestars.test",
            role="Lead Teacher",
            status="active"
        )

    def test_clock_in_success(self):
        """Test staff clock-in creates an active record and audit log."""
        self.client.force_authenticate(user=self.staff_user1)

        target_dt = timezone.now()
        response = self.client.post('/api/daycare/staff/attendance/clock-in/', {
            "employee_id": str(self.employee1.id),
            "clock_in": target_dt.isoformat(),
            "notes": "Arrived on time for morning circle"
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'CLOCKED_IN')
        self.assertEqual(response.data['employee_name'], 'Alice Smith')
        self.assertIsNone(response.data['clock_out'])

        # Verify Audit Log
        audit = AuditLog.objects.filter(
            module="STAFF_ATTENDANCE",
            entity_id=response.data['id'],
            action="STAFF_CLOCK_IN"
        ).first()
        self.assertIsNotNone(audit)

    def test_duplicate_clock_in_prevented(self):
        """Test that duplicate clock-in without clocking out is rejected (400)."""
        self.client.force_authenticate(user=self.staff_user1)

        # First clock-in
        res1 = self.client.post('/api/daycare/staff/attendance/clock-in/', {
            "employee_id": str(self.employee1.id)
        })
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Second clock-in attempt
        res2 = self.client.post('/api/daycare/staff/attendance/clock-in/', {
            "employee_id": str(self.employee1.id)
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_clock_out_calculates_actual_hours(self):
        """Test clock-out updates record and correctly computes elapsed hours."""
        self.client.force_authenticate(user=self.staff_user1)

        d = date.today()
        c_in = timezone.make_aware(datetime.combine(d, time(8, 0, 0)))
        c_out = timezone.make_aware(datetime.combine(d, time(16, 30, 0))) # 8.5 hours

        # Clock-in
        att = StaffAttendanceService.clock_in(
            daycare=self.daycare1,
            employee_id=str(self.employee1.id),
            user=self.staff_user1,
            custom_datetime=c_in
        )

        # Clock-out
        response = self.client.post('/api/daycare/staff/attendance/clock-out/', {
            "attendance_id": str(att.id),
            "clock_out": c_out.isoformat(),
            "notes": "Shift completed smoothly"
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'CLOCKED_OUT')
        self.assertEqual(response.data['actual_working_hours'], 8.5)
        self.assertEqual(response.data['total_duration_hours'], 8.5)

    def test_clock_out_without_clock_in_prevented(self):
        """Test that clocking out a non-existent or closed attendance fails."""
        self.client.force_authenticate(user=self.staff_user1)

        fake_id = str(uuid.uuid4())
        response = self.client.post('/api/daycare/staff/attendance/clock-out/', {
            "attendance_id": fake_id
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_break_lifecycle_start_and_end(self):
        """Test break lifecycle: start meal break, verify ON_BREAK, end break, verify duration."""
        self.client.force_authenticate(user=self.staff_user1)

        d = date.today()
        c_in = timezone.make_aware(datetime.combine(d, time(8, 0, 0)))
        b_start = timezone.make_aware(datetime.combine(d, time(12, 0, 0)))
        b_end = timezone.make_aware(datetime.combine(d, time(12, 45, 0))) # 45 min unpaid break

        att = StaffAttendanceService.clock_in(
            daycare=self.daycare1,
            employee_id=str(self.employee1.id),
            user=self.staff_user1,
            custom_datetime=c_in
        )

        # Start Break
        res_break_start = self.client.post('/api/daycare/staff/attendance/start-break/', {
            "attendance_id": str(att.id),
            "break_start": b_start.isoformat(),
            "break_type": "MEAL",
            "is_paid": False
        })
        self.assertEqual(res_break_start.status_code, status.HTTP_201_CREATED)

        att.refresh_from_db()
        self.assertEqual(att.status, 'ON_BREAK')

        # End Break
        res_break_end = self.client.post('/api/daycare/staff/attendance/end-break/', {
            "attendance_id": str(att.id),
            "break_id": res_break_start.data['id'],
            "break_end": b_end.isoformat()
        })
        self.assertEqual(res_break_end.status_code, status.HTTP_200_OK)
        self.assertEqual(res_break_end.data['duration_minutes'], 45)

        att.refresh_from_db()
        self.assertEqual(att.status, 'CLOCKED_IN')
        self.assertEqual(att.total_break_minutes, 45)
        self.assertEqual(att.total_unpaid_break_hours, 0.75)

    def test_overlapping_breaks_prevented(self):
        """Test starting a break when another break is already open is rejected."""
        self.client.force_authenticate(user=self.staff_user1)

        d = date.today()
        c_in = timezone.make_aware(datetime.combine(d, time(8, 0, 0)))
        att = StaffAttendanceService.clock_in(
            daycare=self.daycare1,
            employee_id=str(self.employee1.id),
            user=self.staff_user1,
            custom_datetime=c_in
        )

        # Start first break
        self.client.post('/api/daycare/staff/attendance/start-break/', {
            "attendance_id": str(att.id),
            "break_type": "MEAL"
        })

        # Attempt to start second concurrent break
        res2 = self.client.post('/api/daycare/staff/attendance/start-break/', {
            "attendance_id": str(att.id),
            "break_type": "REST"
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unpaid_break_subtracted_from_working_hours(self):
        """Test that unpaid breaks are deducted from total hours while paid breaks are not."""
        d = date.today()
        c_in = timezone.make_aware(datetime.combine(d, time(8, 0, 0)))
        c_out = timezone.make_aware(datetime.combine(d, time(17, 0, 0))) # 9.0 total hours

        att = StaffAttendanceService.clock_in(
            daycare=self.daycare1,
            employee_id=str(self.employee1.id),
            user=self.staff_user1,
            custom_datetime=c_in
        )

        # Unpaid Meal Break: 12:00 - 13:00 (1.0 hour)
        StaffBreak.objects.create(
            attendance=att,
            break_start=timezone.make_aware(datetime.combine(d, time(12, 0, 0))),
            break_end=timezone.make_aware(datetime.combine(d, time(13, 0, 0))),
            break_type="MEAL",
            is_paid=False
        )

        # Paid Rest Break: 15:00 - 15:15 (15 min = 0.25 hour)
        StaffBreak.objects.create(
            attendance=att,
            break_start=timezone.make_aware(datetime.combine(d, time(15, 0, 0))),
            break_end=timezone.make_aware(datetime.combine(d, time(15, 15, 0))),
            break_type="REST",
            is_paid=True
        )

        StaffAttendanceService.clock_out(
            daycare=self.daycare1,
            attendance_id=str(att.id),
            user=self.staff_user1,
            custom_datetime=c_out
        )

        att.refresh_from_db()
        self.assertEqual(att.total_duration_hours, 9.0)
        self.assertEqual(att.total_unpaid_break_hours, 1.0)
        self.assertEqual(att.total_paid_break_hours, 0.25)
        self.assertEqual(att.actual_working_hours, 8.0) # 9.0 - 1.0 unpaid break

    def test_schedule_vs_actual_comparison(self):
        """Test planned schedule comparison and variance calculation."""
        d = date.today()

        # Create scheduled shift: 09:00 - 17:00 (8.0 hours)
        sched = StaffSchedule.objects.create(
            daycare=self.daycare1,
            branch=self.branch1,
            employee=self.employee1,
            classroom=self.classroom1,
            date=d,
            shift_start=time(9, 0),
            shift_end=time(17, 0),
            status="scheduled"
        )

        # Staff clocks in at 09:12 and clocks out at 17:18 with 30 min unpaid break
        c_in = timezone.make_aware(datetime.combine(d, time(9, 12, 0)))
        c_out = timezone.make_aware(datetime.combine(d, time(17, 18, 0)))

        att = StaffAttendanceService.clock_in(
            daycare=self.daycare1,
            employee_id=str(self.employee1.id),
            user=self.staff_user1,
            custom_datetime=c_in
        )

        self.assertEqual(att.scheduled_shift, sched)

        StaffAttendanceService.clock_out(
            daycare=self.daycare1,
            attendance_id=str(att.id),
            user=self.staff_user1,
            custom_datetime=c_out
        )

        att.refresh_from_db()
        self.assertEqual(att.scheduled_hours, 8.0)
        # Total elapsed: 8h 6m = 8.10h. Scheduled: 8.0h.
        self.assertGreater(att.actual_working_hours, 8.0)

    def test_missing_clock_out_detection(self):
        """Test that dashboard flags missing clock-out for shifts past end time."""
        past_date = date.today() - timedelta(days=1)

        # Scheduled yesterday 08:00 - 16:00
        sched = StaffSchedule.objects.create(
            daycare=self.daycare1,
            branch=self.branch1,
            employee=self.employee1,
            date=past_date,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            status="scheduled"
        )

        # Clocked in yesterday at 08:00 but never clocked out
        StaffAttendanceService.clock_in(
            daycare=self.daycare1,
            employee_id=str(self.employee1.id),
            custom_datetime=timezone.make_aware(datetime.combine(past_date, time(8, 0)))
        )

        dashboard = StaffAttendanceService.get_staff_attendance_dashboard(
            daycare=self.daycare1,
            target_date=past_date
        )

        self.assertEqual(dashboard['summary']['missing_clock_out'], 1)
        roster_item = next(r for r in dashboard['roster'] if r['employee_id'] == str(self.employee1.id))
        self.assertTrue(roster_item['is_missing_clock_out'])

    def test_inactive_employee_cannot_clock_in(self):
        """Test inactive employee is rejected upon attempting to clock in."""
        self.client.force_authenticate(user=self.admin_user1)

        response = self.client.post('/api/daycare/staff/attendance/clock-in/', {
            "employee_id": str(self.inactive_employee.id)
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_approved_leave_conflict_prevents_clock_in(self):
        """Test employee on approved leave cannot clock in for that date."""
        today = date.today()

        leave_type = LeaveType.objects.create(
            daycare=self.daycare1,
            name="Medical Leave",
            code="MED"
        )
        LeaveRequest.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            leave_type=leave_type,
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=1),
            status="approved"
        )

        self.client.force_authenticate(user=self.staff_user1)
        response = self.client.post('/api/daycare/staff/attendance/clock-in/', {
            "employee_id": str(self.employee1.id)
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("leave", response.data)

    def test_cross_daycare_tenant_isolation(self):
        """Test that Daycare 2 admin cannot access or clock in for Daycare 1 employees."""
        self.client.force_authenticate(user=self.admin_user2)

        # Attempt to clock in Daycare 1 employee using Daycare 2 session
        response = self.client.post('/api/daycare/staff/attendance/clock-in/', {
            "employee_id": str(self.employee1.id)
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Create attendance in Daycare 1
        att1 = StaffAttendanceService.clock_in(
            daycare=self.daycare1,
            employee_id=str(self.employee1.id)
        )

        # Daycare 2 tries to fetch Daycare 1 timesheets
        res_timesheets = self.client.get('/api/daycare/staff/attendance/timesheets/')
        self.assertEqual(res_timesheets.status_code, status.HTTP_200_OK)
        # Should contain 0 records from Daycare 1
        self.assertEqual(len(res_timesheets.data), 0)

    def test_permission_security_employee_vs_admin(self):
        """Test that regular employee only sees their own timesheets, while admin sees all and can approve."""
        # Create attendance for Employee 1 and Employee 2
        att1 = StaffAttendanceService.clock_in(daycare=self.daycare1, employee_id=str(self.employee1.id))
        att2 = StaffAttendanceService.clock_in(daycare=self.daycare1, employee_id=str(self.employee2.id))

        # Teacher 1 accesses timesheets -> only see Employee 1
        self.client.force_authenticate(user=self.staff_user1)
        res_staff = self.client.get('/api/daycare/staff/attendance/timesheets/')
        self.assertEqual(res_staff.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_staff.data), 1)
        self.assertEqual(res_staff.data[0]['id'], str(att1.id))

        # Teacher 1 tries to approve -> Forbidden (403)
        res_approve = self.client.post(f'/api/daycare/staff/attendance/records/{att1.id}/approve/')
        self.assertEqual(res_approve.status_code, status.HTTP_403_FORBIDDEN)

        # Admin accesses timesheets -> sees both
        self.client.force_authenticate(user=self.admin_user1)
        res_admin = self.client.get('/api/daycare/staff/attendance/timesheets/')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_admin.data), 2)

        # Admin approves timesheet -> Success (200)
        res_admin_approve = self.client.post(f'/api/daycare/staff/attendance/records/{att1.id}/approve/')
        self.assertEqual(res_admin_approve.status_code, status.HTTP_200_OK)
        self.assertEqual(res_admin_approve.data['approval_status'], 'APPROVED')

    def test_controlled_correction_with_reason_and_audit(self):
        """Test controlled correction workflow with mandatory reason and audit diff."""
        att = StaffAttendanceService.clock_in(daycare=self.daycare1, employee_id=str(self.employee1.id))

        # Non-admin cannot correct
        self.client.force_authenticate(user=self.staff_user1)
        res_unauthorized = self.client.post(f'/api/daycare/staff/attendance/records/{att.id}/correct/', {
            "correction_reason": "Forgot to clock in on time"
        })
        self.assertEqual(res_unauthorized.status_code, status.HTTP_403_FORBIDDEN)

        # Admin without reason -> 400
        self.client.force_authenticate(user=self.admin_user1)
        res_no_reason = self.client.post(f'/api/daycare/staff/attendance/records/{att.id}/correct/', {
            "correction_reason": ""
        })
        self.assertEqual(res_no_reason.status_code, status.HTTP_400_BAD_REQUEST)

        # Admin with valid correction
        d = date.today()
        corrected_in = timezone.make_aware(datetime.combine(d, time(8, 30, 0)))
        corrected_out = timezone.make_aware(datetime.combine(d, time(16, 30, 0)))

        res_correct = self.client.post(f'/api/daycare/staff/attendance/records/{att.id}/correct/', {
            "correction_reason": "Staff tablet wifi issue caused delayed timestamp",
            "clock_in": corrected_in.isoformat(),
            "clock_out": corrected_out.isoformat(),
            "status": "CLOCKED_OUT"
        })
        self.assertEqual(res_correct.status_code, status.HTTP_200_OK)
        self.assertTrue(res_correct.data['is_corrected'])
        self.assertEqual(res_correct.data['actual_working_hours'], 8.0)

        # Check Audit Trail endpoint
        res_audit = self.client.get(f'/api/daycare/staff/attendance/records/{att.id}/audit/')
        self.assertEqual(res_audit.status_code, status.HTTP_200_OK)
        self.assertGreater(len(res_audit.data['audit_trail']), 0)
        corr_audit = next(a for a in res_audit.data['audit_trail'] if a['action'] == 'STAFF_ATTENDANCE_CORRECTED')
        self.assertEqual(corr_audit['new_values']['correction_reason'], 'Staff tablet wifi issue caused delayed timestamp')
