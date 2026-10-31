import uuid
from datetime import date, time, datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import (
    Daycare, Branch, Classroom, Student, StudentAttendance,
    Employee, StaffSchedule, StaffAttendance, StaffBreak,
    ChildEnrollment, ClassroomStudent, AuditLog, StaffNotification,
    Family, Guardian, FamilyGuardian, FamilyChild
)
from daycare.services.attendance import AttendanceService
from daycare.services.staff_attendance import StaffAttendanceService
from daycare.services.scheduling import SchedulingCoverageService

User = get_user_model()


class Module11Phase5AttendanceTests(APITestCase):
    def setUp(self):
        # 1. Daycare & Branches
        self.daycare = Daycare.objects.create(
            name="KidSynq Master Academy",
            status="Active",
            opening_time=time(7, 0),
            closing_time=time(18, 0)
        )
        self.branch = Branch.objects.create(
            daycare=self.daycare,
            name="Downtown Campus"
        )

        # 2. Users & Staff
        self.admin_user = User.objects.create_user(
            username="phase5_admin",
            password="Password123!",
            is_staff=True,
            daycare=self.daycare
        )
        self.admin_employee = Employee.objects.create(
            daycare=self.daycare,
            user=self.admin_user,
            first_name="Alice",
            last_name="Director",
            role="Director",
            status="active"
        )

        self.staff_user = User.objects.create_user(
            username="phase5_educator",
            password="Password123!",
            daycare=self.daycare
        )
        self.educator = Employee.objects.create(
            daycare=self.daycare,
            user=self.staff_user,
            first_name="Bob",
            last_name="Educator",
            role="Educator",
            status="active"
        )

        # 3. Classrooms
        self.toddler_room = Classroom.objects.create(
            daycare=self.daycare,
            branch=self.branch,
            room_name="Toddler Explorers",
            room_code="TOD-1",
            capacity=10
        )

        # 4. Children & Enrollments
        self.today = timezone.now().date()
        self.child1 = Student.objects.create(
            daycare=self.daycare,
            first_name="Charlie",
            last_name="Brown",
            admission_number="STU-001",
            status="Active"
        )
        ChildEnrollment.objects.create(
            student=self.child1,
            start_date=date(self.today.year, 1, 1),
            status="Active"
        )
        ClassroomStudent.objects.create(
            classroom=self.toddler_room,
            student=self.child1,
            status="Active"
        )

        self.child2 = Student.objects.create(
            daycare=self.daycare,
            first_name="Daisy",
            last_name="Miller",
            admission_number="STU-002",
            status="Active"
        )
        ChildEnrollment.objects.create(
            student=self.child2,
            start_date=date(self.today.year, 1, 1),
            status="Active"
        )
        ClassroomStudent.objects.create(
            classroom=self.toddler_room,
            student=self.child2,
            status="Active"
        )

        # Guardian & Family setup for security testing
        self.guardian_user = User.objects.create_user(
            username="phase5_guardian",
            password="Password123!"
        )
        self.guardian = Guardian.objects.create(
            user=self.guardian_user,
            daycare=self.daycare,
            first_name="Grace",
            last_name="Brown",
            email="grace.brown@example.com"
        )
        now_dt = timezone.now()
        self.family = Family.objects.create(
            daycare=self.daycare,
            family_name="Brown Family",
            status="Active",
            created_at=now_dt,
            updated_at=now_dt
        )
        FamilyGuardian.objects.create(
            family=self.family,
            guardian=self.guardian,
            relationship="Mother",
            is_primary=True,
            status="Active",
            created_at=now_dt
        )
        FamilyChild.objects.create(
            family=self.family,
            student=self.child1,
            created_at=now_dt
        )

    def test_master_attendance_dashboard(self):
        """
        PART A: Test live unified metrics for children, staff, and classroom breakdown.
        """
        # Child 1 is Checked In & In daycare now
        StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child1,
            classroom=self.toddler_room,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30)
        )
        # Child 2 is Absent
        StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child2,
            classroom=self.toddler_room,
            attendance_date=self.today,
            attendance_status="ABSENT"
        )

        # Educator schedule & attendance (Clocked In)
        shift = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.educator,
            classroom=self.toddler_room,
            date=self.today,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            status="scheduled"
        )
        StaffAttendance.objects.create(
            daycare=self.daycare,
            employee=self.educator,
            classroom=self.toddler_room,
            scheduled_shift=shift,
            date=self.today,
            clock_in=timezone.make_aware(datetime.combine(self.today, time(8, 5))),
            status="CLOCKED_IN"
        )

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/daycare/attendance/dashboard/', {'date': str(self.today)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        res = response.data

        # Verify Children Metrics
        self.assertEqual(res['children']['total_enrolled'], 2)
        self.assertEqual(res['children']['present'], 1)
        self.assertEqual(res['children']['absent'], 1)
        self.assertEqual(res['children']['currently_in_daycare'], 1)

        # Verify Staff Metrics
        self.assertEqual(res['staff']['scheduled_today'], 1)
        self.assertEqual(res['staff']['clocked_in'], 1)
        self.assertEqual(res['staff']['late_staff'], 1)

        # Verify Classroom Breakdown
        self.assertEqual(len(res['classrooms']), 1)
        cr = res['classrooms'][0]
        self.assertEqual(cr['room_name'], "Toddler Explorers")
        self.assertEqual(cr['checked_in_children'], 1)
        self.assertEqual(cr['present_children'], 1)
        self.assertEqual(cr['absent_children'], 1)
        self.assertIn("Bob Educator", cr['assigned_staff'])

    def test_daily_child_attendance_report_and_csv(self):
        """
        PART B: Test daily child attendance report with filtering and CSV export.
        """
        StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child1,
            classroom=self.toddler_room,
            branch=self.branch,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30),
            check_out_time=time(15, 30),
            remarks="Great mood today"
        )

        self.client.force_authenticate(user=self.admin_user)

        # JSON Response
        response = self.client.get('/api/daycare/reports/attendance/daily/', {
            'date': str(self.today),
            'classroom': str(self.toddler_room.id)
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['summary']['present'], 1)
        self.assertEqual(len(response.data['records']), 1)
        self.assertEqual(response.data['records'][0]['student_name'], "Charlie Brown")

        # CSV Export Response
        csv_resp = self.client.get('/api/daycare/reports/attendance/daily/', {
            'date': str(self.today),
            'export': 'csv'
        })
        self.assertEqual(csv_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(csv_resp['Content-Type'], 'text/csv')
        self.assertIn(b"Charlie Brown", csv_resp.content)

    def test_monthly_child_attendance_report(self):
        """
        PART C: Test monthly report with centralized percentage calculation excluding pre-enrollment days.
        """
        # Child 1 attended 2 days this month
        d1 = date(self.today.year, self.today.month, 1)
        d2 = date(self.today.year, self.today.month, 2)
        StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child1,
            classroom=self.toddler_room,
            attendance_date=d1,
            attendance_status="PRESENT",
            check_in_time=time(8, 30)
        )
        StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child1,
            classroom=self.toddler_room,
            attendance_date=d2,
            attendance_status="PRESENT",
            check_in_time=time(8, 30)
        )

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/daycare/reports/attendance/monthly/', {
            'year': self.today.year,
            'month': self.today.month
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        students_rep = response.data['students']
        c1_rep = next(s for s in students_rep if s['student_id'] == str(self.child1.id))
        self.assertEqual(c1_rep['days_present'], 2)
        self.assertGreater(c1_rep['enrolled_days'], 0)
        self.assertGreater(c1_rep['attendance_percentage'], 0.0)

    def test_staff_attendance_report_and_timesheet_report(self):
        """
        PART D & E: Test Staff Attendance and Timesheet Reports with breaks, overtime, and CSV export.
        """
        shift = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.educator,
            classroom=self.toddler_room,
            date=self.today,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            status="scheduled"
        )
        att = StaffAttendance.objects.create(
            daycare=self.daycare,
            employee=self.educator,
            classroom=self.toddler_room,
            scheduled_shift=shift,
            date=self.today,
            clock_in=timezone.make_aware(datetime.combine(self.today, time(8, 0))),
            clock_out=timezone.make_aware(datetime.combine(self.today, time(17, 30))),
            status="CLOCKED_OUT",
            approval_status="APPROVED",
            approved_by=self.admin_user
        )
        StaffBreak.objects.create(
            attendance=att,
            break_type="MEAL",
            break_start=timezone.make_aware(datetime.combine(self.today, time(12, 0))),
            break_end=timezone.make_aware(datetime.combine(self.today, time(12, 30))),
            is_paid=False
        )

        self.client.force_authenticate(user=self.admin_user)

        # 1. Staff Attendance Report
        res_staff = self.client.get('/api/daycare/reports/staff-attendance/', {
            'start_date': str(self.today),
            'end_date': str(self.today)
        })
        self.assertEqual(res_staff.status_code, status.HTTP_200_OK)
        self.assertEqual(res_staff.data['summary']['total_shifts'], 1)
        self.assertEqual(res_staff.data['summary']['total_overtime_hours'], 1.0) # 9.0h - 8.0h

        # 2. Timesheet Report
        res_ts = self.client.get('/api/daycare/reports/timesheets/', {
            'start_date': str(self.today),
            'end_date': str(self.today),
            'approval_status': 'APPROVED'
        })
        self.assertEqual(res_ts.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ts.data['summary']['approved_count'], 1)
        self.assertEqual(len(res_ts.data['records']), 1)
        self.assertEqual(res_ts.data['records'][0]['approved_by_name'], "Alice Director")

    def test_unified_attendance_audit_report(self):
        """
        PART F & M: Test unified audit report queries across child and staff attendance.
        """
        AuditLog.objects.create(
            user=self.admin_user,
            module="ATTENDANCE",
            action="CORRECTION",
            entity_type="StudentAttendance",
            entity_id=str(self.child1.id),
            old_values={"attendance_status": "ABSENT"},
            new_values={"attendance_status": "PRESENT", "correction_reason": "Parent arrived late with child"}
        )
        AuditLog.objects.create(
            user=self.admin_user,
            module="STAFF_ATTENDANCE",
            action="APPROVE",
            entity_type="StaffAttendance",
            entity_id=str(self.educator.id),
            old_values={"approval_status": "SUBMITTED"},
            new_values={"approval_status": "APPROVED"}
        )

        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/daycare/reports/attendance-audit/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 2)
        modules = [l['module'] for l in res.data['logs']]
        self.assertIn("ATTENDANCE", modules)
        self.assertIn("STAFF_ATTENDANCE", modules)

    def test_classroom_coverage_live_attendance_integration(self):
        """
        PART G & H: Test calculate_classroom_coverage integrates actual present children and clocked-in staff.
        """
        # Child 1 present
        StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child1,
            classroom=self.toddler_room,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 0)
        )
        # Educator clocked in
        StaffAttendance.objects.create(
            daycare=self.daycare,
            employee=self.educator,
            classroom=self.toddler_room,
            date=self.today,
            clock_in=timezone.make_aware(datetime.combine(self.today, time(8, 0))),
            status="CLOCKED_IN"
        )

        coverage = SchedulingCoverageService.calculate_classroom_coverage(
            daycare=self.daycare,
            classroom=self.toddler_room,
            target_date=self.today
        )
        self.assertEqual(coverage['present_children'], 1)
        self.assertEqual(coverage['checked_in_children'], 1)
        self.assertEqual(coverage['actual_staff_present'], 1)
        self.assertEqual(coverage['current_occupancy_percentage'], 10.0) # 1 / 10 capacity

    def test_family_portal_security_isolation(self):
        """
        PART J & N: Family members can ONLY view their own child's attendance and CANNOT view staff attendance or manager corrections.
        """
        StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child1,
            classroom=self.toddler_room,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30),
            check_out_time=time(16, 0),
            notes="Played nicely in the sandbox",
            is_corrected=True,
            correction_reason="Internal manager adjustment"
        )

        self.client.force_authenticate(user=self.guardian_user)

        # 1. Guardian can view own child's attendance
        res_own = self.client.get(f'/api/family/children/{self.child1.id}/attendance/')
        self.assertEqual(res_own.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_own.data['records']), 1)
        # Sensitive internal fields are not exposed in family serializer
        self.assertNotIn('correction_reason', res_own.data['records'][0])

        # 2. Guardian cannot view another child's attendance
        res_other = self.client.get(f'/api/family/children/{self.child2.id}/attendance/')
        self.assertEqual(res_other.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Guardian cannot access staff attendance or master dashboard
        res_staff = self.client.get('/api/daycare/attendance/dashboard/')
        self.assertEqual(res_staff.status_code, status.HTTP_403_FORBIDDEN)

    def test_attendance_notifications_deduplication(self):
        """
        PART I: Test notifications sent without duplicate spam on the same day.
        """
        # Trigger notification 1
        StaffAttendanceService.send_attendance_notification(
            daycare=self.daycare,
            notification_type="timesheet_submitted",
            title="Timesheet Submitted",
            message="Bob Educator submitted timesheet for review.",
            user=self.admin_user,
            employee=self.admin_employee
        )
        self.assertEqual(StaffNotification.objects.filter(notification_type="timesheet_submitted").count(), 1)

        # Duplicate trigger on same day should be ignored
        StaffAttendanceService.send_attendance_notification(
            daycare=self.daycare,
            notification_type="timesheet_submitted",
            title="Timesheet Submitted",
            message="Bob Educator submitted timesheet for review.",
            user=self.admin_user,
            employee=self.admin_employee
        )
        self.assertEqual(StaffNotification.objects.filter(notification_type="timesheet_submitted").count(), 1)
