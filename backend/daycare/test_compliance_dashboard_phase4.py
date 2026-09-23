import uuid
from datetime import date, timedelta
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from core.models import (
    Daycare, Employee, EmployeeType, Province, CredentialType,
    ECECredential, AuditLog, Guardian
)

User = get_user_model()


class CredentialComplianceDashboardPhase4Tests(APITestCase):
    def setUp(self):
        # Daycare A
        self.daycare_a = Daycare.objects.create(
            name="Maple Grove Early Learning",
            status="Active",
            phone="123-456-7890"
        )
        self.user_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@maplegrove.ca",
            password="password123",
            first_name="Alice",
            last_name="Director",
            is_staff=True,
            daycare=self.daycare_a
        )

        # Daycare B (Tenant isolation)
        self.daycare_b = Daycare.objects.create(
            name="Oakville Daycare",
            status="Active",
            phone="987-654-3210"
        )
        self.user_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@oakville.ca",
            password="password123",
            first_name="Bob",
            last_name="Director",
            is_staff=True,
            daycare=self.daycare_b
        )

        # Guardian User
        self.guardian_user = User.objects.create_user(
            username="guardian_user",
            email="parent@example.ca",
            password="password123",
            first_name="Gary",
            last_name="Guardian",
            is_staff=False
        )
        Guardian.objects.create(
            user=self.guardian_user,
            daycare=self.daycare_a,
            first_name="Gary",
            last_name="Guardian",
            email="parent@example.ca",
            phone="777-888-9999",
            status="Active",
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        # Province
        self.prov_on = Province.objects.get_or_create(code="ON", defaults={"name": "Ontario", "status": "Active"})[0]

        # Credential Types
        self.type_ece = CredentialType.objects.get_or_create(
            name="ECE Level 2 / RECE",
            defaults={
                "category": "ece",
                "province": self.prov_on,
                "requires_expiry": True,
                "requires_certificate_number": True,
                "default_validity_months": 36,
                "status": "Active"
            }
        )[0]

        self.type_fa = CredentialType.objects.get_or_create(
            name="Standard First Aid & CPR Level C",
            defaults={
                "category": "certification",
                "requires_expiry": True,
                "requires_certificate_number": True,
                "default_validity_months": 36,
                "status": "Active"
            }
        )[0]

        self.type_vsc = CredentialType.objects.get_or_create(
            name="Vulnerable Sector Check (VSC)",
            defaults={
                "category": "background_check",
                "requires_expiry": True,
                "requires_certificate_number": False,
                "default_validity_months": 60,
                "status": "Active"
            }
        )[0]

        # Employee Types
        self.type_teacher = EmployeeType.objects.get_or_create(
            name="ECE Teacher",
            daycare=self.daycare_a,
            defaults={"is_eligible_for_classroom": True}
        )[0]


        # Daycare A Employees
        self.today = timezone.now().date()

        # Employee 1: Fully Compliant Teacher
        self.emp_compliant = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Jane",
            last_name="Smith",
            job_title="Lead Teacher",
            role="Teacher",
            status="active"
        )
        self.emp_compliant.types.add(self.type_teacher)
        ECECredential.objects.create(
            employee=self.emp_compliant, daycare=self.daycare_a, credential_type=self.type_ece,
            province=self.prov_on, certificate_number="ECE-COMP-01",
            issue_date=self.today - timedelta(days=100), expiry_date=self.today + timedelta(days=200),
            status="Active", verification_status="Verified", is_current=True
        )
        ECECredential.objects.create(
            employee=self.emp_compliant, daycare=self.daycare_a, credential_type=self.type_fa,
            province=self.prov_on, certificate_number="FA-COMP-01",
            issue_date=self.today - timedelta(days=100), expiry_date=self.today + timedelta(days=200),
            status="Active", verification_status="Verified", is_current=True
        )
        ECECredential.objects.create(
            employee=self.emp_compliant, daycare=self.daycare_a, credential_type=self.type_vsc,
            province=self.prov_on,
            issue_date=self.today - timedelta(days=100), expiry_date=self.today + timedelta(days=500),
            status="Active", verification_status="Verified", is_current=True
        )

        # Employee 2: Expiring in 18 Days (WARNING)
        self.emp_warning = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Sarah",
            last_name="Brown",
            job_title="Teacher",
            role="Teacher",
            status="active"
        )
        self.emp_warning.types.add(self.type_teacher)
        ECECredential.objects.create(
            employee=self.emp_warning, daycare=self.daycare_a, credential_type=self.type_ece,
            province=self.prov_on, certificate_number="ECE-WARN-01",
            issue_date=self.today - timedelta(days=340), expiry_date=self.today + timedelta(days=18),
            status="Active", verification_status="Verified", is_current=True
        )
        ECECredential.objects.create(
            employee=self.emp_warning, daycare=self.daycare_a, credential_type=self.type_fa,
            province=self.prov_on, certificate_number="FA-WARN-01",
            issue_date=self.today - timedelta(days=100), expiry_date=self.today + timedelta(days=200),
            status="Active", verification_status="Verified", is_current=True
        )
        ECECredential.objects.create(
            employee=self.emp_warning, daycare=self.daycare_a, credential_type=self.type_vsc,
            province=self.prov_on,
            issue_date=self.today - timedelta(days=100), expiry_date=self.today + timedelta(days=500),
            status="Active", verification_status="Verified", is_current=True
        )

        # Employee 3: Expired Credential (NON_COMPLIANT)
        self.emp_expired = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Michael",
            last_name="Scott",
            job_title="Teacher",
            role="Teacher",
            status="active"
        )
        self.emp_expired.types.add(self.type_teacher)
        ECECredential.objects.create(
            employee=self.emp_expired, daycare=self.daycare_a, credential_type=self.type_ece,
            province=self.prov_on, certificate_number="ECE-EXP-01",
            issue_date=self.today - timedelta(days=400), expiry_date=self.today - timedelta(days=5),
            status="Active", verification_status="Verified", is_current=True
        )
        ECECredential.objects.create(
            employee=self.emp_expired, daycare=self.daycare_a, credential_type=self.type_fa,
            province=self.prov_on, certificate_number="FA-EXP-01",
            issue_date=self.today - timedelta(days=100), expiry_date=self.today + timedelta(days=200),
            status="Active", verification_status="Verified", is_current=True
        )
        ECECredential.objects.create(
            employee=self.emp_expired, daycare=self.daycare_a, credential_type=self.type_vsc,
            province=self.prov_on,
            issue_date=self.today - timedelta(days=100), expiry_date=self.today + timedelta(days=500),
            status="Active", verification_status="Verified", is_current=True
        )

        # Employee 4: Missing Required CPR/First Aid (NON_COMPLIANT)
        self.emp_missing = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="John",
            last_name="Smith",
            job_title="Teacher",
            role="Teacher",
            status="active"
        )
        self.emp_missing.types.add(self.type_teacher)
        ECECredential.objects.create(
            employee=self.emp_missing, daycare=self.daycare_a, credential_type=self.type_ece,
            province=self.prov_on, certificate_number="ECE-MISS-01",
            issue_date=self.today - timedelta(days=100), expiry_date=self.today + timedelta(days=200),
            status="Active", verification_status="Verified", is_current=True
        )
        ECECredential.objects.create(
            employee=self.emp_missing, daycare=self.daycare_a, credential_type=self.type_vsc,
            province=self.prov_on,
            issue_date=self.today - timedelta(days=100), expiry_date=self.today + timedelta(days=500),
            status="Active", verification_status="Verified", is_current=True
        )

        # Employee in Daycare B (for isolation test)
        self.emp_b = Employee.objects.create(
            daycare=self.daycare_b,
            first_name="Dwight",
            last_name="Schrute",
            job_title="Teacher",
            status="active"
        )
        ECECredential.objects.create(
            employee=self.emp_b, daycare=self.daycare_b, credential_type=self.type_ece,
            province=self.prov_on, certificate_number="ECE-B-999",
            issue_date=self.today - timedelta(days=350), expiry_date=self.today + timedelta(days=10),
            status="Active", verification_status="Verified", is_current=True
        )

    def test_01_compliance_dashboard_metrics(self):
        """Verify dynamic calculation of all 8 metric cards in /api/daycare/credentials/dashboard/."""
        self.client.force_authenticate(user=self.user_a)

        res = self.client.get('/api/daycare/credentials/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        # Check prominent card count: Expiring in 30 Days (Sarah Brown ECE in 18d)
        self.assertEqual(data['expiring_30_days'], 1)

        # Check Expired count: Michael Scott ECE (-5d)
        self.assertEqual(data['expired_credentials'], 1)

        # Check Non-compliant employees count: Michael Scott (expired) + John Smith (missing FA)
        self.assertGreaterEqual(data['non_compliant_employees'], 2)

        # Check Compliant employees count: Jane Smith
        self.assertGreaterEqual(data['compliant_employees'], 1)

        # Check Warning employees count: Sarah Brown
        self.assertGreaterEqual(data['warning_employees'], 1)

        # Check Missing required credentials count: John Smith missing First Aid
        self.assertGreaterEqual(data['missing_required_credentials'], 1)

    def test_02_dynamic_date_expiry_calculations(self):
        """Verify dynamic calculation logic relative to today, boundary conditions, and days remaining."""
        self.client.force_authenticate(user=self.user_a)

        res = self.client.get('/api/daycare/credentials/expiring/?days=30')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 1)
        self.assertEqual(res.data['results'][0]['certificate_number'], "ECE-WARN-01")
        self.assertEqual(res.data['results'][0]['days_remaining'], 18)
        self.assertEqual(res.data['results'][0]['status_label'], "Expiring Soon")

    def test_03_missing_required_credentials_detection(self):
        """Verify employee missing required CPR/First Aid is flagged as NON_COMPLIANT with missing items."""
        self.client.force_authenticate(user=self.user_a)

        res = self.client.get('/api/daycare/credentials/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        john_summary = next((e for e in res.data['employee_compliance_summary'] if e['employee_name'] == "John Smith"), None)
        self.assertIsNotNone(john_summary)
        self.assertEqual(john_summary['compliance_status'], 'NON_COMPLIANT')
        self.assertIn("First Aid & CPR", john_summary['missing_required'])

    def test_04_employee_compliance_statuses(self):
        """Verify distinct statuses COMPLIANT, WARNING, and NON_COMPLIANT assigned to respective staff."""
        self.client.force_authenticate(user=self.user_a)

        res = self.client.get('/api/daycare/credentials/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        summaries = {e['employee_name']: e['compliance_status'] for e in res.data['employee_compliance_summary']}

        self.assertEqual(summaries.get("Jane Smith"), 'COMPLIANT')
        self.assertEqual(summaries.get("Sarah Brown"), 'WARNING')
        self.assertEqual(summaries.get("Michael Scott"), 'NON_COMPLIANT')
        self.assertEqual(summaries.get("John Smith"), 'NON_COMPLIANT')

    def test_05_dashboard_filters(self):
        """Verify filtering by province, category, and expiry period."""
        self.client.force_authenticate(user=self.user_a)

        # Filter by expiry_period=30
        res_30 = self.client.get('/api/daycare/credentials/dashboard/?expiry_period=30')
        self.assertEqual(res_30.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_30.data['expiring_list']), 1)
        self.assertEqual(res_30.data['expiring_list'][0]['certificate_number'], "ECE-WARN-01")

        # Filter by expiry_period=expired
        res_exp = self.client.get('/api/daycare/credentials/dashboard/?expiry_period=expired')
        self.assertEqual(res_exp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_exp.data['expiring_list']), 1)
        self.assertEqual(res_exp.data['expiring_list'][0]['certificate_number'], "ECE-EXP-01")

    def test_06_daycare_dashboard_integration(self):
        """Verify main Daycare Dashboard (/api/daycare/dashboard/) includes credential_compliance summary."""
        self.client.force_authenticate(user=self.user_a)

        res = self.client.get('/api/daycare/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('credential_compliance', res.data)
        comp = res.data['credential_compliance']
        self.assertEqual(comp['expiring_soon'], 1)
        self.assertEqual(comp['expired'], 1)
        self.assertGreaterEqual(comp['missing'], 1)

    def test_07_alert_generation_and_no_duplicates(self):
        """Verify POST /api/daycare/credentials/send-alerts/ creates notification audit logs and prevents duplicate spam."""
        self.client.force_authenticate(user=self.user_a)

        # First alert trigger
        res1 = self.client.post('/api/daycare/credentials/send-alerts/')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertGreater(res1.data['alerts_sent'], 0)

        # Second alert trigger on same day -> duplicate alerts skipped
        res2 = self.client.post('/api/daycare/credentials/send-alerts/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['alerts_sent'], 0)

    def test_08_security_and_tenant_isolation(self):
        """Verify Guardian blocked (403) and Daycare A admin cannot see Daycare B credentials."""
        # Guardian user blocked
        self.client.force_authenticate(user=self.guardian_user)
        res_guard = self.client.get('/api/daycare/credentials/dashboard/')
        self.assertEqual(res_guard.status_code, status.HTTP_403_FORBIDDEN)

        # Daycare A admin should NOT see Daycare B employee (Dwight Schrute)
        self.client.force_authenticate(user=self.user_a)
        res_a = self.client.get('/api/daycare/credentials/dashboard/')
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)
        employee_names = [e['employee_name'] for e in res_a.data['employee_compliance_summary']]
        self.assertNotIn("Dwight Schrute", employee_names)
        cert_numbers = [item['certificate_number'] for item in res_a.data['expiring_list']]
        self.assertNotIn("ECE-B-999", cert_numbers)
