import uuid
from datetime import date, datetime, timedelta, time
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    User, Daycare, Classroom, Student, StudentAttendance, 
    Employee, StaffAttendance, ECECredential, CredentialType, 
    Province, AgeGroup, Program, RatioRule, RatioManualOverride, 
    RatioComplianceHistory
)
from daycare.services.ratio_monitoring import RatioMonitoringService


class RatioMonitoringPhase4Tests(TestCase):
    """
    Module 13 Phase 4: Provincial Configuration, Program Types, Rule Explanations,
    Manual Overrides, and Immutable Compliance History Tests.
    """

    def setUp(self):
        self.client = APIClient()
        self.today = timezone.now().date()
        self.now = timezone.now()

        # 1. Provinces
        self.province_on, _ = Province.objects.get_or_create(code='ON', defaults={'name': 'Ontario', 'status': 'Active'})
        self.province_bc, _ = Province.objects.get_or_create(code='BC', defaults={'name': 'British Columbia', 'status': 'Active'})

        # 2. Credential Type
        self.cred_type_ece, _ = CredentialType.objects.get_or_create(
            name='Registered ECE Certificate',
            defaults={'category': 'ece', 'province': self.province_on, 'status': 'Active'}
        )

        # 3. Daycare A (Ontario)
        self.daycare_a = Daycare.objects.create(
            name="Sunshine Early Learning Center",
            state="ON",
            province=self.province_on,
            status="Active"
        )
        self.admin_user_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@sunshine.com",
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

        # 4. Daycare B (British Columbia - Tenant Isolation)
        self.daycare_b = Daycare.objects.create(
            name="Pacific Coast Daycare",
            state="BC",
            province=self.province_bc,
            status="Active"
        )
        self.admin_user_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@pacific.com",
            password="Password123!",
            daycare=self.daycare_b
        )

        # 5. Super Admin User
        self.super_user = User.objects.create_superuser(
            username="superadmin",
            email="superadmin@kidsynq.com",
            password="SuperPassword123!"
        )

        # 6. Programs
        self.program_full_day = Program.objects.create(
            daycare=self.daycare_a,
            name="Full Day Early Learning",
            status="Active"
        )
        self.program_nursery = Program.objects.create(
            daycare=self.daycare_a,
            name="Nursery Half-Day",
            status="Active"
        )

        # 7. Age Groups
        self.age_group_toddler, _ = AgeGroup.objects.get_or_create(
            name="Toddler Group",
            defaults={'min_age_months': 18, 'max_age_months': 30, 'daycare': self.daycare_a}
        )
        self.age_group_preschool, _ = AgeGroup.objects.get_or_create(
            name="Preschool Group",
            defaults={'min_age_months': 31, 'max_age_months': 60, 'daycare': self.daycare_a}
        )

        # 8. Classrooms
        self.classroom_toddler = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Busy Toddlers",
            room_code="TOD-101",
            age_group=self.age_group_toddler,
            program=self.program_full_day,
            min_age_months=18,
            max_age_months=30,
            capacity=15,
            status="Active"
        )
        self.classroom_preschool = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Bright Preschool",
            room_code="PRE-201",
            age_group=self.age_group_preschool,
            program=self.program_nursery,
            min_age_months=31,
            max_age_months=60,
            capacity=20,
            status="Active"
        )

        # 9. System-level Provincial Rules
        self.sys_rule_on_toddler = RatioRule.objects.create(
            daycare=None,
            is_system_rule=True,
            province=self.province_on,
            age_group=self.age_group_toddler,
            name="Ontario Toddler Baseline",
            min_age_months=18,
            max_age_months=30,
            max_children_per_staff=5,
            warning_threshold_buffer=1,
            requires_qualified_ece=True,
            qualification_requirement="Ontario Registered ECE",
            effective_from=date(2025, 1, 1),
            is_active=True
        )
        self.sys_rule_bc_toddler = RatioRule.objects.create(
            daycare=None,
            is_system_rule=True,
            province=self.province_bc,
            name="BC Toddler Baseline",
            min_age_months=18,
            max_age_months=30,
            max_children_per_staff=4,
            warning_threshold_buffer=1,
            requires_qualified_ece=True,
            qualification_requirement="BC Certified ECE",
            effective_from=date(2025, 1, 1),
            is_active=True
        )

    def _create_child_with_attendance(self, classroom, first_name, last_name):
        student = Student.objects.create(
            daycare=classroom.daycare,
            first_name=first_name,
            last_name=last_name,
            status="Active"
        )
        att = StudentAttendance.objects.create(
            daycare=classroom.daycare,
            student=student,
            classroom=classroom,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30),
            check_out_time=None
        )
        return student, att

    def _create_staff_with_attendance(self, classroom, first_name, last_name, is_qualified=True):
        user = User.objects.create_user(
            username=f"{first_name.lower()}_{last_name.lower()}_{uuid.uuid4().hex[:4]}",
            email=f"{first_name.lower()}@sunshine.com",
            password="StaffPassword123!",
            daycare=classroom.daycare
        )
        emp = Employee.objects.create(
            user=user,
            daycare=classroom.daycare,
            first_name=first_name,
            last_name=last_name,
            role="Educator",
            status="active"
        )
        if is_qualified:
            ECECredential.objects.create(
                employee=emp,
                daycare=classroom.daycare,
                credential_type=self.cred_type_ece,
                status="Active",
                issue_date=date(2024, 1, 1),
                expiry_date=date(2028, 1, 1)
            )
        att = StaffAttendance.objects.create(
            daycare=classroom.daycare,
            employee=emp,
            classroom=classroom,
            date=self.today,
            status="CLOCKED_IN",
            clock_in=timezone.make_aware(datetime.combine(self.today, time(8, 0))),
            check_in_time=time(8, 0),
            clock_out=None
        )
        return emp, att

    def test_01_province_specific_rule_selection(self):
        """Daycare in Ontario resolves ON provincial rule; Daycare in BC resolves BC provincial rule."""
        rule_a = RatioMonitoringService.resolve_ratio_rule(self.classroom_toddler, target_date=self.today)
        self.assertEqual(rule_a["max_children_per_staff"], 5)
        self.assertEqual(rule_a["province_code"], "ON")

        classroom_b = Classroom.objects.create(
            daycare=self.daycare_b,
            room_name="BC Toddler Room",
            min_age_months=18,
            max_age_months=30,
            status="Active"
        )
        rule_b = RatioMonitoringService.resolve_ratio_rule(classroom_b, target_date=self.today)
        self.assertEqual(rule_b["max_children_per_staff"], 4)
        self.assertEqual(rule_b["province_code"], "BC")

    def test_02_program_specific_rule_selection(self):
        """Custom Program-specific rule takes precedence for classrooms enrolled in that program."""
        custom_program_rule = RatioRule.objects.create(
            daycare=self.daycare_a,
            program=self.program_nursery,
            name="Nursery Reduced Ratio",
            min_age_months=31,
            max_age_months=60,
            max_children_per_staff=6,
            warning_threshold_buffer=1,
            requires_qualified_ece=True,
            effective_from=date(2026, 1, 1),
            is_active=True
        )
        rule = RatioMonitoringService.resolve_ratio_rule(self.classroom_preschool, target_date=self.today)
        self.assertEqual(rule["rule_id"], str(custom_program_rule.id))
        self.assertEqual(rule["max_children_per_staff"], 6)
        self.assertTrue(rule["is_custom"])

    def test_03_effective_dates_future_vs_current(self):
        """Future effective rules must not apply before their effective_from date."""
        future_rule = RatioRule.objects.create(
            daycare=self.daycare_a,
            name="Upcoming 2027 Policy",
            age_group=self.age_group_toddler,
            min_age_months=18,
            max_age_months=30,
            max_children_per_staff=3,
            effective_from=self.today + timedelta(days=60),
            is_active=True
        )
        # For today: should NOT use future rule
        current_rule = RatioMonitoringService.resolve_ratio_rule(self.classroom_toddler, target_date=self.today)
        self.assertNotEqual(current_rule["max_children_per_staff"], 3)

        # For future date: should use future rule
        future_date = self.today + timedelta(days=90)
        future_resolved = RatioMonitoringService.resolve_ratio_rule(self.classroom_toddler, target_date=future_date)
        self.assertEqual(future_resolved["max_children_per_staff"], 3)

    def test_04_effective_dates_expired_rule(self):
        """Expired rules (effective_to in past) must not be applied."""
        expired_rule = RatioRule.objects.create(
            daycare=self.daycare_a,
            name="Old Expired Policy",
            age_group=self.age_group_toddler,
            min_age_months=18,
            max_age_months=30,
            max_children_per_staff=2,
            effective_from=self.today - timedelta(days=100),
            effective_to=self.today - timedelta(days=10),
            is_active=True
        )
        resolved = RatioMonitoringService.resolve_ratio_rule(self.classroom_toddler, target_date=self.today)
        self.assertNotEqual(resolved["max_children_per_staff"], 2)

    def test_05_rule_explanation_metadata_complete(self):
        """Rule calculation result returns rich explanation metadata and legal disclaimer."""
        self._create_child_with_attendance(self.classroom_toddler, "Tommy", "Test")
        self._create_staff_with_attendance(self.classroom_toddler, "Sarah", "Teacher", is_qualified=True)

        res = RatioMonitoringService.calculate_classroom_ratio(self.classroom_toddler, target_date=self.today)
        expl = res.get("rule_explanation")
        self.assertIsNotNone(expl)
        self.assertEqual(expl["province_code"], "ON")
        self.assertEqual(expl["max_children_per_staff"], 5)
        self.assertEqual(expl["required_staff"], 1)
        self.assertIn("disclaimer", expl)
        self.assertIn("Configurable", expl["disclaimer"])

    def test_06_historical_compliance_snapshot_logging(self):
        """Calling log_compliance_snapshot creates an immutable record in RatioComplianceHistory."""
        for i in range(4):
            self._create_child_with_attendance(self.classroom_toddler, f"Child{i}", "Test")
        self._create_staff_with_attendance(self.classroom_toddler, "Emma", "Educator", is_qualified=True)

        history = RatioMonitoringService.log_compliance_snapshot(self.classroom_toddler, target_date=self.today)
        self.assertIsNotNone(history.id)
        self.assertEqual(history.children_present, 4)
        self.assertEqual(history.qualified_staff_present, 1)
        self.assertEqual(history.calculated_status, "WARNING") # 4 children with 1:5 rule (warning buffer=1)
        self.assertIn("max_children_per_staff", history.rule_snapshot)
        self.assertEqual(history.rule_snapshot["max_children_per_staff"], 5)

    def test_07_historical_records_immutability(self):
        """Modifying a RatioRule after a snapshot does NOT change historical rule_snapshot."""
        self._create_child_with_attendance(self.classroom_toddler, "Leo", "Toddler")
        self._create_staff_with_attendance(self.classroom_toddler, "Chloe", "Educator")

        history = RatioMonitoringService.log_compliance_snapshot(self.classroom_toddler, target_date=self.today)
        self.assertEqual(history.rule_snapshot["max_children_per_staff"], 5)

        # Modify the rule in the database
        self.sys_rule_on_toddler.max_children_per_staff = 2
        self.sys_rule_on_toddler.save()

        # Refetch historical record from database
        refetched_history = RatioComplianceHistory.objects.get(id=history.id)
        self.assertEqual(refetched_history.rule_snapshot["max_children_per_staff"], 5)

    def test_08_manual_override_creation_and_effect(self):
        """Active manual override sets effective status while keeping underlying calculated_status intact."""
        # 6 children with 1 staff -> Algorithmic status is NON_COMPLIANT
        for i in range(6):
            self._create_child_with_attendance(self.classroom_toddler, f"Kid{i}", "Test")
        self._create_staff_with_attendance(self.classroom_toddler, "Grace", "Educator")

        # Before override: NON_COMPLIANT
        before_calc = RatioMonitoringService.calculate_classroom_ratio(self.classroom_toddler, target_date=self.today)
        self.assertEqual(before_calc["calculated_status"], "NON_COMPLIANT")
        self.assertEqual(before_calc["status"], "NON_COMPLIANT")
        self.assertFalse(before_calc["override_applied"])

        # Create Manual Override (e.g. emergency temporary exemption)
        override = RatioManualOverride.objects.create(
            daycare=self.daycare_a,
            classroom=self.classroom_toddler,
            override_status="EXEMPT",
            reason="Emergency supervisor on-site inspection permitted 1-hour exemption",
            created_by=self.admin_user_a,
            expires_at=timezone.now() + timedelta(hours=2),
            is_active=True
        )

        after_calc = RatioMonitoringService.calculate_classroom_ratio(self.classroom_toddler, target_date=self.today)
        self.assertTrue(after_calc["override_applied"])
        self.assertEqual(after_calc["calculated_status"], "NON_COMPLIANT") # Underlying untouched
        self.assertEqual(after_calc["status"], "EXEMPT") # Effective status changed
        self.assertEqual(after_calc["override"]["override_status"], "EXEMPT")
        self.assertEqual(after_calc["override"]["reason"], override.reason)

    def test_09_manual_override_never_modifies_underlying_ratio(self):
        """Override does not change children count, staff count, or ratio string."""
        for i in range(7):
            self._create_child_with_attendance(self.classroom_toddler, f"Student{i}", "Sample")
        self._create_staff_with_attendance(self.classroom_toddler, "Hannah", "Teacher")

        RatioManualOverride.objects.create(
            daycare=self.daycare_a,
            classroom=self.classroom_toddler,
            override_status="COMPLIANT",
            reason="Approved management override",
            created_by=self.admin_user_a,
            is_active=True
        )

        res = RatioMonitoringService.calculate_classroom_ratio(self.classroom_toddler, target_date=self.today)
        self.assertEqual(res["children_present"], 7)
        self.assertEqual(res["qualified_staff_present"], 1)
        self.assertEqual(res["ratio"], "7:1")
        self.assertEqual(res["calculated_status"], "NON_COMPLIANT")
        self.assertEqual(res["status"], "COMPLIANT")

    def test_10_manual_override_expiry(self):
        """Expired override no longer overrides the effective status."""
        for i in range(6):
            self._create_child_with_attendance(self.classroom_toddler, f"Child{i}", "Test")
        self._create_staff_with_attendance(self.classroom_toddler, "Ivy", "Teacher")

        # Create expired override (expired 10 minutes ago)
        RatioManualOverride.objects.create(
            daycare=self.daycare_a,
            classroom=self.classroom_toddler,
            override_status="COMPLIANT",
            reason="Expired temporary override",
            created_by=self.admin_user_a,
            expires_at=timezone.now() - timedelta(minutes=10),
            is_active=True
        )

        res = RatioMonitoringService.calculate_classroom_ratio(self.classroom_toddler, target_date=self.today)
        self.assertFalse(res["override_applied"])
        self.assertEqual(res["status"], "NON_COMPLIANT")

    def test_11_compliance_history_api_filtering(self):
        """REST API GET /api/daycare/ratio-monitoring/history/ supports filtering."""
        # Create historical logs
        self._create_child_with_attendance(self.classroom_toddler, "Jack", "A")
        self._create_staff_with_attendance(self.classroom_toddler, "Kelly", "B")
        RatioMonitoringService.log_compliance_snapshot(self.classroom_toddler, target_date=self.today)

        self.client.force_authenticate(user=self.admin_user_a)
        url = "/api/daycare/ratio-monitoring/history/"

        res = self.client.get(url, {'classroom_id': str(self.classroom_toddler.id)})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data['results'] if 'results' in res.data else res.data), 1)

    def test_12_manual_override_api_crud(self):
        """REST API CRUD for manual overrides."""
        self.client.force_authenticate(user=self.admin_user_a)
        url = "/api/daycare/ratio-monitoring/overrides/"

        # Create override
        post_data = {
            "classroom": str(self.classroom_toddler.id),
            "override_status": "COMPLIANT",
            "reason": "Director approved temporary staffing variance",
            "expires_at": (timezone.now() + timedelta(hours=3)).isoformat()
        }
        res = self.client.post(url, post_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        override_id = res.data["id"]

        # List overrides
        get_res = self.client.get(url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)

        # Deactivate override
        patch_res = self.client.patch(f"{url}{override_id}/", {"is_active": False}, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertFalse(patch_res.data["is_active"])

    def test_13_cross_daycare_tenant_isolation(self):
        """Daycare B user cannot access Daycare A's ratio rules, overrides, or compliance history."""
        # Create history and override in Daycare A
        history = RatioMonitoringService.log_compliance_snapshot(self.classroom_toddler, target_date=self.today)
        override = RatioManualOverride.objects.create(
            daycare=self.daycare_a,
            classroom=self.classroom_toddler,
            override_status="COMPLIANT",
            reason="Daycare A Private Override",
            created_by=self.admin_user_a
        )

        self.client.force_authenticate(user=self.admin_user_b)
        
        # Daycare B queries history -> should NOT see Daycare A's history
        res_hist = self.client.get("/api/daycare/ratio-monitoring/history/")
        items_hist = res_hist.data.get('results', res_hist.data) if isinstance(res_hist.data, dict) else res_hist.data
        hist_ids = [str(item['id']) for item in items_hist]
        self.assertNotIn(str(history.id), hist_ids)

        # Daycare B queries overrides -> should NOT see Daycare A's override
        res_ov = self.client.get("/api/daycare/ratio-monitoring/overrides/")
        items_ov = res_ov.data.get('results', res_ov.data) if isinstance(res_ov.data, dict) else res_ov.data
        ov_ids = [str(item['id']) for item in items_ov]
        self.assertNotIn(str(override.id), ov_ids)

    def test_14_superadmin_system_ratio_rules_api(self):
        """Super Admin can manage system-level baseline ratio rules via /api/super-admin/ratio-rules/."""
        self.client.force_authenticate(user=self.super_user)
        url = "/api/super-admin/ratio-rules/"

        # List system rules
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Create system rule for Alberta
        province_ab, _ = Province.objects.get_or_create(code='AB', defaults={'name': 'Alberta', 'status': 'Active'})
        post_data = {
            "name": "Alberta Infant Baseline",
            "province": str(province_ab.id),
            "min_age_months": 0,
            "max_age_months": 18,
            "max_children_per_staff": 3,
            "warning_threshold_buffer": 1,
            "requires_qualified_ece": True,
            "qualification_requirement": "Alberta Child Care Staff Certificate Level 2+",
            "effective_from": "2026-01-01",
            "is_system_rule": True
        }
        create_res = self.client.post(url, post_data, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(create_res.data["is_system_rule"])
        self.assertIsNone(create_res.data["daycare"])

    def test_15_daycare_summary_with_overrides(self):
        """Daycare master summary aggregates overridden classroom counts properly."""
        for i in range(6):
            self._create_child_with_attendance(self.classroom_toddler, f"Toddler{i}", "Test")
        self._create_staff_with_attendance(self.classroom_toddler, "Teacher1", "Staff")

        RatioManualOverride.objects.create(
            daycare=self.daycare_a,
            classroom=self.classroom_toddler,
            override_status="COMPLIANT",
            reason="Variance permit #123",
            created_by=self.admin_user_a,
            is_active=True
        )

        summary = RatioMonitoringService.get_daycare_ratio_summary(self.daycare_a, target_date=self.today)
        self.assertEqual(summary["overridden_classrooms_count"], 1)
        self.assertEqual(summary["compliant_classrooms_count"], 2) # Both rooms compliant (1 naturally empty, 1 overridden)
