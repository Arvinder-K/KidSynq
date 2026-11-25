import uuid
from datetime import datetime, date, time, timedelta
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Daycare, Branch, Classroom, Employee, User,
    StaffSchedule, LeaveType, LeaveRequest, StaffAttendance,
    StaffBreak, AuditLog, OvertimeRecord, TimeBankRule, TimeBankTransaction
)
from daycare.services.staff_attendance import StaffAttendanceService
from daycare.services.scheduling import TimeBankService


class StaffAttendancePhase4Tests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Daycare 1
        self.daycare1 = Daycare.objects.create(
            name="Sunshine Early Learning Center",
            status="active"
        )
        self.branch1 = Branch.objects.create(
            name="Main Campus",
            daycare=self.daycare1
        )
        self.classroom1 = Classroom.objects.create(
            room_name="Butterflies Room",
            room_code="TOD-101",
            capacity=15,
            status="active",
            daycare=self.daycare1,
            branch=self.branch1
        )

        # Admin 1 (Director / Daycare Admin)
        self.admin_user1 = User.objects.create_user(
            username="director1",
            email="director1@sunshine.test",
            password="Password123!",
            is_staff=True,
            daycare=self.daycare1
        )
        self.admin_user1.role = "Daycare Admin"
        self.admin_user1.save()

        # Manager 1 (Supervisor)
        self.manager_user1 = User.objects.create_user(
            username="manager1",
            email="manager1@sunshine.test",
            password="Password123!",
            is_staff=False,
            daycare=self.daycare1
        )
        self.manager_user1.role = "Manager"
        self.manager_user1.save()

        self.manager_emp1 = Employee.objects.create(
            daycare=self.daycare1,
            user=self.manager_user1,
            first_name="Mary",
            last_name="Manager",
            email="manager1@sunshine.test",
            role="Manager",
            status="active"
        )

        # Staff 1 (Alice)
        self.staff_user1 = User.objects.create_user(
            username="alice_teacher",
            email="alice@sunshine.test",
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

        # Staff 2 (Bob)
        self.staff_user2 = User.objects.create_user(
            username="bob_teacher",
            email="bob@sunshine.test",
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

        # Super Admin User
        self.superadmin = User.objects.create_superuser(
            username="superboss",
            email="superadmin@system.local",
            password="SuperPassword123!"
        )
        self.superadmin.role = "Super Admin"
        self.superadmin.save()

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

    def test_timesheet_submission_workflow(self):
        """Test staff member submits completed timesheet for manager review."""
        d = date.today() - timedelta(days=1)
        c_in = timezone.make_aware(datetime.combine(d, time(8, 0, 0)))
        c_out = timezone.make_aware(datetime.combine(d, time(16, 30, 0)))

        att = StaffAttendanceService.clock_in(
            daycare=self.daycare1,
            employee_id=str(self.employee1.id),
            user=self.staff_user1,
            custom_datetime=c_in
        )
        StaffAttendanceService.clock_out(
            daycare=self.daycare1,
            attendance_id=str(att.id),
            user=self.staff_user1,
            custom_datetime=c_out
        )

        self.client.force_authenticate(user=self.staff_user1)
        res = self.client.post(f"/api/daycare/staff/attendance/records/{att.id}/submit/", {
            "notes": "Completed full Tuesday shift with toddler group"
        })

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['approval_status'], 'SUBMITTED')
        self.assertIsNotNone(res.data['submitted_at'])
        self.assertEqual(res.data['submitted_by_name'], 'Alice Smith')

        # Check Audit Log
        audit = AuditLog.objects.filter(
            module="STAFF_ATTENDANCE",
            entity_id=str(att.id),
            action="STAFF_TIMESHEET_SUBMITTED"
        ).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.new_values['approval_status'], 'SUBMITTED')

    def test_batch_timesheet_submission(self):
        """Test submitting multiple timesheets in batch."""
        d1 = date.today() - timedelta(days=2)
        d2 = date.today() - timedelta(days=1)

        att1 = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d1,
            clock_in=timezone.make_aware(datetime.combine(d1, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d1, time(16, 0))),
            status="CLOCKED_OUT",
            approval_status="DRAFT"
        )
        att2 = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d2,
            clock_in=timezone.make_aware(datetime.combine(d2, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d2, time(16, 0))),
            status="CLOCKED_OUT",
            approval_status="DRAFT"
        )

        self.client.force_authenticate(user=self.staff_user1)
        res = self.client.post("/api/daycare/staff/attendance/submit-batch/", {
            "attendance_ids": [str(att1.id), str(att2.id)]
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)
        att1.refresh_from_db()
        att2.refresh_from_db()
        self.assertEqual(att1.approval_status, 'SUBMITTED')
        self.assertEqual(att2.approval_status, 'SUBMITTED')

    def test_manager_approve_timesheet_success(self):
        """Test manager/admin approves submitted timesheet."""
        d = date.today() - timedelta(days=1)
        att = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d,
            clock_in=timezone.make_aware(datetime.combine(d, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d, time(16, 30))),
            status="CLOCKED_OUT",
            approval_status="SUBMITTED"
        )

        self.client.force_authenticate(user=self.admin_user1)
        res = self.client.post(f"/api/daycare/staff/attendance/records/{att.id}/approve/", {
            "notes": "Verified hours against room schedule"
        })

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['approval_status'], 'APPROVED')
        self.assertIsNotNone(res.data['approved_at'])

        att.refresh_from_db()
        self.assertEqual(att.approval_status, 'APPROVED')
        self.assertEqual(att.approved_by, self.admin_user1)

        # Verify Audit Log
        audit = AuditLog.objects.filter(
            module="STAFF_ATTENDANCE",
            entity_id=str(att.id),
            action="STAFF_TIMESHEET_APPROVED"
        ).first()
        self.assertIsNotNone(audit)

    def test_manager_reject_timesheet_with_reason(self):
        """Test rejecting timesheet requires mandatory reason and transitions to REJECTED."""
        d = date.today() - timedelta(days=1)
        att = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d,
            clock_in=timezone.make_aware(datetime.combine(d, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d, time(18, 0))),
            status="CLOCKED_OUT",
            approval_status="SUBMITTED"
        )

        self.client.force_authenticate(user=self.admin_user1)

        # Attempt reject without reason -> 400 Bad Request
        res_fail = self.client.post(f"/api/daycare/staff/attendance/records/{att.id}/reject/", {
            "rejection_reason": ""
        })
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Reject with valid reason -> 200 OK
        res = self.client.post(f"/api/daycare/staff/attendance/records/{att.id}/reject/", {
            "rejection_reason": "Clock-out was logged 2 hours after classroom closed without pre-approval"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['approval_status'], 'REJECTED')
        self.assertEqual(res.data['rejection_reason'], "Clock-out was logged 2 hours after classroom closed without pre-approval")

        att.refresh_from_db()
        self.assertEqual(att.approval_status, 'REJECTED')
        self.assertEqual(att.rejection_reason, "Clock-out was logged 2 hours after classroom closed without pre-approval")

        # Audit Log
        audit = AuditLog.objects.filter(
            module="STAFF_ATTENDANCE",
            entity_id=str(att.id),
            action="STAFF_TIMESHEET_REJECTED"
        ).first()
        self.assertIsNotNone(audit)

    def test_request_correction_and_employee_resubmission(self):
        """Test manager requesting correction and employee resubmitting after adjusting hours."""
        d = date.today() - timedelta(days=1)
        att = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d,
            clock_in=timezone.make_aware(datetime.combine(d, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d, time(17, 30))),
            status="CLOCKED_OUT",
            approval_status="SUBMITTED"
        )

        # Manager requests correction
        self.client.force_authenticate(user=self.admin_user1)
        res_req = self.client.post(f"/api/daycare/staff/attendance/records/{att.id}/request-correction/", {
            "correction_reason": "Please deduct 30 min lunch break that was missed in logs"
        })
        self.assertEqual(res_req.status_code, status.HTTP_200_OK)
        self.assertEqual(res_req.data['approval_status'], 'CORRECTION_REQUIRED')

        # Employee resubmits after correction
        self.client.force_authenticate(user=self.staff_user1)
        res_resubmit = self.client.post(f"/api/daycare/staff/attendance/records/{att.id}/resubmit/", {
            "notes": "Added missing 30 min meal break as requested"
        })
        self.assertEqual(res_resubmit.status_code, status.HTTP_200_OK)
        self.assertEqual(res_resubmit.data['approval_status'], 'SUBMITTED')

    def test_self_approval_prevention(self):
        """Test that employees and managers CANNOT approve their own timesheets."""
        d = date.today() - timedelta(days=1)

        # Timesheet belonging to Manager Mary
        att_mgr = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.manager_emp1,
            date=d,
            clock_in=timezone.make_aware(datetime.combine(d, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d, time(16, 0))),
            status="CLOCKED_OUT",
            approval_status="SUBMITTED"
        )

        # Manager Mary attempts to approve her OWN timesheet -> 403 Forbidden
        self.client.force_authenticate(user=self.manager_user1)
        res_self = self.client.post(f"/api/daycare/staff/attendance/records/{att_mgr.id}/approve/")
        self.assertEqual(res_self.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Self-approval is not permitted", str(res_self.data))

        # Regular Staff Alice tries to approve her own timesheet -> 403 Forbidden
        att_alice = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d,
            clock_in=timezone.make_aware(datetime.combine(d, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d, time(16, 0))),
            status="CLOCKED_OUT",
            approval_status="SUBMITTED"
        )
        self.client.force_authenticate(user=self.staff_user1)
        res_alice_self = self.client.post(f"/api/daycare/staff/attendance/records/{att_alice.id}/approve/")
        self.assertEqual(res_alice_self.status_code, status.HTTP_403_FORBIDDEN)

        # Daycare Admin Director approves Manager Mary's timesheet -> 200 OK
        self.client.force_authenticate(user=self.admin_user1)
        res_other = self.client.post(f"/api/daycare/staff/attendance/records/{att_mgr.id}/approve/")
        self.assertEqual(res_other.status_code, status.HTTP_200_OK)

        # Super Admin override can approve any timesheet
        self.client.force_authenticate(user=self.superadmin)
        res_super = self.client.post(f"/api/daycare/staff/attendance/records/{att_alice.id}/approve/")
        self.assertEqual(res_super.status_code, status.HTTP_200_OK)

    def test_overtime_calculation_using_actual_hours_and_unpaid_breaks(self):
        """Test overtime candidate calculation using actual clocked hours minus unpaid breaks vs configurable threshold."""
        d = date.today() - timedelta(days=1)
        c_in = timezone.make_aware(datetime.combine(d, time(7, 30, 0)))
        c_out = timezone.make_aware(datetime.combine(d, time(17, 30, 0))) # 10.0 elapsed hours

        # Shift scheduled for 8.0h
        sched = StaffSchedule.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d,
            shift_start=time(8, 0),
            shift_end=time(16, 30),
            status="scheduled"
        )

        att = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            scheduled_shift=sched,
            date=d,
            clock_in=c_in,
            clock_out=c_out,
            status="CLOCKED_OUT",
            approval_status="SUBMITTED"
        )

        # 1 hour unpaid meal break: Actual working hours = 10.0 - 1.0 = 9.0h
        StaffBreak.objects.create(
            attendance=att,
            break_start=timezone.make_aware(datetime.combine(d, time(12, 0))),
            break_end=timezone.make_aware(datetime.combine(d, time(13, 0))),
            break_type="MEAL",
            is_paid=False
        )

        # 15 min paid break (not deducted from actual working hours)
        StaffBreak.objects.create(
            attendance=att,
            break_start=timezone.make_aware(datetime.combine(d, time(15, 0))),
            break_end=timezone.make_aware(datetime.combine(d, time(15, 15))),
            break_type="REST",
            is_paid=True
        )

        att.refresh_from_db()
        self.assertEqual(att.actual_working_hours, 9.0)

        # Threshold 8.0h -> 1.0h overtime candidate
        self.client.force_authenticate(user=self.admin_user1)
        res_approve = self.client.post(f"/api/daycare/staff/attendance/records/{att.id}/approve/", {
            "threshold": 8.0
        })
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)

        # Verify OvertimeRecord created and linked to attendance
        ot_rec = OvertimeRecord.objects.filter(daycare=self.daycare1, employee=self.employee1, date=d).first()
        self.assertIsNotNone(ot_rec)
        self.assertEqual(ot_rec.attendance, att)
        self.assertEqual(float(ot_rec.actual_hours), 9.0)
        self.assertEqual(float(ot_rec.regular_hours), 8.0)
        self.assertEqual(float(ot_rec.overtime_hours), 1.0)
        self.assertEqual(ot_rec.status, 'approved')

    def test_configurable_overtime_threshold(self):
        """Test calculating overtime with a configurable threshold (e.g. 7.5 hours)."""
        d = date.today() - timedelta(days=1)
        c_in = timezone.make_aware(datetime.combine(d, time(8, 0, 0)))
        c_out = timezone.make_aware(datetime.combine(d, time(16, 30, 0))) # 8.5 hours

        att = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d,
            clock_in=c_in,
            clock_out=c_out,
            status="CLOCKED_OUT",
            approval_status="SUBMITTED"
        )

        self.client.force_authenticate(user=self.admin_user1)
        # Custom 7.5h daily threshold -> 8.5 - 7.5 = 1.0h overtime
        res = self.client.post(f"/api/daycare/staff/attendance/records/{att.id}/approve/", {
            "threshold": 7.5
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        ot_rec = OvertimeRecord.objects.get(daycare=self.daycare1, employee=self.employee1, date=d)
        self.assertEqual(float(ot_rec.regular_hours), 7.5)
        self.assertEqual(float(ot_rec.overtime_hours), 1.0)

    def test_time_bank_integration_on_approved_overtime(self):
        """Test that approved overtime automatically credits employee Time Bank balance when enabled."""
        # Enable Time Banking for Daycare 1
        TimeBankRule.objects.update_or_create(
            daycare=self.daycare1,
            defaults={
                'is_enabled': True,
                'max_balance_hours': 40.0,
                'require_approval': False,
                'expiry_months': 12
            }
        )

        initial_balance = TimeBankService.get_balance(self.daycare1, self.employee1)
        self.assertEqual(initial_balance, 0.0)

        d = date.today() - timedelta(days=1)
        c_in = timezone.make_aware(datetime.combine(d, time(8, 0, 0)))
        c_out = timezone.make_aware(datetime.combine(d, time(18, 0, 0))) # 10.0 hours -> 2.0h OT

        att = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d,
            clock_in=c_in,
            clock_out=c_out,
            status="CLOCKED_OUT",
            approval_status="SUBMITTED"
        )

        self.client.force_authenticate(user=self.admin_user1)
        res = self.client.post(f"/api/daycare/staff/attendance/records/{att.id}/approve/", {
            "send_to_time_bank": True,
            "threshold": 8.0
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Check Time Bank Transaction & Balance
        new_balance = TimeBankService.get_balance(self.daycare1, self.employee1)
        self.assertEqual(new_balance, 2.0)

        txn = TimeBankTransaction.objects.filter(
            daycare=self.daycare1,
            employee=self.employee1,
            transaction_type='overtime_credit'
        ).first()
        self.assertIsNotNone(txn)
        self.assertEqual(float(txn.hours), 2.0)
        self.assertEqual(float(txn.balance_after), 2.0)

    def test_overtime_without_time_banking(self):
        """Test daycare that does NOT use Time Bank retains overtime record without credit transaction."""
        # Disable Time Banking
        TimeBankRule.objects.update_or_create(
            daycare=self.daycare1,
            defaults={'is_enabled': False}
        )

        d = date.today() - timedelta(days=1)
        att = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d,
            clock_in=timezone.make_aware(datetime.combine(d, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d, time(18, 0))),
            status="CLOCKED_OUT",
            approval_status="SUBMITTED"
        )

        self.client.force_authenticate(user=self.admin_user1)
        res = self.client.post(f"/api/daycare/staff/attendance/records/{att.id}/approve/", {
            "threshold": 8.0
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Overtime record exists
        ot_rec = OvertimeRecord.objects.filter(daycare=self.daycare1, employee=self.employee1, date=d).first()
        self.assertIsNotNone(ot_rec)
        self.assertEqual(float(ot_rec.overtime_hours), 2.0)

        # No time bank transactions created
        txns_count = TimeBankTransaction.objects.filter(daycare=self.daycare1, employee=self.employee1).count()
        self.assertEqual(txns_count, 0)

    def test_controlled_break_corrections(self):
        """Test manager corrects break times, types, and durations with full audit tracking."""
        d = date.today()
        att = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d,
            clock_in=timezone.make_aware(datetime.combine(d, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d, time(16, 30))),
            status="CLOCKED_OUT"
        )
        brk = StaffBreak.objects.create(
            attendance=att,
            break_start=timezone.make_aware(datetime.combine(d, time(12, 0))),
            break_end=timezone.make_aware(datetime.combine(d, time(12, 30))),
            break_type="MEAL",
            is_paid=False
        )

        self.client.force_authenticate(user=self.admin_user1)
        corrected_end = timezone.make_aware(datetime.combine(d, time(12, 45))) # Change 30 min -> 45 min

        res = self.client.post(f"/api/daycare/staff/attendance/records/{att.id}/breaks/{brk.id}/correct/", {
            "correction_reason": "Staff break was extended by 15 mins with permission",
            "break_end": corrected_end.isoformat(),
            "is_paid": False
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['duration_minutes'], 45)

        brk.refresh_from_db()
        self.assertEqual(brk.duration_minutes, 45)

        # Check Audit Log
        audit = AuditLog.objects.filter(
            module="STAFF_ATTENDANCE",
            entity_id=str(att.id),
            action="STAFF_BREAK_CORRECTED"
        ).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.new_values['duration_minutes'], 45)

    def test_overtime_report_api(self):
        """Test overtime reporting endpoint with summary aggregates and filtering."""
        d1 = date.today() - timedelta(days=2)
        d2 = date.today() - timedelta(days=1)

        # Employee 1: 9.0h (1.0h OT)
        StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            classroom=self.classroom1,
            date=d1,
            clock_in=timezone.make_aware(datetime.combine(d1, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d1, time(17, 0))),
            status="CLOCKED_OUT",
            approval_status="APPROVED"
        )
        # Employee 2: 10.0h (2.0h OT)
        StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee2,
            classroom=self.classroom1,
            date=d2,
            clock_in=timezone.make_aware(datetime.combine(d2, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d2, time(18, 0))),
            status="CLOCKED_OUT",
            approval_status="APPROVED"
        )

        self.client.force_authenticate(user=self.admin_user1)
        res = self.client.get("/api/daycare/staff/attendance/overtime/report/", {
            "start_date": (d1 - timedelta(days=1)).isoformat(),
            "end_date": (d2 + timedelta(days=1)).isoformat(),
            "threshold": 8.0
        })

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        summary = res.data['summary']
        self.assertEqual(summary['total_shifts'], 2)
        self.assertEqual(summary['total_regular_hours'], 16.0)
        self.assertEqual(summary['total_overtime_hours'], 3.0)
        self.assertEqual(summary['total_worked_hours'], 19.0)
        self.assertEqual(len(res.data['employees']), 2)
        self.assertEqual(len(res.data['daily_logs']), 2)

    def test_cross_daycare_isolation(self):
        """Test Daycare 2 manager cannot view, submit, or approve Daycare 1 timesheets."""
        d = date.today()
        att1 = StaffAttendance.objects.create(
            daycare=self.daycare1,
            employee=self.employee1,
            date=d,
            clock_in=timezone.make_aware(datetime.combine(d, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(d, time(16, 0))),
            status="CLOCKED_OUT",
            approval_status="SUBMITTED"
        )

        self.client.force_authenticate(user=self.admin_user2)

        # Daycare 2 admin tries to approve Daycare 1 attendance -> 404 Not Found
        res_approve = self.client.post(f"/api/daycare/staff/attendance/records/{att1.id}/approve/")
        self.assertEqual(res_approve.status_code, status.HTTP_404_NOT_FOUND)

        # Daycare 2 admin tries to correct Daycare 1 attendance -> 404 Not Found
        res_correct = self.client.post(f"/api/daycare/staff/attendance/records/{att1.id}/correct/", {
            "correction_reason": "Cross daycare test"
        })
        self.assertEqual(res_correct.status_code, status.HTTP_404_NOT_FOUND)

        # Daycare 2 admin gets overtime report -> 0 shifts from Daycare 1
        res_report = self.client.get("/api/daycare/staff/attendance/overtime/report/")
        self.assertEqual(res_report.status_code, status.HTTP_200_OK)
        self.assertEqual(res_report.data['summary']['total_shifts'], 0)
