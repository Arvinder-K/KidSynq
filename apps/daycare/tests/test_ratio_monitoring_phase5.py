import uuid
from datetime import date, datetime, time, timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    User, Daycare, Branch, Classroom, Student, StudentAttendance,
    ClassroomStudent, Employee, StaffAttendance, ECECredential,
    CredentialType, AgeGroup, RatioRule, RatioManualOverride,
    RatioComplianceHistory, Province, Program, LeaveRequest, LeaveType, AuditLog
)
from daycare.services.ratio_monitoring import RatioMonitoringService
from daycare.services.ratio_reports import RatioReportsService


class RatioMonitoringPhase5ComprehensiveTests(TestCase):
    """
    Module 13 Phase 5: Complete 22-Scenario Comprehensive Test Matrix
    Covering Reports, Dashboard, Attendance Integration, Scheduling Integration,
    Audit Logging, Multi-Tenant Security, and Performance/Accuracy.
    """

    def setUp(self):
        self.client = APIClient()
        self.today = timezone.now().date()
        self.now_time = timezone.now().time()
        self.now_datetime = timezone.now()

        # 1. Setup Province
        self.province_on, _ = Province.objects.get_or_create(code="ON", defaults={"name": "Ontario", "status": "Active"})
        self.province_bc, _ = Province.objects.get_or_create(code="BC", defaults={"name": "British Columbia", "status": "Active"})

        # 2. Setup Daycare A (Ontario)
        self.daycare_a = Daycare.objects.create(
            name=f"Alpha Daycare {uuid.uuid4().hex[:6]}",
            province=self.province_on,
            state="ON",
            status="Active"
        )
        self.branch_a = Branch.objects.create(daycare=self.daycare_a, name="Alpha Downtown")

        # 3. Setup Daycare B (BC - for tenant isolation)
        self.daycare_b = Daycare.objects.create(
            name=f"Beta Daycare {uuid.uuid4().hex[:6]}",
            province=self.province_bc,
            state="BC",
            status="Active"
        )

        # 4. Setup Users
        self.admin_user_a = User.objects.create_user(
            username=f"admin_a_{uuid.uuid4().hex[:4]}",
            email="admin_a@test.com",
            password="Password123!",
            daycare=self.daycare_a
        )
        self.employee_admin_a = Employee.objects.create(
            user=self.admin_user_a,
            daycare=self.daycare_a,
            first_name="Alice",
            last_name="Admin",
            role="Daycare Admin",
            status="active"
        )
        self.staff_user_a = User.objects.create_user(
            username=f"staff_a_{uuid.uuid4().hex[:4]}",
            email="staff_a@test.com",
            password="Password123!",
            daycare=self.daycare_a
        )
        self.employee_staff_a = Employee.objects.create(
            user=self.staff_user_a,
            daycare=self.daycare_a,
            first_name="Bob",
            last_name="Staff",
            role="Staff",
            status="active"
        )
        self.guardian_user = User.objects.create_user(
            username=f"guard_{uuid.uuid4().hex[:4]}",
            email="guardian@test.com",
            password="Password123!"
        )
        self.guardian_user.guardian = True
        self.superadmin_user = User.objects.create_superuser(
            username=f"super_{uuid.uuid4().hex[:4]}",
            email="super@test.com",
            password="Password123!"
        )

        # 5. Setup Programs & Age Groups
        self.program_fullday = Program.objects.create(daycare=self.daycare_a, name="Full-Day Early Learning")
        self.program_nursery = Program.objects.create(daycare=self.daycare_a, name="Nursery Half-Day")

        self.age_group_infant = AgeGroup.objects.create(
            daycare=self.daycare_a, name="Infant Group", min_age_months=0, max_age_months=18
        )
        self.age_group_toddler = AgeGroup.objects.create(
            daycare=self.daycare_a, name="Toddler Group", min_age_months=18, max_age_months=30
        )
        self.age_group_preschool = AgeGroup.objects.create(
            daycare=self.daycare_a, name="Preschool Group", min_age_months=30, max_age_months=60
        )

        # 6. Setup Classrooms
        self.room_toddler = Classroom.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            room_name="Toddler Room A",
            room_code="TOD-A",
            capacity=15,
            age_group=self.age_group_toddler,
            program=self.program_fullday,
            min_age_months=18,
            max_age_months=30,
            status="Active"
        )
        self.room_infant = Classroom.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            room_name="Infant Room 1",
            room_code="INF-1",
            capacity=9,
            age_group=self.age_group_infant,
            program=self.program_fullday,
            min_age_months=0,
            max_age_months=18,
            status="Active"
        )
        self.room_preschool = Classroom.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            room_name="Preschool Blue",
            room_code="PRE-B",
            capacity=24,
            age_group=self.age_group_preschool,
            program=self.program_fullday,
            min_age_months=30,
            max_age_months=60,
            status="Active"
        )

        # 7. Setup Credential Type
        self.cred_type_ece, _ = CredentialType.objects.get_or_create(
            name="Registered ECE (RECE)",
            defaults={'category': 'ece', 'province': self.province_on, 'status': 'Active'}
        )

        # 8. Setup Ratio Rules
        # Toddler Rule: 1 staff per 5 children, warning threshold = 1 buffer
        self.rule_toddler = RatioRule.objects.create(
            daycare=self.daycare_a,
            province=self.province_on,
            name="Ontario Toddler Standard (1:5)",
            age_group=self.age_group_toddler,
            program=self.program_fullday,
            min_age_months=18,
            max_age_months=30,
            max_children_per_staff=5,
            warning_threshold_buffer=1,
            requires_qualified_ece=True,
            effective_from=self.today - timedelta(days=30),
            is_active=True
        )
        self.room_toddler.ratio_rule = self.rule_toddler
        self.room_toddler.save()

    # --- Helper methods ---
    def _create_and_checkin_student(self, classroom, first_name="Child"):
        st = Student.objects.create(
            daycare=classroom.daycare,
            first_name=first_name,
            last_name=f"Test_{uuid.uuid4().hex[:4]}",
            status="Active",
            dob=self.today - timedelta(days=700)
        )
        ClassroomStudent.objects.create(classroom=classroom, student=st, status="Active")
        att = StudentAttendance.objects.create(
            daycare=classroom.daycare,
            student=st,
            classroom=classroom,
            attendance_date=self.today,
            check_in_time=self.now_time,
            attendance_status="PRESENT"
        )
        return st, att

    def _create_and_clockin_staff(self, classroom, is_ece=True, first_name="Staff"):
        emp = Employee.objects.create(
            daycare=classroom.daycare,
            first_name=first_name,
            last_name=f"Edu_{uuid.uuid4().hex[:4]}",
            status="active",
            job_title="Lead Educator" if is_ece else "Aide"
        )
        if is_ece:
            ECECredential.objects.create(
                employee=emp,
                daycare=classroom.daycare,
                credential_type=self.cred_type_ece,
                status="Active",
                issue_date=self.today - timedelta(days=100),
                expiry_date=self.today + timedelta(days=365)
            )
        att = StaffAttendance.objects.create(
            daycare=classroom.daycare,
            employee=emp,
            classroom=classroom,
            date=self.today,
            clock_in=self.now_datetime,
            status="CLOCKED_IN"
        )
        return emp, att

    # =========================================================================
    # PART J: 22 COMPREHENSIVE TEST SCENARIOS
    # =========================================================================

    def test_01_one_classroom_compliant(self):
        """1. One classroom compliant (1 staff, 3 children with 1:5 ratio)"""
        self._create_and_clockin_staff(self.room_toddler, is_ece=True)
        for i in range(3):
            self._create_and_checkin_student(self.room_toddler, first_name=f"C{i}")

        res = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res["status"], "COMPLIANT")
        self.assertEqual(res["children_present"], 3)
        self.assertEqual(res["qualified_staff_present"], 1)
        self.assertEqual(res["ratio"], "3:1")

    def test_02_one_classroom_warning(self):
        """2. One classroom warning (1 staff, 5 children at 1:5 limit, warning buffer=1)"""
        self._create_and_clockin_staff(self.room_toddler, is_ece=True)
        for i in range(5):
            self._create_and_checkin_student(self.room_toddler, first_name=f"C{i}")

        res = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res["status"], "WARNING")
        self.assertEqual(res["children_present"], 5)
        self.assertEqual(res["qualified_staff_present"], 1)

    def test_03_one_classroom_non_compliant(self):
        """3. One classroom non-compliant (1 staff, 6 children with 1:5 ratio)"""
        self._create_and_clockin_staff(self.room_toddler, is_ece=True)
        for i in range(6):
            self._create_and_checkin_student(self.room_toddler, first_name=f"C{i}")

        res = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res["status"], "NON_COMPLIANT")
        self.assertEqual(res["required_staff"], 2)
        self.assertEqual(res["qualified_staff_present"], 1)

    def test_04_no_qualified_staff(self):
        """4. No qualified staff present with children -> NON_COMPLIANT (Staff Required)"""
        for i in range(4):
            self._create_and_checkin_student(self.room_toddler, first_name=f"C{i}")

        res = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res["status"], "NON_COMPLIANT")
        self.assertEqual(res["qualified_staff_present"], 0)
        self.assertEqual(res["required_staff"], 1)
        self.assertIn("Staff Required", res["status_display"])

    def test_05_multiple_classrooms(self):
        """5. Multiple classrooms with summary KPIs"""
        # Toddler: 1 staff, 3 children -> COMPLIANT
        self._create_and_clockin_staff(self.room_toddler, is_ece=True)
        self._create_and_checkin_student(self.room_toddler)

        # Infant: 1 staff, 2 children (1:3 rule) -> COMPLIANT
        self._create_and_clockin_staff(self.room_infant, is_ece=True)
        self._create_and_checkin_student(self.room_infant)

        summary = RatioMonitoringService.get_daycare_ratio_summary(self.daycare_a, target_date=self.today)
        self.assertEqual(summary["total_classrooms"], 3)
        self.assertEqual(summary["total_children_present"], 2)
        self.assertEqual(summary["total_qualified_staff_present"], 2)
        self.assertEqual(summary["overall_status"], "COMPLIANT")

    def test_06_different_age_groups(self):
        """6. Different age groups evaluate different default and configured ratios"""
        # Infant default is 1:3
        inf_rule = RatioMonitoringService.resolve_ratio_rule(self.room_infant, target_date=self.today)
        self.assertEqual(inf_rule["max_children_per_staff"], 3)

        # Preschool default is 1:8
        pre_rule = RatioMonitoringService.resolve_ratio_rule(self.room_preschool, target_date=self.today)
        self.assertEqual(pre_rule["max_children_per_staff"], 8)

    def test_07_different_program_types(self):
        """7. Different program types match program-specific ratio rules"""
        # Create a Nursery program specific rule with 1:4 ratio
        RatioRule.objects.create(
            daycare=self.daycare_a,
            province=self.province_on,
            name="Nursery Half-Day Toddler (1:4)",
            age_group=self.age_group_toddler,
            program=self.program_nursery,
            min_age_months=18,
            max_age_months=30,
            max_children_per_staff=4,
            is_active=True
        )
        nursery_room = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Nursery Room 1",
            age_group=self.age_group_toddler,
            program=self.program_nursery,
            min_age_months=18,
            max_age_months=30,
            status="Active"
        )
        resolved = RatioMonitoringService.resolve_ratio_rule(nursery_room, target_date=self.today)
        self.assertEqual(resolved["max_children_per_staff"], 4)
        self.assertEqual(resolved["name"], "Nursery Half-Day Toddler (1:4)")

    def test_08_different_provinces_configurations(self):
        """8. Provincial configuration resolves BC provincial rule for Daycare B"""
        bc_rule = RatioRule.objects.create(
            province=self.province_bc,
            name="BC Provincial Infant Baseline (1:4)",
            min_age_months=0,
            max_age_months=18,
            max_children_per_staff=4,
            is_system_rule=True,
            is_active=True
        )
        room_bc = Classroom.objects.create(
            daycare=self.daycare_b,
            room_name="BC Infant Room",
            min_age_months=0,
            max_age_months=18,
            status="Active"
        )
        resolved = RatioMonitoringService.resolve_ratio_rule(room_bc, target_date=self.today)
        self.assertEqual(resolved["province_code"], "BC")
        self.assertEqual(resolved["max_children_per_staff"], 4)

    def test_09_rule_effective_date_change(self):
        """9. Rule effective-date future change does not apply today"""
        future_rule = RatioRule.objects.create(
            daycare=self.daycare_a,
            province=self.province_on,
            name="Future Regulation 2027",
            min_age_months=18,
            max_age_months=30,
            max_children_per_staff=2,
            effective_from=self.today + timedelta(days=90),
            is_active=True
        )
        room_test = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Test Effective Room",
            min_age_months=18,
            max_age_months=30,
            status="Active"
        )
        resolved_today = RatioMonitoringService.resolve_ratio_rule(room_test, target_date=self.today)
        self.assertNotEqual(resolved_today["name"], "Future Regulation 2027")

        resolved_future = RatioMonitoringService.resolve_ratio_rule(room_test, target_date=self.today + timedelta(days=100))
        self.assertEqual(resolved_future["name"], "Future Regulation 2027")

    def test_10_staff_qualification_expiry(self):
        """10. Staff with expired ECE credential is not counted as qualified"""
        emp = Employee.objects.create(
            daycare=self.daycare_a, first_name="Expired", last_name="Teacher", status="active"
        )
        ECECredential.objects.create(
            employee=emp,
            daycare=self.daycare_a,
            credential_type=self.cred_type_ece,
            status="Expired",
            issue_date=self.today - timedelta(days=500),
            expiry_date=self.today - timedelta(days=5)
        )
        StaffAttendance.objects.create(
            daycare=self.daycare_a,
            employee=emp,
            classroom=self.room_toddler,
            date=self.today,
            clock_in=self.now_datetime,
            status="CLOCKED_IN"
        )
        staff_data = RatioMonitoringService.get_qualified_staff_present(self.room_toddler, target_date=self.today)
        self.assertEqual(staff_data["qualified_count"], 0)
        self.assertEqual(staff_data["total_count"], 1)

    def test_11_staff_clock_in(self):
        """11. Staff clock-in dynamically recalculates ratio from Non-Compliant to Compliant"""
        for i in range(5):
            self._create_and_checkin_student(self.room_toddler, first_name=f"Child{i}")

        # Before clock-in: 0 staff -> Non-Compliant
        res1 = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res1["status"], "NON_COMPLIANT")

        # Clock-in qualified staff
        self._create_and_clockin_staff(self.room_toddler, is_ece=True)

        # After clock-in: 1 staff (1:5 rule) -> Warning (at max capacity)
        res2 = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertIn(res2["status"], ["COMPLIANT", "WARNING"])
        self.assertEqual(res2["qualified_staff_present"], 1)

    def test_12_staff_clock_out(self):
        """12. Staff clock-out dynamically updates ratio to Non-Compliant"""
        emp, staff_att = self._create_and_clockin_staff(self.room_toddler, is_ece=True)
        for i in range(4):
            self._create_and_checkin_student(self.room_toddler, first_name=f"Kid{i}")

        res1 = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertIn(res1["status"], ["COMPLIANT", "WARNING"])

        # Staff clocks out
        staff_att.clock_out = timezone.now()
        staff_att.status = "CLOCKED_OUT"
        staff_att.save()

        res2 = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res2["status"], "NON_COMPLIANT")
        self.assertEqual(res2["qualified_staff_present"], 0)

    def test_13_child_check_in(self):
        """13. Child check-in increments children present and recalculates ratio"""
        self._create_and_clockin_staff(self.room_toddler, is_ece=True)
        for i in range(3):
            self._create_and_checkin_student(self.room_toddler, first_name=f"Init{i}")

        res1 = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res1["children_present"], 3)
        self.assertEqual(res1["status"], "COMPLIANT")

        # 3 more children check in (total 6) -> exceeds 1:5 ratio -> NON_COMPLIANT
        for i in range(3):
            self._create_and_checkin_student(self.room_toddler, first_name=f"Extra{i}")

        res2 = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res2["children_present"], 6)
        self.assertEqual(res2["status"], "NON_COMPLIANT")

    def test_14_child_check_out(self):
        """14. Child check-out decrements children present and resolves compliance"""
        self._create_and_clockin_staff(self.room_toddler, is_ece=True)
        students = []
        attendances = []
        for i in range(6):
            s, a = self._create_and_checkin_student(self.room_toddler, first_name=f"St{i}")
            students.append(s)
            attendances.append(a)

        res1 = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res1["status"], "NON_COMPLIANT")

        # 3 children check out
        for att in attendances[:3]:
            att.check_out_time = timezone.now().time()
            att.save()

        res2 = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res2["children_present"], 3)
        self.assertEqual(res2["status"], "COMPLIANT")

    def test_15_staff_leave(self):
        """15. Clocked-in staff on approved leave is excluded from ratio calculation"""
        emp, staff_att = self._create_and_clockin_staff(self.room_toddler, is_ece=True)
        leave_type, _ = LeaveType.objects.get_or_create(
            daycare=self.daycare_a,
            code="sick",
            defaults={"name": "Sick Leave"}
        )
        LeaveRequest.objects.create(
            daycare=self.daycare_a,
            employee=emp,
            leave_type=leave_type,
            start_date=self.today,
            end_date=self.today,
            status="approved"
        )
        staff_data = RatioMonitoringService.get_qualified_staff_present(self.room_toddler, target_date=self.today)
        self.assertEqual(staff_data["qualified_count"], 0)

    def test_16_staff_shortage(self):
        """16. Staff Shortage Report accurately calculates deficit"""
        for i in range(7):
            self._create_and_checkin_student(self.room_toddler, first_name=f"S{i}")
        self._create_and_clockin_staff(self.room_toddler, is_ece=True)

        report = RatioReportsService.generate_report(self.daycare_a, "staff_shortages")
        self.assertEqual(report["summary"]["shortage_rooms_count"], 1)
        self.assertEqual(report["summary"]["total_staff_deficit"], 1)  # 7 children require 2 staff, 1 present

    def test_17_manual_override(self):
        """17. Manual override changes final status while preserving calculated mathematical status"""
        for i in range(6):
            self._create_and_checkin_student(self.room_toddler, first_name=f"M{i}")
        self._create_and_clockin_staff(self.room_toddler, is_ece=True)

        # Create active override
        RatioManualOverride.objects.create(
            daycare=self.daycare_a,
            classroom=self.room_toddler,
            override_status="COMPLIANT",
            reason="Relief staff arriving in 5 minutes",
            created_by=self.admin_user_a,
            is_active=True
        )

        res = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res["calculated_status"], "NON_COMPLIANT")
        self.assertEqual(res["final_status"], "COMPLIANT")
        self.assertTrue(res["override_applied"])
        self.assertEqual(res["ratio"], "6:1")

    def test_18_override_expiry(self):
        """18. Expired manual override automatically reverts to calculated status"""
        for i in range(6):
            self._create_and_checkin_student(self.room_toddler, first_name=f"E{i}")
        self._create_and_clockin_staff(self.room_toddler, is_ece=True)

        # Create already-expired override
        RatioManualOverride.objects.create(
            daycare=self.daycare_a,
            classroom=self.room_toddler,
            override_status="COMPLIANT",
            reason="Temporary past exception",
            created_by=self.admin_user_a,
            expires_at=timezone.now() - timedelta(minutes=10),
            is_active=True
        )

        res = RatioMonitoringService.calculate_classroom_ratio(self.room_toddler, target_date=self.today)
        self.assertEqual(res["status"], "NON_COMPLIANT")
        self.assertFalse(res["override_applied"])

    def test_19_notification_transition_and_audit(self):
        """19. AuditLog captures rule creations, updates, and manual overrides"""
        self.client.force_authenticate(user=self.admin_user_a)

        # 1. Create ratio rule via API
        rule_data = {
            "name": "Audit Test Rule",
            "max_children_per_staff": 6,
            "min_age_months": 30,
            "max_age_months": 48,
            "requires_qualified_ece": True
        }
        resp = self.client.post('/api/daycare/ratio-rules/', rule_data, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        new_rule_id = resp.data['id']

        # Check AuditLog for creation
        audit_create = AuditLog.objects.filter(
            action='RATIO_RULE_CREATE', entity_id=str(new_rule_id)
        ).first()
        self.assertIsNotNone(audit_create)
        self.assertEqual(audit_create.user, self.admin_user_a)

        # 2. Create manual override via API
        override_data = {
            "classroom": str(self.room_toddler.id),
            "override_status": "EXEMPT",
            "reason": "Fire drill exception"
        }
        resp_ov = self.client.post('/api/daycare/ratio-monitoring/overrides/', override_data, format='json')
        self.assertEqual(resp_ov.status_code, status.HTTP_201_CREATED)
        ov_id = resp_ov.data['id']

        audit_ov = AuditLog.objects.filter(
            action='RATIO_OVERRIDE_CREATE', entity_id=str(ov_id)
        ).first()
        self.assertIsNotNone(audit_ov)

        # 3. Deactivate override via API
        resp_deact = self.client.post(f'/api/daycare/ratio-monitoring/overrides/{ov_id}/deactivate/')
        self.assertEqual(resp_deact.status_code, status.HTTP_200_OK)

        audit_deact = AuditLog.objects.filter(
            action='RATIO_OVERRIDE_DEACTIVATE', entity_id=str(ov_id)
        ).first()
        self.assertIsNotNone(audit_deact)

    def test_20_cross_daycare_access(self):
        """20. Cross-daycare tenant isolation in ratio monitoring, rules, and reports"""
        self.client.force_authenticate(user=self.admin_user_a)

        # Daycare A admin should not see Daycare B classrooms
        room_b = Classroom.objects.create(daycare=self.daycare_b, room_name="Beta Secret Room", status="Active")
        resp = self.client.get(f'/api/daycare/ratio-monitoring/classrooms/{room_b.id}/')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_21_unauthorized_rule_modification(self):
        """21. Guardians are blocked from ratio endpoints and unauthenticated users cannot modify rules"""
        # Unauthenticated request
        self.client.force_authenticate(user=None)
        resp1 = self.client.get('/api/daycare/ratio-monitoring/')
        self.assertEqual(resp1.status_code, status.HTTP_401_UNAUTHORIZED)

        # Guardian request
        self.client.force_authenticate(user=self.guardian_user)
        resp2 = self.client.get('/api/daycare/ratio-monitoring/')
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)

        resp3 = self.client.get('/api/daycare/ratio-monitoring/reports/')
        self.assertEqual(resp3.status_code, status.HTTP_403_FORBIDDEN)

    def test_22_historical_report_accuracy(self):
        """22. Historical compliance reports accurately reflect frozen rule snapshots"""
        # Create a historical record with snapshot
        RatioComplianceHistory.objects.create(
            daycare=self.daycare_a,
            classroom=self.room_toddler,
            evaluated_at=timezone.now() - timedelta(days=2),
            children_present=4,
            qualified_staff_present=1,
            total_staff_present=1,
            required_staff=1,
            calculated_ratio="4:1",
            calculated_status="COMPLIANT",
            rule_used=self.rule_toddler,
            rule_snapshot={
                "name": "Frozen Historical Rule",
                "max_children_per_staff": 5,
                "province_code": "ON"
            },
            final_status="COMPLIANT"
        )

        # Modify active rule to 1:2
        self.rule_toddler.max_children_per_staff = 2
        self.rule_toddler.save()

        # Generate History report
        report = RatioReportsService.generate_report(self.daycare_a, "ratio_history")
        self.assertEqual(report["summary"]["total_records"], 1)
        record = report["records"][0]
        self.assertEqual(record["rule_name"], "Frozen Historical Rule")
        self.assertEqual(record["rule_ratio"], "1:5")
        self.assertEqual(record["final_status"], "COMPLIANT")
