import uuid
from datetime import date, time, datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import (
    Daycare, Classroom, Student, Employee, EmployeeType,
    ECECredential, CredentialType, EmployeeCertification, EmployeeQualification,
    Province, Program, AgeGroup, RatioRule, AuditLog
)
from daycare.services.qualified_staff import QualifiedStaffService
from daycare.services.ratio_rules_engine import RatioRulesEngineService

User = get_user_model()


class Module13Phase1RatioRulesEngineTests(APITestCase):
    """
    Module 13 Phase 1: Provincial Rules Engine Foundation Automated Test Suite.
    
    Covers:
    - Rule creation & updates
    - Effective dates & historical rule resolution
    - Duplicate & overlapping rule prevention
    - Age group & age range matching hierarchy
    - Staff qualification matching via QualifiedStaffService
    - Daycare isolation & multi-tenancy
    - Provincial configuration & system baseline fallback
    - Comprehensive rule validation
    - Role-based security & Guardian access prevention
    """

    def setUp(self):
        self.today = timezone.now().date()

        # 1. Provinces
        self.prov_on, _ = Province.objects.get_or_create(code="ON", defaults={"name": "Ontario", "status": "Active"})
        self.prov_bc, _ = Province.objects.get_or_create(code="BC", defaults={"name": "British Columbia", "status": "Active"})
        self.prov_ab, _ = Province.objects.get_or_create(code="AB", defaults={"name": "Alberta", "status": "Active"})

        # 2. Credential Types
        self.cred_type_ece_on, _ = CredentialType.objects.get_or_create(
            name="RECE Ontario",
            defaults={"category": "ece", "province": self.prov_on, "status": "Active"}
        )
        self.cred_type_ece_bc, _ = CredentialType.objects.get_or_create(
            name="ECE BC Certificate",
            defaults={"category": "ece", "province": self.prov_bc, "status": "Active"}
        )
        self.cred_type_first_aid, _ = CredentialType.objects.get_or_create(
            name="Standard Child Care First Aid",
            defaults={"category": "certification", "status": "Active"}
        )

        # 3. Daycares (Daycare A in ON, Daycare B in BC)
        self.daycare_a = Daycare.objects.create(
            name="Little Sprouts Academy (ON)",
            state="ON",
            province=self.prov_on,
            status="Active"
        )
        self.daycare_b = Daycare.objects.create(
            name="Pacific Coast Early Learning (BC)",
            state="BC",
            province=self.prov_bc,
            status="Active"
        )

        # 4. Users
        self.superadmin = User.objects.create_superuser(
            username="superadmin_test",
            email="superadmin@kidsynq.test",
            password="superpassword123"
        )
        self.admin_a = User.objects.create_user(
            username="admin_daycare_a",
            email="admin_a@kidsynq.test",
            password="password123",
            daycare=self.daycare_a
        )
        self.admin_b = User.objects.create_user(
            username="admin_daycare_b",
            email="admin_b@kidsynq.test",
            password="password123",
            daycare=self.daycare_b
        )
        self.guardian_user = User.objects.create_user(
            username="guardian_user",
            email="guardian@kidsynq.test",
            password="password123"
        )
        self.guardian_user.role = "Guardian"
        self.guardian_user.save()

        # 5. Programs & Age Groups
        self.program_fullday = Program.objects.create(
            daycare=self.daycare_a,
            name="Full Day Childcare",
            status="Active"
        )
        self.program_afterschool = Program.objects.create(
            daycare=self.daycare_a,
            name="After School Program",
            status="Active"
        )
        self.age_group_infant, _ = AgeGroup.objects.get_or_create(
            daycare=self.daycare_a,
            name="Infant",
            defaults={"min_age_months": 0, "max_age_months": 18}
        )
        self.age_group_toddler, _ = AgeGroup.objects.get_or_create(
            daycare=self.daycare_a,
            name="Toddler",
            defaults={"min_age_months": 18, "max_age_months": 30}
        )
        self.age_group_preschool, _ = AgeGroup.objects.get_or_create(
            daycare=self.daycare_a,
            name="Preschool",
            defaults={"min_age_months": 30, "max_age_months": 48}
        )

        # 6. Classrooms
        self.classroom_toddler = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Busy Bees (Toddler)",
            room_code="BB-TOD",
            capacity=15,
            age_group=self.age_group_toddler,
            program=self.program_fullday,
            min_age_months=18,
            max_age_months=30
        )

        # 7. Employee Types
        self.emp_type_lead_teacher = EmployeeType.objects.create(
            daycare=self.daycare_a,
            name="Lead Educator",
            is_eligible_for_classroom=True
        )
        self.emp_type_cook = EmployeeType.objects.create(
            daycare=self.daycare_a,
            name="Cook / Kitchen Staff",
            is_eligible_for_classroom=False
        )

        # 8. Employees in Daycare A
        self.staff_qualified = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Sarah",
            last_name="Jenkins",
            job_title="Lead Educator",
            status="Active"
        )
        self.staff_qualified.types.add(self.emp_type_lead_teacher)

        # Active RECE Credential for Sarah
        self.cred_sarah = ECECredential.objects.create(
            employee=self.staff_qualified,
            daycare=self.daycare_a,
            credential_type=self.cred_type_ece_on,
            certificate_number="RECE-ON-98765",
            province=self.prov_on,
            issue_date=self.today - timedelta(days=365),
            expiry_date=self.today + timedelta(days=365),
            status="Active"
        )

        self.staff_expired_cred = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="David",
            last_name="Miller",
            job_title="Educator",
            status="Active"
        )
        self.staff_expired_cred.types.add(self.emp_type_lead_teacher)
        ECECredential.objects.create(
            employee=self.staff_expired_cred,
            daycare=self.daycare_a,
            credential_type=self.cred_type_ece_on,
            certificate_number="RECE-ON-EXPIRED",
            province=self.prov_on,
            issue_date=self.today - timedelta(days=700),
            expiry_date=self.today - timedelta(days=30),  # Expired last month
            status="Expired"
        )

        self.staff_cook = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Gordon",
            last_name="Ramsay",
            job_title="Head Cook",
            status="Active"
        )
        self.staff_cook.types.add(self.emp_type_cook)

        self.staff_inactive = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Emily",
            last_name="Watson",
            job_title="Educator",
            status="Terminated"
        )

    # -------------------------------------------------------------------------
    # PART A & B: Rule Creation, Configuration & Retrieval
    # -------------------------------------------------------------------------

    def test_daycare_admin_can_create_custom_ratio_rule(self):
        """Daycare Admin can configure a custom ratio rule for their daycare with all fields."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse('ratio_rule_list')
        payload = {
            "name": "Infant High-Care Custom Rule (1:3)",
            "min_age_months": 0,
            "max_age_months": 18,
            "minimum_children": 1,
            "maximum_children": 10,
            "required_staff": 1,
            "qualified_staff_required": 1,
            "max_children_per_staff": 3,
            "warning_threshold_buffer": 1,
            "requires_qualified_ece": True,
            "qualification_requirement": "Certified ECE",
            "effective_from": (self.today - timedelta(days=10)).isoformat(),
            "notes": "Custom high-care infant ratio configured by daycare admin"
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], payload["name"])
        self.assertEqual(response.data["max_children_per_staff"], 3)
        self.assertEqual(str(response.data["daycare"]), str(self.daycare_a.id))
        self.assertEqual(response.data["created_by_name"], self.admin_a.username)

        # Check DB & AuditLog
        rule_in_db = RatioRule.objects.get(id=response.data["id"])
        self.assertEqual(rule_in_db.daycare, self.daycare_a)
        self.assertEqual(rule_in_db.created_by, self.admin_a)
        self.assertTrue(AuditLog.objects.filter(entity_type="RatioRule", action="RATIO_RULE_CREATE").exists())

    def test_superadmin_can_create_system_baseline_provincial_rule(self):
        """Super Admin can configure a provincial system baseline rule (daycare is None)."""
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('admin_system_ratio_rules')
        payload = {
            "name": "Ontario CCEYA Toddler Baseline (1:5)",
            "province": str(self.prov_on.id),
            "min_age_months": 18,
            "max_age_months": 30,
            "max_children_per_staff": 5,
            "required_staff": 1,
            "qualified_staff_required": 1,
            "warning_threshold_buffer": 1,
            "requires_qualified_ece": True,
            "qualification_requirement": "RECE Ontario",
            "effective_from": (self.today - timedelta(days=100)).isoformat()
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["is_system_rule"])
        self.assertIsNone(response.data["daycare"])
        self.assertEqual(response.data["province_code"], "ON")

    def test_rule_update_and_audit_logging(self):
        """Updating rule parameters persists changes and creates an audit trail."""
        rule = RatioRule.objects.create(
            daycare=self.daycare_a,
            name="Toddler Standard (1:5)",
            min_age_months=18,
            max_age_months=30,
            max_children_per_staff=5,
            effective_from=self.today - timedelta(days=50)
        )
        self.client.force_authenticate(user=self.admin_a)
        url = reverse('ratio_rule_detail', kwargs={'pk': rule.id})
        response = self.client.patch(url, {"max_children_per_staff": 4, "notes": "Updated to 1:4"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rule.refresh_from_db()
        self.assertEqual(rule.max_children_per_staff, 4)
        self.assertEqual(rule.updated_by, self.admin_a)
        self.assertTrue(AuditLog.objects.filter(entity_id=str(rule.id), action="RATIO_RULE_UPDATE").exists())

    # -------------------------------------------------------------------------
    # PART C: Effective Dates & Historical Rule Resolution
    # -------------------------------------------------------------------------

    def test_effective_dates_historical_resolution(self):
        """Historical rule lookups return the rule active on the requested target date."""
        # 2025 rule (1:4) active until 2025-12-31
        rule_2025 = RatioRule.objects.create(
            daycare=self.daycare_a,
            name="Preschool 2025 Policy (1:4)",
            age_group=self.age_group_preschool,
            min_age_months=30,
            max_age_months=48,
            max_children_per_staff=4,
            effective_from=date(2025, 1, 1),
            effective_to=date(2025, 12, 31)
        )
        # 2026 rule (1:8) active from 2026-01-01
        rule_2026 = RatioRule.objects.create(
            daycare=self.daycare_a,
            name="Preschool 2026 Policy (1:8)",
            age_group=self.age_group_preschool,
            min_age_months=30,
            max_age_months=48,
            max_children_per_staff=8,
            effective_from=date(2026, 1, 1),
            effective_to=None
        )

        # Lookup in mid-2025
        res_2025 = RatioRulesEngineService.resolve_applicable_rule(
            daycare=self.daycare_a,
            age_group=self.age_group_preschool,
            target_date=date(2025, 6, 15)
        )
        self.assertEqual(res_2025["rule_id"], str(rule_2025.id))
        self.assertEqual(res_2025["max_children_per_staff"], 4)

        # Lookup in 2026
        res_2026 = RatioRulesEngineService.resolve_applicable_rule(
            daycare=self.daycare_a,
            age_group=self.age_group_preschool,
            target_date=date(2026, 5, 1)
        )
        self.assertEqual(res_2026["rule_id"], str(rule_2026.id))
        self.assertEqual(res_2026["max_children_per_staff"], 8)

    def test_rule_versioning_action(self):
        """POST /api/daycare/ratio-rules/<id>/version/ creates a historical version without overwriting past config."""
        initial_rule = RatioRule.objects.create(
            daycare=self.daycare_a,
            name="Toddler Base 2026 (1:5)",
            age_group=self.age_group_toddler,
            min_age_months=18,
            max_age_months=30,
            max_children_per_staff=5,
            effective_from=date(2026, 1, 1),
            effective_to=None
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse('ratio_rule_version', kwargs={'pk': initial_rule.id})
        payload = {
            "effective_date": "2026-07-01",
            "name": "Toddler Revised Summer 2026 (1:4)",
            "max_children_per_staff": 4,
            "notes": "Reduced ratio for summer sessions"
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        initial_rule.refresh_from_db()
        self.assertEqual(initial_rule.effective_to, date(2026, 6, 30))

        new_rule = RatioRule.objects.get(id=response.data["new_rule"]["id"])
        self.assertEqual(new_rule.effective_from, date(2026, 7, 1))
        self.assertEqual(new_rule.max_children_per_staff, 4)
        self.assertIsNone(new_rule.effective_to)

    # -------------------------------------------------------------------------
    # PART D: Staff Qualification Matching (QualifiedStaffService)
    # -------------------------------------------------------------------------

    def test_qualified_staff_service_active_ece(self):
        """Staff with active RECE credential qualifies under rule requiring ECE."""
        rule = RatioRule.objects.create(
            daycare=self.daycare_a,
            name="Preschool Rule Requiring ECE",
            requires_qualified_ece=True,
            qualification_requirement="RECE Ontario"
        )
        eval_res = QualifiedStaffService.evaluate_staff_qualification(
            employee=self.staff_qualified,
            rule=rule,
            target_date=self.today
        )
        self.assertTrue(eval_res["is_qualified"])
        self.assertTrue(eval_res["is_active"])
        self.assertTrue(eval_res["can_teach"])
        self.assertEqual(len(eval_res["active_credentials"]), 1)
        self.assertEqual(len(eval_res["disqualification_reasons"]), 0)

    def test_qualified_staff_service_expired_ece_disqualified(self):
        """Staff with expired credential is disqualified with explanatory reason."""
        rule = RatioRule.objects.create(
            daycare=self.daycare_a,
            name="Preschool Rule Requiring ECE",
            requires_qualified_ece=True,
            qualification_requirement="RECE Ontario"
        )
        eval_res = QualifiedStaffService.evaluate_staff_qualification(
            employee=self.staff_expired_cred,
            rule=rule,
            target_date=self.today
        )
        self.assertFalse(eval_res["is_qualified"])
        self.assertIn("does not hold an active, non-expired qualification", eval_res["disqualification_reasons"][0])

    def test_qualified_staff_service_non_teaching_role_disqualified(self):
        """Non-teaching staff role (e.g. Cook/Janitor) is disqualified from classroom ratio count."""
        rule = RatioRule.objects.create(
            daycare=self.daycare_a,
            name="Toddler Rule",
            requires_qualified_ece=False
        )
        eval_res = QualifiedStaffService.evaluate_staff_qualification(
            employee=self.staff_cook,
            rule=rule,
            target_date=self.today
        )
        self.assertFalse(eval_res["is_qualified"])
        self.assertFalse(eval_res["can_teach"])
        self.assertIn("not eligible for classroom teaching", eval_res["disqualification_reasons"][0])

    def test_qualified_staff_service_inactive_staff_disqualified(self):
        """Terminated or inactive staff member is disqualified."""
        eval_res = QualifiedStaffService.evaluate_staff_qualification(
            employee=self.staff_inactive,
            target_date=self.today
        )
        self.assertFalse(eval_res["is_qualified"])
        self.assertFalse(eval_res["is_active"])

    def test_qualification_evaluation_api(self):
        """POST /api/daycare/ratio-rules/evaluate-qualification/ returns qualification report."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse('ratio_rule_evaluate_qualification')
        payload = {
            "employee_id": str(self.staff_qualified.id),
            "date": self.today.isoformat()
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_qualified"])
        self.assertEqual(response.data["name"], "Sarah Jenkins")

    # -------------------------------------------------------------------------
    # PART E: Rule Validation & Duplicate Overlaps
    # -------------------------------------------------------------------------

    def test_validation_prevents_duplicate_overlapping_rules(self):
        """Creating an active rule with overlapping date range for the same scope raises validation error."""
        RatioRule.objects.create(
            daycare=self.daycare_a,
            name="Existing Infant Rule",
            age_group=self.age_group_infant,
            min_age_months=0,
            max_age_months=18,
            effective_from=date(2026, 1, 1),
            effective_to=date(2026, 12, 31),
            is_active=True
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse('ratio_rule_list')
        payload = {
            "name": "Conflicting Infant Rule",
            "age_group": str(self.age_group_infant.id),
            "min_age_months": 0,
            "max_age_months": 18,
            "max_children_per_staff": 3,
            "effective_from": "2026-06-01",  # Overlaps with existing rule
            "effective_to": "2027-06-01"
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)
        self.assertIn("overlapping", str(response.data["non_field_errors"][0]).lower())

    def test_validation_invalid_date_ranges(self):
        """effective_to cannot be earlier than effective_from."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse('ratio_rule_list')
        payload = {
            "name": "Invalid Date Rule",
            "min_age_months": 0,
            "max_age_months": 18,
            "max_children_per_staff": 3,
            "effective_from": "2026-10-01",
            "effective_to": "2026-05-01"  # earlier than from
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("effective_to", response.data)

    def test_validation_negative_and_illogical_values(self):
        """Negative counts, buffer, or qualified_staff > required_staff are rejected."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse('ratio_rule_list')

        # Negative minimum children
        res = self.client.post(url, {
            "name": "Negative Test",
            "min_age_months": 0,
            "max_age_months": 18,
            "minimum_children": -5,
            "max_children_per_staff": 3
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # qualified_staff > required_staff
        res2 = self.client.post(url, {
            "name": "Qualified Staff Exceeds Test",
            "min_age_months": 0,
            "max_age_months": 18,
            "required_staff": 1,
            "qualified_staff_required": 3,
            "max_children_per_staff": 3
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("qualified_staff_required", res2.data)

    # -------------------------------------------------------------------------
    # Multi-Tenancy & Provincial Configuration
    # -------------------------------------------------------------------------

    def test_daycare_isolation(self):
        """Daycare A rules cannot be accessed, updated, or applied to Daycare B."""
        rule_a = RatioRule.objects.create(
            daycare=self.daycare_a,
            name="Daycare A Proprietary Rule (1:2)",
            min_age_months=0,
            max_age_months=18,
            max_children_per_staff=2
        )

        # Daycare B admin attempts to access Daycare A's rule
        self.client.force_authenticate(user=self.admin_b)
        url = reverse('ratio_rule_detail', kwargs={'pk': rule_a.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Daycare B rule resolution does NOT pick up Daycare A rule
        res_b = RatioRulesEngineService.resolve_applicable_rule(
            daycare=self.daycare_b,
            age_months=10,
            target_date=self.today
        )
        self.assertNotEqual(res_b.get("rule_id"), str(rule_a.id))

    def test_province_configuration_and_baseline_resolution(self):
        """Daycare in ON resolves Ontario baseline rule; Daycare in BC resolves BC baseline rule."""
        # Ontario Baseline Rule (1:5)
        sys_rule_on = RatioRule.objects.create(
            province=self.prov_on,
            name="CCEYA Ontario Toddler Baseline (1:5)",
            min_age_months=18,
            max_age_months=30,
            max_children_per_staff=5,
            is_system_rule=True,
            effective_from=date(2025, 1, 1)
        )
        # BC Baseline Rule (1:4)
        sys_rule_bc = RatioRule.objects.create(
            province=self.prov_bc,
            name="BC Childcare Licensing Toddler Baseline (1:4)",
            min_age_months=18,
            max_age_months=30,
            max_children_per_staff=4,
            is_system_rule=True,
            effective_from=date(2025, 1, 1)
        )

        # Daycare A (in ON) resolves ON baseline
        res_on = RatioRulesEngineService.resolve_applicable_rule(
            daycare=self.daycare_a,
            age_months=24,
            target_date=self.today
        )
        self.assertEqual(res_on["rule_id"], str(sys_rule_on.id))
        self.assertEqual(res_on["max_children_per_staff"], 5)
        self.assertEqual(res_on["province"], "ON")

        # Daycare B (in BC) resolves BC baseline
        res_bc = RatioRulesEngineService.resolve_applicable_rule(
            daycare=self.daycare_b,
            age_months=24,
            target_date=self.today
        )
        self.assertEqual(res_bc["rule_id"], str(sys_rule_bc.id))
        self.assertEqual(res_bc["max_children_per_staff"], 4)
        self.assertEqual(res_bc["province"], "BC")

    # -------------------------------------------------------------------------
    # PART F: Security & Guardian Protection
    # -------------------------------------------------------------------------

    def test_guardians_cannot_access_internal_ratio_rules(self):
        """Guardians are strictly forbidden from viewing or modifying internal ratio rules."""
        self.client.force_authenticate(user=self.guardian_user)
        url = reverse('ratio_rule_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        url_lookup = reverse('ratio_rule_lookup')
        res_lookup = self.client.get(url_lookup)
        self.assertEqual(res_lookup.status_code, status.HTTP_403_FORBIDDEN)
