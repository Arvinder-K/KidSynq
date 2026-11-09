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


class StaffCredentialsPhase2Tests(APITestCase):
    def setUp(self):
        # Daycare A
        self.daycare_a = Daycare.objects.create(
            name="Maple Leaf Childcare",
            status="Active",
            phone="111-222-3333"
        )
        self.user_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@mapleleaf.ca",
            password="password123",
            first_name="Alice",
            last_name="Admin",
            is_staff=True,
            daycare=self.daycare_a
        )

        # Daycare B
        self.daycare_b = Daycare.objects.create(
            name="Pacific Horizon Daycare",
            status="Active",
            phone="444-555-6666"
        )
        self.user_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@pacific.ca",
            password="password123",
            first_name="Bob",
            last_name="Admin",
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

        # Reference data: Provinces
        self.prov_on = Province.objects.get_or_create(code="ON", defaults={"name": "Ontario", "status": "Active"})[0]
        self.prov_bc = Province.objects.get_or_create(code="BC", defaults={"name": "British Columbia", "status": "Active"})[0]

        # Credential Types
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

        self.type_cpr = CredentialType.objects.get_or_create(
            name="CPR / AED Level C (Annual Renewal)",
            defaults={
                "category": "certification",
                "requires_expiry": True,
                "requires_certificate_number": True,
                "default_validity_months": 12,
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

        self.type_crjmc = CredentialType.objects.get_or_create(
            name="Criminal Record and Judicial Matters Check (CRJMC)",
            defaults={
                "category": "background_check",
                "requires_expiry": True,
                "requires_certificate_number": False,
                "default_validity_months": 60,
                "status": "Active"
            }
        )[0]

        self.type_food = CredentialType.objects.get_or_create(
            name="Food Handler / Food Safety Certification",
            defaults={
                "category": "certification",
                "requires_expiry": True,
                "requires_certificate_number": True,
                "default_validity_months": 60,
                "status": "Active"
            }
        )[0]

        self.type_whmis = CredentialType.objects.get_or_create(
            name="WHMIS Workplace Hazardous Materials",
            defaults={
                "category": "training",
                "requires_expiry": True,
                "requires_certificate_number": False,
                "default_validity_months": 12,
                "status": "Active"
            }
        )[0]

        self.type_child_protection = CredentialType.objects.get_or_create(
            name="Child Protection & Duty to Report Training",
            defaults={
                "category": "training",
                "requires_expiry": True,
                "requires_certificate_number": False,
                "default_validity_months": 12,
                "status": "Active"
            }
        )[0]

        # Employees
        self.emp_type_ece = EmployeeType.objects.create(
            name="ECE Educator",
            daycare=self.daycare_a,
            is_eligible_for_classroom=True
        )

        self.employee_a = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Sarah",
            last_name="Connor",
            email="sarah@mapleleaf.ca",
            status="active"
        )
        self.employee_a.types.add(self.emp_type_ece)

        self.employee_b = Employee.objects.create(
            daycare=self.daycare_b,
            first_name="Kyle",
            last_name="Reese",
            email="kyle@pacific.ca",
            status="active"
        )

    def test_01_credential_types_category_filtering(self):
        """Verify GET /api/daycare/credential-types/?category=... filters properly."""
        self.client.force_authenticate(user=self.user_a)

        # Filter certifications
        res_cert = self.client.get('/api/daycare/credential-types/', {'category': 'certification'})
        self.assertEqual(res_cert.status_code, status.HTTP_200_OK)
        cert_names = [c['name'] for c in res_cert.data]
        self.assertIn("Standard First Aid & CPR Level C", cert_names)
        self.assertIn("Food Handler / Food Safety Certification", cert_names)
        self.assertNotIn("Vulnerable Sector Check (VSC)", cert_names)

        # Filter background checks
        res_bg = self.client.get('/api/daycare/credential-types/', {'category': 'background_check'})
        self.assertEqual(res_bg.status_code, status.HTTP_200_OK)
        bg_names = [c['name'] for c in res_bg.data]
        self.assertIn("Vulnerable Sector Check (VSC)", bg_names)
        self.assertIn("Criminal Record and Judicial Matters Check (CRJMC)", bg_names)
        self.assertNotIn("Standard First Aid & CPR Level C", bg_names)

        # Filter training
        res_train = self.client.get('/api/daycare/credential-types/', {'category': 'training'})
        self.assertEqual(res_train.status_code, status.HTTP_200_OK)
        train_names = [c['name'] for c in res_train.data]
        self.assertIn("WHMIS Workplace Hazardous Materials", train_names)
        self.assertIn("Child Protection & Duty to Report Training", train_names)

    def test_02_create_first_aid_and_cpr_certifications(self):
        """Create First Aid and CPR certifications for an employee."""
        self.client.force_authenticate(user=self.user_a)

        payload_fa = {
            "credential_type": str(self.type_fa.id),
            "province": str(self.prov_on.id),
            "certificate_number": "FA-2026-9988",
            "issuing_organization": "Canadian Red Cross",
            "issue_date": "2026-01-15",
            "expiry_date": "2029-01-15",
            "renewal_date": "2028-12-15",
            "status": "Active",
            "verification_status": "Verified",
            "document_reference": "https://storage.kidsynq.ca/docs/fa_connor.pdf",
            "notes": "Standard First Aid with CPR-C verified."
        }
        res_fa = self.client.post(f'/api/daycare/employees/{self.employee_a.id}/credentials/', payload_fa, format='json')
        self.assertEqual(res_fa.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_fa.data['issuing_organization'], "Canadian Red Cross")
        self.assertEqual(res_fa.data['certificate_number'], "FA-2026-9988")
        self.assertEqual(res_fa.data['category'], "certification")

        # Create CPR
        payload_cpr = {
            "credential_type": str(self.type_cpr.id),
            "province": str(self.prov_on.id),
            "certificate_number": "CPR-2026-1122",
            "issuing_organization": "St. John Ambulance",
            "issue_date": "2026-02-01",
            "expiry_date": "2027-02-01",
            "status": "Active",
            "verification_status": "Verified"
        }
        res_cpr = self.client.post(f'/api/daycare/employees/{self.employee_a.id}/credentials/', payload_cpr, format='json')
        self.assertEqual(res_cpr.status_code, status.HTTP_201_CREATED)

    def test_03_create_criminal_and_vulnerable_sector_checks(self):
        """Create Background Checks (CRC & VSC) with request date, completed date, and review status."""
        self.client.force_authenticate(user=self.user_a)

        payload_vsc = {
            "credential_type": str(self.type_vsc.id),
            "province": str(self.prov_on.id),
            "certificate_number": "VSC-TOR-445566",
            "issuing_organization": "Toronto Police Service",
            "request_date": "2026-01-10",
            "completed_date": "2026-01-28",
            "expiry_date": "2031-01-28",
            "status": "Active",
            "verification_status": "Verified",
            "document_reference": "https://storage.kidsynq.ca/vsc/sarah_vsc.pdf",
            "notes": "Clear Vulnerable Sector Check on file."
        }
        res_vsc = self.client.post(f'/api/daycare/employees/{self.employee_a.id}/credentials/', payload_vsc, format='json')
        self.assertEqual(res_vsc.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_vsc.data['category'], "background_check")
        self.assertEqual(res_vsc.data['request_date'], "2026-01-10")
        self.assertEqual(res_vsc.data['completed_date'], "2026-01-28")

        # Criminal Check requiring review
        payload_crc = {
            "credential_type": str(self.type_crjmc.id),
            "province": str(self.prov_on.id),
            "issuing_organization": "OPP",
            "request_date": "2026-02-01",
            "completed_date": "2026-02-14",
            "expiry_date": "2031-02-14",
            "status": "Requires Review",
            "verification_status": "Pending Verification"
        }
        res_crc = self.client.post(f'/api/daycare/employees/{self.employee_a.id}/credentials/', payload_crc, format='json')
        self.assertEqual(res_crc.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_crc.data['status'], "Requires Review")

    def test_04_create_food_safety_certification(self):
        """Create Food Handler certification."""
        self.client.force_authenticate(user=self.user_a)

        payload_food = {
            "credential_type": str(self.type_food.id),
            "province": str(self.prov_on.id),
            "certificate_number": "FH-99001",
            "issuing_organization": "Toronto Public Health",
            "issue_date": "2025-06-01",
            "expiry_date": "2030-06-01",
            "status": "Active",
            "verification_status": "Verified"
        }
        res = self.client.post(f'/api/daycare/employees/{self.employee_a.id}/credentials/', payload_food, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['certificate_number'], "FH-99001")

    def test_05_create_other_required_training(self):
        """Create WHMIS and Child Protection Training."""
        self.client.force_authenticate(user=self.user_a)

        # WHMIS (without province required)
        payload_whmis = {
            "credential_type": str(self.type_whmis.id),
            "issuing_organization": "CCOHS Canada",
            "issue_date": "2026-01-05",
            "expiry_date": "2027-01-05",
            "status": "Active",
            "verification_status": "Verified",
            "notes": "Annual WHMIS refresher complete."
        }
        res_whmis = self.client.post(f'/api/daycare/employees/{self.employee_a.id}/credentials/', payload_whmis, format='json')
        self.assertEqual(res_whmis.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(res_whmis.data['province'])
        self.assertEqual(res_whmis.data['category'], "training")

        # Child Protection
        payload_cp = {
            "credential_type": str(self.type_child_protection.id),
            "issuing_organization": "Children's Aid Society",
            "issue_date": "2026-02-10",
            "expiry_date": "2027-02-10",
            "status": "Active",
            "verification_status": "Verified"
        }
        res_cp = self.client.post(f'/api/daycare/employees/{self.employee_a.id}/credentials/', payload_cp, format='json')
        self.assertEqual(res_cp.status_code, status.HTTP_201_CREATED)

    def test_06_filter_credentials_by_category_and_status(self):
        """Filter employee credentials via GET /api/daycare/employees/{id}/credentials/?category=..."""
        self.client.force_authenticate(user=self.user_a)

        # Add 1 certification and 1 training
        ECECredential.objects.create(
            employee=self.employee_a,
            daycare=self.daycare_a,
            credential_type=self.type_fa,
            province=self.prov_on,
            certificate_number="FA-111",
            issue_date=date(2026, 1, 1),
            expiry_date=date(2029, 1, 1),
            status="Active"
        )
        ECECredential.objects.create(
            employee=self.employee_a,
            daycare=self.daycare_a,
            credential_type=self.type_whmis,
            issue_date=date(2026, 1, 1),
            expiry_date=date(2027, 1, 1),
            status="Active"
        )

        # Get all
        res_all = self.client.get(f'/api/daycare/employees/{self.employee_a.id}/credentials/')
        self.assertEqual(res_all.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_all.data), 2)

        # Filter certifications only
        res_cert = self.client.get(f'/api/daycare/employees/{self.employee_a.id}/credentials/', {'category': 'certification'})
        self.assertEqual(res_cert.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_cert.data), 1)
        self.assertEqual(res_cert.data[0]['certificate_number'], "FA-111")

        # Filter training only
        res_train = self.client.get(f'/api/daycare/employees/{self.employee_a.id}/credentials/', {'category': 'training'})
        self.assertEqual(res_train.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_train.data), 1)
        self.assertEqual(res_train.data[0]['credential_type_detail']['name'], "WHMIS Workplace Hazardous Materials")

    def test_07_invalid_dates_validation(self):
        """Ensure date validations trigger 400 Bad Request."""
        self.client.force_authenticate(user=self.user_a)

        # Expiry before issue
        res1 = self.client.post(f'/api/daycare/employees/{self.employee_a.id}/credentials/', {
            "credential_type": str(self.type_fa.id),
            "province": str(self.prov_on.id),
            "certificate_number": "FA-BAD-1",
            "issue_date": "2026-05-01",
            "expiry_date": "2026-04-01"
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expiry_date", res1.data)

        # Renewal after expiry
        res2 = self.client.post(f'/api/daycare/employees/{self.employee_a.id}/credentials/', {
            "credential_type": str(self.type_fa.id),
            "province": str(self.prov_on.id),
            "certificate_number": "FA-BAD-2",
            "issue_date": "2026-01-01",
            "expiry_date": "2029-01-01",
            "renewal_date": "2029-06-01"
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("renewal_date", res2.data)

        # Completed before request date
        res3 = self.client.post(f'/api/daycare/employees/{self.employee_a.id}/credentials/', {
            "credential_type": str(self.type_vsc.id),
            "province": str(self.prov_on.id),
            "request_date": "2026-02-15",
            "completed_date": "2026-02-01"
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("completed_date", res3.data)

    def test_08_cross_daycare_tenant_isolation(self):
        """Ensure Daycare A cannot access or create credentials for Daycare B employees."""
        self.client.force_authenticate(user=self.user_a)

        # Try to create credential for Daycare B employee
        res = self.client.post(f'/api/daycare/employees/{self.employee_b.id}/credentials/', {
            "credential_type": str(self.type_fa.id),
            "province": str(self.prov_on.id),
            "certificate_number": "FA-CROSS-1",
            "issue_date": "2026-01-01",
            "expiry_date": "2029-01-01"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Create credential under Daycare B
        cred_b = ECECredential.objects.create(
            employee=self.employee_b,
            daycare=self.daycare_b,
            credential_type=self.type_fa,
            province=self.prov_on,
            certificate_number="FA-B-100",
            issue_date=date(2026, 1, 1),
            expiry_date=date(2029, 1, 1),
            status="Active"
        )

        # Daycare A admin tries to retrieve Daycare B credential
        res_get = self.client.get(f'/api/daycare/credentials/{cred_b.id}/')
        self.assertEqual(res_get.status_code, status.HTTP_404_NOT_FOUND)

    def test_09_audit_logging_and_mutations(self):
        """Verify update, delete, and audit log generation."""
        self.client.force_authenticate(user=self.user_a)

        cred = ECECredential.objects.create(
            employee=self.employee_a,
            daycare=self.daycare_a,
            credential_type=self.type_food,
            province=self.prov_on,
            certificate_number="FH-AUDIT-1",
            issue_date=date(2026, 1, 1),
            expiry_date=date(2031, 1, 1),
            status="Active"
        )

        # Update
        res_patch = self.client.patch(f'/api/daycare/credentials/{cred.id}/', {
            "status": "Pending Renewal",
            "verification_status": "Verified"
        }, format='json')
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data['status'], "Pending Renewal")

        # Verify audit log created
        log_update = AuditLog.objects.filter(entity_type='credential', action='CREDENTIAL_UPDATED', entity_id=str(cred.id))
        self.assertTrue(log_update.exists())

        # Delete
        res_del = self.client.delete(f'/api/daycare/credentials/{cred.id}/')
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)

        # Verify delete audit log
        log_del = AuditLog.objects.filter(entity_type='credential', action='CREDENTIAL_DELETED', entity_id=str(cred.id))
        self.assertTrue(log_del.exists())
