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


class ECECredentialPhase1Tests(APITestCase):
    def setUp(self):
        # Daycare A
        self.daycare_a = Daycare.objects.create(
            name="Sunrise Learning Centre",
            status="Active",
            phone="111-222-3333"
        )
        self.user_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@sunrise.ca",
            password="password123",
            first_name="Alice",
            last_name="Admin",
            is_staff=True,
            daycare=self.daycare_a
        )

        # Daycare B
        self.daycare_b = Daycare.objects.create(
            name="Northern Lights Daycare",
            status="Active",
            phone="444-555-6666"
        )
        self.user_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@northern.ca",
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
            last_name="Guardian"
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
        self.province_on = Province.objects.get_or_create(
            code="ON",
            defaults={"name": "Ontario", "status": "Active"}
        )[0]
        self.province_bc = Province.objects.get_or_create(
            code="BC",
            defaults={"name": "British Columbia", "status": "Active"}
        )[0]

        # Reference data: Credential Types
        self.cred_type_cert = CredentialType.objects.get_or_create(
            name="ECE Certificate",
            defaults={
                "description": "Provincial ECE Certificate",
                "requires_expiry": True,
                "requires_certificate_number": True,
                "status": "Active"
            }
        )[0]
        self.cred_type_diploma = CredentialType.objects.get_or_create(
            name="ECE Diploma",
            defaults={
                "description": "Two-year ECE Diploma",
                "requires_expiry": False,
                "requires_certificate_number": True,
                "status": "Active"
            }
        )[0]

        # Employees
        self.emp_a = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Jane",
            last_name="Smith",
            role="ECE",
            status="active"
        )
        self.emp_b = Employee.objects.create(
            daycare=self.daycare_b,
            first_name="David",
            last_name="Miller",
            role="Teacher",
            status="active"
        )

    def test_01_list_provinces_and_credential_types(self):
        """Verify Canadian provinces and credential types are accessible to daycare admin."""
        self.client.force_authenticate(user=self.user_a)

        # Provinces
        res_prov = self.client.get('/api/daycare/provinces/')
        self.assertEqual(res_prov.status_code, status.HTTP_200_OK)
        provinces = res_prov.data
        self.assertTrue(len(provinces) >= 2)
        codes = [p['code'] for p in provinces]
        self.assertIn("ON", codes)
        self.assertIn("BC", codes)

        # Credential Types
        res_types = self.client.get('/api/daycare/credential-types/')
        self.assertEqual(res_types.status_code, status.HTTP_200_OK)
        types = res_types.data
        self.assertTrue(len(types) >= 2)
        names = [t['name'] for t in types]
        self.assertIn("ECE Certificate", names)

    def test_02_create_ece_credential_success(self):
        """Create a valid ECE credential for employee Jane Smith."""
        self.client.force_authenticate(user=self.user_a)

        payload = {
            "credential_type": str(self.cred_type_cert.id),
            "province": str(self.province_on.id),
            "certificate_number": "ECE-123456",
            "issue_date": "2025-09-01",
            "expiry_date": "2028-09-01",
            "renewal_date": "2028-08-01",
            "status": "Active",
            "verification_status": "Verified",
            "notes": "College of Early Childhood Educators Ontario Registration verified."
        }

        url = f'/api/daycare/employees/{self.emp_a.id}/ece-credentials/'
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['certificate_number'], "ECE-123456")
        self.assertEqual(response.data['status'], "Active")
        self.assertEqual(response.data['verification_status'], "Verified")

        # Verify in DB
        cred = ECECredential.objects.get(id=response.data['id'])
        self.assertEqual(cred.employee, self.emp_a)
        self.assertEqual(cred.daycare, self.daycare_a)
        self.assertEqual(cred.province, self.province_on)
        self.assertEqual(cred.credential_type, self.cred_type_cert)

        # Verify Audit Log
        audit = AuditLog.objects.filter(entity_id=str(cred.id), action='ECE_CREDENTIAL_CREATED').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.module, 'employees')

    def test_03_get_employee_ece_credentials_list(self):
        """Retrieve all credentials for an employee."""
        self.client.force_authenticate(user=self.user_a)

        ECECredential.objects.create(
            employee=self.emp_a,
            daycare=self.daycare_a,
            credential_type=self.cred_type_cert,
            province=self.province_on,
            certificate_number="ECE-ON-9988",
            issue_date=date(2024, 1, 15),
            expiry_date=date(2027, 1, 15),
            status="Active"
        )

        url = f'/api/daycare/employees/{self.emp_a.id}/ece-credentials/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['certificate_number'], "ECE-ON-9988")
        self.assertEqual(response.data[0]['province_detail']['code'], "ON")

    def test_04_update_ece_credential_and_audit(self):
        """Update an existing credential and verify audit log."""
        self.client.force_authenticate(user=self.user_a)

        cred = ECECredential.objects.create(
            employee=self.emp_a,
            daycare=self.daycare_a,
            credential_type=self.cred_type_cert,
            province=self.province_on,
            certificate_number="ECE-UPDATE-1",
            issue_date=date(2023, 5, 1),
            expiry_date=date(2026, 5, 1),
            status="Active",
            verification_status="Unverified"
        )

        url = f'/api/daycare/ece-credentials/{cred.id}/'
        response = self.client.patch(url, {
            "verification_status": "Verified",
            "notes": "Verified by Director"
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['verification_status'], "Verified")

        cred.refresh_from_db()
        self.assertEqual(cred.verification_status, "Verified")
        self.assertEqual(cred.notes, "Verified by Director")

        # Verify audit log
        audit = AuditLog.objects.filter(entity_id=str(cred.id), action='ECE_CREDENTIAL_UPDATED').first()
        self.assertIsNotNone(audit)

    def test_05_delete_ece_credential(self):
        """Delete credential and ensure audit record is saved."""
        self.client.force_authenticate(user=self.user_a)

        cred = ECECredential.objects.create(
            employee=self.emp_a,
            daycare=self.daycare_a,
            credential_type=self.cred_type_diploma,
            province=self.province_bc,
            certificate_number="DIP-BC-5544",
            issue_date=date(2022, 6, 1),
            status="Active"
        )

        url = f'/api/daycare/ece-credentials/{cred.id}/'
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ECECredential.objects.filter(id=cred.id).exists())

        audit = AuditLog.objects.filter(entity_id=str(cred.id), action='ECE_CREDENTIAL_DELETED').first()
        self.assertIsNotNone(audit)

    def test_06_validation_expiry_before_issue_date(self):
        """Validation error if expiry date is before issue date."""
        self.client.force_authenticate(user=self.user_a)

        payload = {
            "credential_type": str(self.cred_type_cert.id),
            "province": str(self.province_on.id),
            "certificate_number": "ECE-INVALID-DATES",
            "issue_date": "2025-05-01",
            "expiry_date": "2024-05-01"  # Before issue date!
        }

        url = f'/api/daycare/employees/{self.emp_a.id}/ece-credentials/'
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expiry_date", response.data)

    def test_07_validation_renewal_after_expiry_date(self):
        """Validation error if renewal date is after expiry date."""
        self.client.force_authenticate(user=self.user_a)

        payload = {
            "credential_type": str(self.cred_type_cert.id),
            "province": str(self.province_on.id),
            "certificate_number": "ECE-INVALID-RENEW",
            "issue_date": "2025-01-01",
            "expiry_date": "2028-01-01",
            "renewal_date": "2028-06-01"  # After expiry!
        }

        url = f'/api/daycare/employees/{self.emp_a.id}/ece-credentials/'
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("renewal_date", response.data)

    def test_08_validation_duplicate_certificate_number_in_same_province(self):
        """Validation error when duplicate certificate number is added in the same province & type."""
        self.client.force_authenticate(user=self.user_a)

        # Existing credential
        ECECredential.objects.create(
            employee=self.emp_a,
            daycare=self.daycare_a,
            credential_type=self.cred_type_cert,
            province=self.province_on,
            certificate_number="ECE-DUP-TEST",
            issue_date=date(2025, 1, 1),
            expiry_date=date(2028, 1, 1)
        )

        # Attempt to create another credential with same cert number & province & type
        payload = {
            "credential_type": str(self.cred_type_cert.id),
            "province": str(self.province_on.id),
            "certificate_number": "ECE-DUP-TEST",
            "issue_date": "2025-02-01",
            "expiry_date": "2028-02-01"
        }

        url = f'/api/daycare/employees/{self.emp_a.id}/ece-credentials/'
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("certificate_number", response.data)

    def test_09_cross_daycare_isolation(self):
        """Daycare A admin cannot access or create credentials for Daycare B employee."""
        self.client.force_authenticate(user=self.user_a)

        # Try to create credential for Daycare B's employee
        payload = {
            "credential_type": str(self.cred_type_cert.id),
            "province": str(self.province_on.id),
            "certificate_number": "ECE-CROSS-TENANT",
            "issue_date": "2025-01-01",
            "expiry_date": "2028-01-01"
        }
        url = f'/api/daycare/employees/{self.emp_b.id}/ece-credentials/'
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Daycare B credential
        cred_b = ECECredential.objects.create(
            employee=self.emp_b,
            daycare=self.daycare_b,
            credential_type=self.cred_type_cert,
            province=self.province_on,
            certificate_number="ECE-B-SECRET",
            issue_date=date(2025, 1, 1),
            expiry_date=date(2028, 1, 1)
        )

        # Daycare A admin tries to retrieve Daycare B credential
        detail_url = f'/api/daycare/ece-credentials/{cred_b.id}/'
        res_get = self.client.get(detail_url)
        self.assertEqual(res_get.status_code, status.HTTP_404_NOT_FOUND)

        # Daycare A admin tries to modify Daycare B credential
        res_patch = self.client.patch(detail_url, {"notes": "Hacked"})
        self.assertEqual(res_patch.status_code, status.HTTP_404_NOT_FOUND)

        # Daycare A admin tries to delete Daycare B credential
        res_delete = self.client.delete(detail_url)
        self.assertEqual(res_delete.status_code, status.HTTP_404_NOT_FOUND)

    def test_10_unauthorized_guardian_access_blocked(self):
        """Guardian cannot access staff ECE credentials."""
        self.client.force_authenticate(user=self.guardian_user)

        cred = ECECredential.objects.create(
            employee=self.emp_a,
            daycare=self.daycare_a,
            credential_type=self.cred_type_cert,
            province=self.province_on,
            certificate_number="ECE-GUARDIAN-TEST",
            issue_date=date(2025, 1, 1),
            expiry_date=date(2028, 1, 1)
        )

        url_list = f'/api/daycare/employees/{self.emp_a.id}/ece-credentials/'
        res_list = self.client.get(url_list)
        self.assertEqual(res_list.status_code, status.HTTP_403_FORBIDDEN)

        url_detail = f'/api/daycare/ece-credentials/{cred.id}/'
        res_detail = self.client.get(url_detail)
        self.assertEqual(res_detail.status_code, status.HTTP_403_FORBIDDEN)
