import uuid
from datetime import date, time, datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import (
    Daycare, Branch, Classroom, Student, StudentAttendance,
    Employee, StaffSchedule, StaffAttendance, ClassroomStudent, 
    ChildEnrollment, ClassroomTeacherAssignment, ECECredential,
    CredentialType, Province, AgeGroup, RatioRule, LeaveType, LeaveRequest
)
from daycare.services.ratio_monitoring import RatioMonitoringService

User = get_user_model()


class Module13Phase2RatioMonitoringTests(APITestCase):
    """
    Module 13 Phase 2 Automated Test Suite: Live Classroom Ratio Calculation
    """

    def setUp(self):
        self.today = timezone.now().date()

        # 1. Daycare A & B for tenant isolation testing
        self.daycare_a = Daycare.objects.create(
            name="KidSynq Daycare A",
            status="Active",
            opening_time=time(7, 0),
            closing_time=time(18, 0)
        )
        self.daycare_b = Daycare.objects.create(
            name="KidSynq Daycare B",
            status="Active"
        )

        # 2. Age Groups
        self.toddler_ag = AgeGroup.objects.filter(daycare=self.daycare_a, name="Toddler").first()
        if not self.toddler_ag:
            self.toddler_ag = AgeGroup.objects.create(
                daycare=self.daycare_a,
                name="Toddler",
                min_age_months=13,
                max_age_months=24,
                display_order=1
            )


        # 3. Ratio Rule: 1 staff per 5 children, warning buffer of 1 child
        self.ratio_rule_toddler = RatioRule.objects.create(
            daycare=self.daycare_a,
            age_group=self.toddler_ag,
            name="Toddler Ratio Rule (1:5)",
            min_age_months=13,
            max_age_months=24,
            max_children_per_staff=5,
            warning_threshold_buffer=1,
            requires_qualified_ece=True,
            is_active=True
        )

        # 4. Classroom A1 (Toddler Room)
        self.classroom_a1 = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Sunshine Toddlers",
            room_code="TOD-101",
            age_group=self.toddler_ag,
            ratio_rule=self.ratio_rule_toddler,
            capacity=15,
            status="Active"
        )

        # Classroom A2 (Infant Room in Daycare A)
        self.classroom_a2 = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Little Stars Infants",
            room_code="INF-102",
            capacity=10,
            status="Active"
        )

        # Classroom B1 (Daycare B)
        self.classroom_b1 = Classroom.objects.create(
            daycare=self.daycare_b,
            room_name="Daycare B Room",
            capacity=10,
            status="Active"
        )

        # 5. Province & Credential Types
        self.province_on, _ = Province.objects.get_or_create(code="ON", defaults={"name": "Ontario"})
        self.ece_cred_type, _ = CredentialType.objects.get_or_create(
            category="ECE",
            name="Registered Early Childhood Educator (RECE)",
            defaults={"province": self.province_on, "status": "Active"}
        )


        # 6. Users & Staff for Daycare A
        self.admin_user = User.objects.create_user(
            username="admin_daycare_a",
            password="Password123!",
            daycare=self.daycare_a
        )

        self.user_educator_1 = User.objects.create_user(
            username="educator_1",
            password="Password123!",
            daycare=self.daycare_a
        )
        self.emp_educator_1 = Employee.objects.create(
            daycare=self.daycare_a,
            user=self.user_educator_1,
            first_name="Sarah",
            last_name="Jenkins",
            role="Lead Teacher",
            status="active"
        )
        # Assign to Classroom A1
        ClassroomTeacherAssignment.objects.create(
            daycare=self.daycare_a,
            classroom=self.classroom_a1,
            employee=self.emp_educator_1,
            assignment_type="Primary",
            status="Active"
        )
        # Give valid ECE Credential to educator 1
        self.cred_1 = ECECredential.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_1,
            credential_type=self.ece_cred_type,
            status="Active",
            verification_status="Verified",
            issue_date=self.today - timedelta(days=200),
            expiry_date=self.today + timedelta(days=200)
        )

        # Educator 2 (Qualified ECE)
        self.user_educator_2 = User.objects.create_user(
            username="educator_2",
            password="Password123!",
            daycare=self.daycare_a
        )
        self.emp_educator_2 = Employee.objects.create(
            daycare=self.daycare_a,
            user=self.user_educator_2,
            first_name="David",
            last_name="Miller",
            role="Assistant Educator",
            status="active"
        )
        ClassroomTeacherAssignment.objects.create(
            daycare=self.daycare_a,
            classroom=self.classroom_a1,
            employee=self.emp_educator_2,
            assignment_type="Assistant",
            status="Active"
        )
        self.cred_2 = ECECredential.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_2,
            credential_type=self.ece_cred_type,
            status="Active",
            verification_status="Verified",
            issue_date=self.today - timedelta(days=100),
            expiry_date=self.today + timedelta(days=300)
        )

        # Educator 3 (Unqualified Assistant / Expired Credential)
        self.user_unqualified = User.objects.create_user(
            username="unqualified_staff",
            password="Password123!",
            daycare=self.daycare_a
        )
        self.emp_unqualified = Employee.objects.create(
            daycare=self.daycare_a,
            user=self.user_unqualified,
            first_name="Kevin",
            last_name="Helper",
            role="Aide",
            status="active"
        )
        ClassroomTeacherAssignment.objects.create(
            daycare=self.daycare_a,
            classroom=self.classroom_a1,
            employee=self.emp_unqualified,
            assignment_type="Assistant",
            status="Active"
        )

        # Educator in Daycare B
        self.user_daycare_b = User.objects.create_user(
            username="staff_daycare_b",
            password="Password123!",
            daycare=self.daycare_b
        )
        self.emp_daycare_b = Employee.objects.create(
            daycare=self.daycare_b,
            user=self.user_daycare_b,
            first_name="DaycareB",
            last_name="Staff",
            status="active"
        )

        # 7. Create Enrolled Students in Classroom A1
        self.students = []
        for i in range(1, 11):
            s = Student.objects.create(
                daycare=self.daycare_a,
                first_name=f"ToddlerChild{i}",
                last_name=f"Doe{i}",
                status="Active"
            )
            ClassroomStudent.objects.create(
                classroom=self.classroom_a1,
                student=s,
                status="Active"
            )
            self.students.append(s)

        # Student in Classroom A2
        self.student_a2 = Student.objects.create(
            daycare=self.daycare_a,
            first_name="InfantChild",
            last_name="Smith",
            status="Active"
        )
        ClassroomStudent.objects.create(
            classroom=self.classroom_a2,
            student=self.student_a2,
            status="Active"
        )

        # Student in Daycare B
        self.student_b = Student.objects.create(
            daycare=self.daycare_b,
            first_name="ChildB",
            last_name="Jones",
            status="Active"
        )
        ClassroomStudent.objects.create(
            classroom=self.classroom_b1,
            student=self.student_b,
            status="Active"
        )

    # -------------------------------------------------------------
    # 1. COMPLIANT RATIO
    # -------------------------------------------------------------
    def test_01_compliant_ratio(self):
        """1 staff (capacity 5), 3 children present -> Ratio 3:1 -> COMPLIANT."""
        # Clock in 1 qualified educator
        StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_1,
            classroom=self.classroom_a1,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=2),
            status="CLOCKED_IN"
        )

        # Check in 3 children
        for i in range(3):
            StudentAttendance.objects.create(
                daycare=self.daycare_a,
                student=self.students[i],
                classroom=self.classroom_a1,
                attendance_date=self.today,
                attendance_status="PRESENT",
                check_in_time=time(8, 30)
            )

        res = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res["children_present"], 3)
        self.assertEqual(res["qualified_staff_present"], 1)
        self.assertEqual(res["required_staff"], 1)
        self.assertEqual(res["ratio"], "3:1")
        self.assertEqual(res["status"], "COMPLIANT")

    # -------------------------------------------------------------
    # 2. WARNING RATIO (Approaching Capacity)
    # -------------------------------------------------------------
    def test_02_warning_ratio(self):
        """1 staff (capacity 5), 5 children present (buffer=1) -> Ratio 5:1 -> WARNING."""
        StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_1,
            classroom=self.classroom_a1,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=2),
            status="CLOCKED_IN"
        )

        # Check in 5 children (reaches 100% capacity for 1 staff)
        for i in range(5):
            StudentAttendance.objects.create(
                daycare=self.daycare_a,
                student=self.students[i],
                classroom=self.classroom_a1,
                attendance_date=self.today,
                attendance_status="PRESENT",
                check_in_time=time(8, 30)
            )

        res = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res["children_present"], 5)
        self.assertEqual(res["qualified_staff_present"], 1)
        self.assertEqual(res["required_staff"], 1)
        self.assertEqual(res["ratio"], "5:1")
        self.assertEqual(res["status"], "WARNING")

    # -------------------------------------------------------------
    # 3. NON-COMPLIANT RATIO (Over Ratio Limit)
    # -------------------------------------------------------------
    def test_03_non_compliant_ratio(self):
        """1 staff (capacity 5), 6 children present -> Requires 2 staff -> NON_COMPLIANT."""
        StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_1,
            classroom=self.classroom_a1,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=2),
            status="CLOCKED_IN"
        )

        # Check in 6 children
        for i in range(6):
            StudentAttendance.objects.create(
                daycare=self.daycare_a,
                student=self.students[i],
                classroom=self.classroom_a1,
                attendance_date=self.today,
                attendance_status="PRESENT",
                check_in_time=time(8, 30)
            )

        res = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res["children_present"], 6)
        self.assertEqual(res["qualified_staff_present"], 1)
        self.assertEqual(res["required_staff"], 2)
        self.assertEqual(res["ratio"], "6:1")
        self.assertEqual(res["status"], "NON_COMPLIANT")

    # -------------------------------------------------------------
    # 4. ZERO QUALIFIED STAFF WITH CHILDREN
    # -------------------------------------------------------------
    def test_04_zero_qualified_staff_with_children(self):
        """0 staff, 4 children present -> NON_COMPLIANT (no division by zero)."""
        for i in range(4):
            StudentAttendance.objects.create(
                daycare=self.daycare_a,
                student=self.students[i],
                classroom=self.classroom_a1,
                attendance_date=self.today,
                attendance_status="PRESENT",
                check_in_time=time(8, 30)
            )

        res = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res["children_present"], 4)
        self.assertEqual(res["qualified_staff_present"], 0)
        self.assertEqual(res["ratio"], "4:0")
        self.assertEqual(res["required_staff"], 1)
        self.assertEqual(res["status"], "NON_COMPLIANT")

    # -------------------------------------------------------------
    # 5. ZERO CHILDREN & ZERO STAFF (Room Empty)
    # -------------------------------------------------------------
    def test_05_zero_children_zero_staff(self):
        """0 children, 0 staff -> COMPLIANT (Room Empty)."""
        res = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res["children_present"], 0)
        self.assertEqual(res["qualified_staff_present"], 0)
        self.assertEqual(res["required_staff"], 0)
        self.assertEqual(res["ratio"], "0:0")
        self.assertEqual(res["status"], "COMPLIANT")

    # -------------------------------------------------------------
    # 6. CHILD CHECK-IN CHANGES RATIO
    # -------------------------------------------------------------
    def test_06_child_checkin_changes_ratio(self):
        """Clock in 1 staff. Check in 5 children (Warning). Check in 6th child -> flips to Non-Compliant."""
        StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_1,
            classroom=self.classroom_a1,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=2),
            status="CLOCKED_IN"
        )

        for i in range(5):
            StudentAttendance.objects.create(
                daycare=self.daycare_a,
                student=self.students[i],
                classroom=self.classroom_a1,
                attendance_date=self.today,
                attendance_status="PRESENT",
                check_in_time=time(8, 30)
            )

        res_before = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res_before["status"], "WARNING")

        # Check in 6th child
        StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.students[5],
            classroom=self.classroom_a1,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(9, 0)
        )

        res_after = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res_after["children_present"], 6)
        self.assertEqual(res_after["status"], "NON_COMPLIANT")

    # -------------------------------------------------------------
    # 7. CHILD CHECK-OUT CHANGES RATIO
    # -------------------------------------------------------------
    def test_07_child_checkout_changes_ratio(self):
        """6 children (Non-Compliant). 1 child checks out -> count drops to 5 (Warning) -> 2nd child checks out -> 4 (Compliant)."""
        StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_1,
            classroom=self.classroom_a1,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=2),
            status="CLOCKED_IN"
        )

        att_records = []
        for i in range(6):
            att = StudentAttendance.objects.create(
                daycare=self.daycare_a,
                student=self.students[i],
                classroom=self.classroom_a1,
                attendance_date=self.today,
                attendance_status="PRESENT",
                check_in_time=time(8, 30)
            )
            att_records.append(att)

        res_6 = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res_6["status"], "NON_COMPLIANT")

        # First checkout
        att_records[5].check_out_time = time(12, 0)
        att_records[5].save()

        res_5 = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res_5["children_present"], 5)
        self.assertEqual(res_5["status"], "WARNING")

        # Second checkout -> 4 children (warning buffer of 1 away from 5)
        att_records[4].check_out_time = time(12, 30)
        att_records[4].save()

        res_4 = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res_4["children_present"], 4)
        self.assertEqual(res_4["status"], "WARNING")

        # Third checkout -> 3 children (safely compliant)
        att_records[3].check_out_time = time(13, 0)
        att_records[3].save()

        res_3 = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res_3["children_present"], 3)
        self.assertEqual(res_3["status"], "COMPLIANT")


    # -------------------------------------------------------------
    # 8. STAFF CLOCK-IN CHANGES RATIO
    # -------------------------------------------------------------
    def test_08_staff_clockin_changes_ratio(self):
        """6 children with 1 staff is Non-Compliant. Second educator clocks in -> becomes Compliant (6:2)."""
        StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_1,
            classroom=self.classroom_a1,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=2),
            status="CLOCKED_IN"
        )

        for i in range(6):
            StudentAttendance.objects.create(
                daycare=self.daycare_a,
                student=self.students[i],
                classroom=self.classroom_a1,
                attendance_date=self.today,
                attendance_status="PRESENT",
                check_in_time=time(8, 30)
            )

        res_1_staff = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res_1_staff["status"], "NON_COMPLIANT")

        # 2nd educator clocks in
        StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_2,
            classroom=self.classroom_a1,
            date=self.today,
            clock_in=timezone.now() - timedelta(minutes=10),
            status="CLOCKED_IN"
        )

        res_2_staff = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res_2_staff["qualified_staff_present"], 2)
        self.assertEqual(res_2_staff["ratio"], "6:2")
        self.assertEqual(res_2_staff["status"], "COMPLIANT")

    # -------------------------------------------------------------
    # 9. STAFF CLOCK-OUT CHANGES RATIO
    # -------------------------------------------------------------
    def test_09_staff_clockout_changes_ratio(self):
        """2 educators with 6 children (Compliant). 1 educator clocks out -> drops to 1 staff -> Non-Compliant."""
        s1 = StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_1,
            classroom=self.classroom_a1,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=4),
            status="CLOCKED_IN"
        )
        s2 = StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_2,
            classroom=self.classroom_a1,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=4),
            status="CLOCKED_IN"
        )

        for i in range(6):
            StudentAttendance.objects.create(
                daycare=self.daycare_a,
                student=self.students[i],
                classroom=self.classroom_a1,
                attendance_date=self.today,
                attendance_status="PRESENT",
                check_in_time=time(8, 30)
            )

        res_before = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res_before["status"], "COMPLIANT")

        # Educator 2 clocks out
        s2.clock_out = timezone.now()
        s2.status = "CLOCKED_OUT"
        s2.save()

        res_after = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res_after["qualified_staff_present"], 1)
        self.assertEqual(res_after["status"], "NON_COMPLIANT")

    # -------------------------------------------------------------
    # 10. UNQUALIFIED STAFF HANDLING
    # -------------------------------------------------------------
    def test_10_unqualified_staff_does_not_count_towards_ece_ratio(self):
        """Unqualified aide clocks in. Since rule requires ECE, qualified staff remains 0 -> Non-Compliant."""
        StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_unqualified,
            classroom=self.classroom_a1,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=1),
            status="CLOCKED_IN"
        )

        # Check in 3 children
        for i in range(3):
            StudentAttendance.objects.create(
                daycare=self.daycare_a,
                student=self.students[i],
                classroom=self.classroom_a1,
                attendance_date=self.today,
                attendance_status="PRESENT",
                check_in_time=time(8, 30)
            )

        res = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res["total_staff_present"], 1)
        self.assertEqual(res["qualified_staff_present"], 0)
        self.assertEqual(res["unqualified_staff_present"], 1)
        self.assertEqual(res["status"], "NON_COMPLIANT")

    # -------------------------------------------------------------
    # 11. STAFF ON APPROVED LEAVE EXCLUDED
    # -------------------------------------------------------------
    def test_11_staff_on_approved_leave_excluded(self):
        """Staff member has an open clock-in record but is on approved leave -> excluded from ratio."""
        leave_type = LeaveType.objects.create(daycare=self.daycare_a, name="Sick Leave", code="sick")
        LeaveRequest.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_1,
            leave_type=leave_type,
            start_date=self.today - timedelta(days=1),
            end_date=self.today + timedelta(days=1),
            status="approved"
        )

        StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_1,
            classroom=self.classroom_a1,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=1),
            status="CLOCKED_IN"
        )

        StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.students[0],
            classroom=self.classroom_a1,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30)
        )

        res = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res["qualified_staff_present"], 0)
        self.assertEqual(res["status"], "NON_COMPLIANT")

    # -------------------------------------------------------------
    # 12. WITHDRAWN AND INACTIVE CHILDREN EXCLUDED
    # -------------------------------------------------------------
    def test_12_withdrawn_and_inactive_children_excluded(self):
        """Withdrawn student or inactive enrollment attendance is ignored."""
        withdrawn_student = Student.objects.create(
            daycare=self.daycare_a,
            first_name="Withdrawn",
            last_name="Child",
            status="Withdrawn"
        )
        ClassroomStudent.objects.create(
            classroom=self.classroom_a1,
            student=withdrawn_student,
            status="Withdrawn"
        )

        # Create attendance record
        StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=withdrawn_student,
            classroom=self.classroom_a1,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30)
        )

        res = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res["children_present"], 0)

    # -------------------------------------------------------------
    # 13. CROSS-CLASSROOM STAFF ISOLATION
    # -------------------------------------------------------------
    def test_13_cross_classroom_staff_isolation(self):
        """Staff clocked in specifically to Classroom A2 does NOT count towards Classroom A1."""
        StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_educator_1,
            classroom=self.classroom_a2,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=1),
            status="CLOCKED_IN"
        )

        StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.students[0],
            classroom=self.classroom_a1,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30)
        )

        res_a1 = RatioMonitoringService.calculate_classroom_ratio(self.classroom_a1, target_date=self.today)
        self.assertEqual(res_a1["qualified_staff_present"], 0)
        self.assertEqual(res_a1["status"], "NON_COMPLIANT")

    # -------------------------------------------------------------
    # 14. CROSS-DAYCARE TENANT ISOLATION
    # -------------------------------------------------------------
    def test_14_cross_daycare_access_and_tenant_isolation(self):
        """Daycare B data never affects Daycare A calculations."""
        # Daycare B student attendance
        StudentAttendance.objects.create(
            daycare=self.daycare_b,
            student=self.student_b,
            classroom=self.classroom_b1,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30)
        )
        # Daycare B staff attendance
        StaffAttendance.objects.create(
            daycare=self.daycare_b,
            employee=self.emp_daycare_b,
            classroom=self.classroom_b1,
            date=self.today,
            clock_in=timezone.now() - timedelta(hours=1),
            status="CLOCKED_IN"
        )

        # Daycare A summary
        summary_a = RatioMonitoringService.get_daycare_ratio_summary(self.daycare_a, target_date=self.today)
        self.assertEqual(summary_a["total_children_present"], 0)
        self.assertEqual(summary_a["total_qualified_staff_present"], 0)

        # Daycare B summary
        summary_b = RatioMonitoringService.get_daycare_ratio_summary(self.daycare_b, target_date=self.today)
        self.assertEqual(summary_b["total_children_present"], 1)

    # -------------------------------------------------------------
    # 15. REST API ENDPOINTS
    # -------------------------------------------------------------
    def test_15_live_ratio_monitoring_api_endpoints(self):
        """Test GET /api/daycare/ratio-monitoring/ and Classroom detail endpoint."""
        self.client.force_authenticate(user=self.admin_user)

        # 1. Summary endpoint
        url_summary = reverse('live_ratio_monitoring')
        res_summary = self.client.get(url_summary)
        self.assertEqual(res_summary.status_code, status.HTTP_200_OK)
        self.assertIn("total_classrooms", res_summary.data)
        self.assertIn("classrooms", res_summary.data)

        # 2. Classroom Detail endpoint
        url_detail = reverse('classroom_live_ratio_detail', kwargs={'pk': self.classroom_a1.id})
        res_detail = self.client.get(url_detail)
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(res_detail.data["classroom_id"], str(self.classroom_a1.id))
        self.assertIn("ratio", res_detail.data)
        self.assertIn("status", res_detail.data)

        # 3. Ratio Rule CRUD
        url_rule = reverse('ratio_rule_list')
        res_rule_list = self.client.get(url_rule)
        self.assertEqual(res_rule_list.status_code, status.HTTP_200_OK)

        # 4. Security: Daycare B admin cannot access Daycare A classroom ratio detail
        self.client.force_authenticate(user=self.user_daycare_b)
        res_b_attempt = self.client.get(url_detail)
        self.assertEqual(res_b_attempt.status_code, status.HTTP_404_NOT_FOUND)
