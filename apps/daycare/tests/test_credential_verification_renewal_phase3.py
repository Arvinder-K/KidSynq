import uuid
from datetime import date, timedelta
from io import BytesIO
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from core.models import (
    Daycare, Employee, EmployeeType, Province, CredentialType,
    ECECredential, AuditLog, Guardian
)

User = get_user_model()


class CredentialVerificationRenewalPhase3Tests(APITestCase):
    def setUp(self):
        # Daycare A
        self.daycare_a = Daycare.objects.create(
            name="Pinecrest Early Learning",
            status="Active",
            phone="111-222-3333"
        )
        self.user_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@pinecrest.ca",
            password="password123",
            first_name="Alice",
            last_name="Director",
            is_staff=True,
            daycare=self.daycare_a
        )

        # Daycare B
        self.daycare_b = Daycare.objects.create(
            name="Rocky Mountain Childcare",
            status="Active",
            phone="444-555-6666"
        )
        self.user_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@rocky.ca",
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

        # Reference data: Provinces
        self.prov_on = Province.objects.get_or_create(code="ON", defaults={"name": "Ontario", "status": "Active"})[0]

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

        # Employees
        self.employee_a = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Emily",
            last_name="Blunt",
            email="emily@pinecrest.ca",
            status="active"
        )

        self.employee_b = Employee.objects.create(
            daycare=self.daycare_b,
            first_name="John",
            last_name="Krasinski",
            email="john@rocky.ca",
            status="active"
        )

    def test_01_document_upload_and_secure_download(self):
        """Upload credential file and verify secure streaming download."""
        self.client.force_authenticate(user=self.user_a)

        cred = ECECredential.objects.create(
            employee=self.employee_a,
            daycare=self.daycare_a,
            credential_type=self.type_fa,
            province=self.prov_on,
            certificate_number="FA-DOC-01",
            issue_date=date(2026, 1, 1),
            expiry_date=date(2029, 1, 1),
            status="Active"
        )

        # Upload document
        fake_file = SimpleUploadedFile("first_aid_cert.pdf", b"%PDF-1.4 test certificate content", content_type="application/pdf")
        res_up = self.client.post(f'/api/daycare/credentials/{cred.id}/upload-document/', {'document': fake_file}, format='multipart')
        self.assertEqual(res_up.status_code, status.HTTP_200_OK)
        self.assertEqual(res_up.data['document_status'], 'pending_review')

        cred.refresh_from_db()
        self.assertTrue(bool(cred.document))

        # Secure download
        res_down = self.client.get(f'/api/daycare/credentials/{cred.id}/document/')
        self.assertEqual(res_down.status_code, status.HTTP_200_OK)

        # Verify audit log
        audit = AuditLog.objects.filter(entity_id=str(cred.id), action='CREDENTIAL_DOCUMENT_UPLOADED').first()
        self.assertIsNotNone(audit)

    def test_02_credential_verification_success(self):
        """Admin verifies a credential successfully."""
        self.client.force_authenticate(user=self.user_a)

        cred = ECECredential.objects.create(
            employee=self.employee_a,
            daycare=self.daycare_a,
            credential_type=self.type_fa,
            province=self.prov_on,
            certificate_number="FA-VERIFY-01",
            issue_date=date(2026, 1, 1),
            expiry_date=date(2029, 1, 1),
            status="Pending Review",
            verification_status="Pending Verification"
        )

        res = self.client.post(f'/api/daycare/credentials/{cred.id}/verify/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['verification_status'], 'Verified')
        self.assertEqual(res.data['status'], 'Active')
        self.assertEqual(res.data['verified_by_name'], 'Alice Director')

        cred.refresh_from_db()
        self.assertEqual(cred.verification_status, 'Verified')
        self.assertEqual(cred.verified_by, self.user_a)
        self.assertIsNotNone(cred.verified_at)

        # Verify Audit Log
        audit = AuditLog.objects.filter(entity_id=str(cred.id), action='CREDENTIAL_VERIFIED').first()
        self.assertIsNotNone(audit)

    def test_03_credential_rejection(self):
        """Admin rejects credential with a required rejection reason."""
        self.client.force_authenticate(user=self.user_a)

        cred = ECECredential.objects.create(
            employee=self.employee_a,
            daycare=self.daycare_a,
            credential_type=self.type_vsc,
            province=self.prov_on,
            issue_date=date(2026, 1, 1),
            expiry_date=date(2031, 1, 1),
            status="Active",
            verification_status="Pending Verification"
        )

        # Attempt rejection without reason
        res_bad = self.client.post(f'/api/daycare/credentials/{cred.id}/reject/', {}, format='json')
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

        # Proper rejection
        res = self.client.post(f'/api/daycare/credentials/{cred.id}/reject/', {
            "rejection_reason": "Police check is over 6 months old at time of submission."
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['verification_status'], 'Rejected')
        self.assertEqual(res.data['rejection_reason'], "Police check is over 6 months old at time of submission.")

        cred.refresh_from_db()
        self.assertEqual(cred.verification_status, 'Rejected')
        self.assertEqual(cred.rejection_reason, "Police check is over 6 months old at time of submission.")

        # Verify Audit Log
        audit = AuditLog.objects.filter(entity_id=str(cred.id), action='CREDENTIAL_REJECTED').first()
        self.assertIsNotNone(audit)

    def test_04_credential_renewal_and_history(self):
        """Renew credential, verify previous version preserved as Superseded, and retrieve full history chain."""
        self.client.force_authenticate(user=self.user_a)

        # Initial Version 1
        cred_v1 = ECECredential.objects.create(
            employee=self.employee_a,
            daycare=self.daycare_a,
            credential_type=self.type_fa,
            province=self.prov_on,
            certificate_number="FA-V1-1234",
            issuing_organization="Canadian Red Cross",
            issue_date=date(2023, 1, 1),
            expiry_date=date(2026, 1, 1),
            status="Active",
            verification_status="Verified",
            is_current=True
        )

        # Renew -> creates Version 2
        payload_renew = {
            "issue_date": "2026-01-02",
            "expiry_date": "2029-01-02",
            "renewal_date": "2028-12-01",
            "certificate_number": "FA-V2-5678",
            "issuing_organization": "Canadian Red Cross",
            "notes": "Renewed recertification completed."
        }
        res_renew = self.client.post(f'/api/daycare/credentials/{cred_v1.id}/renew/', payload_renew, format='json')
        self.assertEqual(res_renew.status_code, status.HTTP_201_CREATED)
        v2_id = res_renew.data['id']

        # Check old record
        cred_v1.refresh_from_db()
        self.assertEqual(cred_v1.status, 'Superseded')
        self.assertFalse(cred_v1.is_current)

        # Check new record
        cred_v2 = ECECredential.objects.get(id=v2_id)
        self.assertTrue(cred_v2.is_current)
        self.assertEqual(cred_v2.previous_credential, cred_v1)
        self.assertEqual(cred_v2.certificate_number, "FA-V2-5678")

        # History chain
        res_history = self.client.get(f'/api/daycare/credentials/{cred_v2.id}/history/')
        self.assertEqual(res_history.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_history.data), 2)
        self.assertEqual(res_history.data[0]['id'], str(cred_v1.id))
        self.assertEqual(res_history.data[1]['id'], str(cred_v2.id))

        # Check audit log
        audit = AuditLog.objects.filter(entity_id=str(cred_v2.id), action='CREDENTIAL_RENEWED').first()
        self.assertIsNotNone(audit)

    def test_05_expiring_credentials_thresholds(self):
        """Test GET /api/daycare/credentials/expiring/ with 7, 30, 60, 90 days thresholds."""
        self.client.force_authenticate(user=self.user_a)

        today = timezone.now().date()

        # Credential A: expiring in 15 days
        ECECredential.objects.create(
            employee=self.employee_a,
            daycare=self.daycare_a,
            credential_type=self.type_fa,
            province=self.prov_on,
            certificate_number="EXP-15",
            issue_date=today - timedelta(days=350),
            expiry_date=today + timedelta(days=15),
            status="Active",
            is_current=True
        )

        # Credential B: expiring in 45 days
        ECECredential.objects.create(
            employee=self.employee_a,
            daycare=self.daycare_a,
            credential_type=self.type_fa,
            province=self.prov_on,
            certificate_number="EXP-45",
            issue_date=today - timedelta(days=320),
            expiry_date=today + timedelta(days=45),
            status="Active",
            is_current=True
        )

        # Credential C: expiring in 80 days
        ECECredential.objects.create(
            employee=self.employee_a,
            daycare=self.daycare_a,
            credential_type=self.type_fa,
            province=self.prov_on,
            certificate_number="EXP-80",
            issue_date=today - timedelta(days=280),
            expiry_date=today + timedelta(days=80),
            status="Active",
            is_current=True
        )

        # 30-day default query (Dashboard alert: CERTIFICATIONS EXPIRING IN 30 DAYS)
        res_30 = self.client.get('/api/daycare/credentials/expiring/', {'days': 30})
        self.assertEqual(res_30.status_code, status.HTTP_200_OK)
        self.assertEqual(res_30.data['count'], 1)
        self.assertEqual(res_30.data['results'][0]['certificate_number'], "EXP-15")

        # 60-day threshold query
        res_60 = self.client.get('/api/daycare/credentials/expiring/', {'days': 60})
        self.assertEqual(res_60.status_code, status.HTTP_200_OK)
        self.assertEqual(res_60.data['count'], 2)

        # 90-day threshold query
        res_90 = self.client.get('/api/daycare/credentials/expiring/', {'days': 90})
        self.assertEqual(res_90.status_code, status.HTTP_200_OK)
        self.assertEqual(res_90.data['count'], 3)

    def test_06_unauthorized_user_blocked(self):
        """Guardian user cannot verify, reject, or renew credentials."""
        self.client.force_authenticate(user=self.guardian_user)

        cred = ECECredential.objects.create(
            employee=self.employee_a,
            daycare=self.daycare_a,
            credential_type=self.type_fa,
            province=self.prov_on,
            issue_date=date(2026, 1, 1),
            expiry_date=date(2029, 1, 1),
            status="Active"
        )

        res = self.client.post(f'/api/daycare/credentials/{cred.id}/verify/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_07_cross_daycare_isolation(self):
        """Daycare A admin cannot verify, reject, or renew Daycare B credentials."""
        self.client.force_authenticate(user=self.user_a)

        cred_b = ECECredential.objects.create(
            employee=self.employee_b,
            daycare=self.daycare_b,
            credential_type=self.type_fa,
            province=self.prov_on,
            issue_date=date(2026, 1, 1),
            expiry_date=date(2029, 1, 1),
            status="Active"
        )

        res_v = self.client.post(f'/api/daycare/credentials/{cred_b.id}/verify/')
        self.assertEqual(res_v.status_code, status.HTTP_404_NOT_FOUND)

        res_r = self.client.post(f'/api/daycare/credentials/{cred_b.id}/reject/', {"rejection_reason": "No match"}, format='json')
        self.assertEqual(res_r.status_code, status.HTTP_404_NOT_FOUND)

        res_rn = self.client.post(f'/api/daycare/credentials/{cred_b.id}/renew/', {"issue_date": "2026-05-01"}, format='json')
        self.assertEqual(res_rn.status_code, status.HTTP_404_NOT_FOUND)
