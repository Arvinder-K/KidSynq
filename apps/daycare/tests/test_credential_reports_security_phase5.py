import os
import csv
import io
from datetime import date, timedelta
from django.test import TestCase
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Daycare, User, Employee, Classroom, ClassroomTeacherAssignment,
    Province, CredentialType, ECECredential, AuditLog,
    EmployeeCertification, EmployeeDocument, Guardian
)
from daycare.services.compliance import ComplianceService


class CredentialReportsSecurityPhase5TestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Setup Daycare A
        self.daycare_a = Daycare.objects.create(name="Sunrise Academy A", email="admin@daycarea.com", status="Active")
        self.admin_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@test.com",
            password="password123",
            daycare=self.daycare_a,
            is_staff=True
        )

        # 2. Setup Daycare B
        self.daycare_b = Daycare.objects.create(name="Starlight Academy B", email="admin@daycareb.com", status="Active")
        self.admin_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@test.com",
            password="password123",
            daycare=self.daycare_b,
            is_staff=True
        )


        # 3. Setup Super Admin
        self.super_admin = User.objects.create_superuser(
            username="superadmin",
            email="super@kidsynq.com",
            password="password123"
        )

        # 4. Setup Reference Data
        self.prov_on, _ = Province.objects.get_or_create(code="ON", defaults={"name": "Ontario"})
        self.prov_bc, _ = Province.objects.get_or_create(code="BC", defaults={"name": "British Columbia"})


        self.type_ece_on = CredentialType.objects.create(
            name="RECE",
            category="ece",
            province=self.prov_on,
            default_validity_months=12
        )
        self.type_fa = CredentialType.objects.create(
            name="Standard First Aid",
            category="certification",
            province=None,
            default_validity_months=36
        )
        self.type_cpr = CredentialType.objects.create(
            name="CPR Level C",
            category="certification",
            province=None,
            default_validity_months=12
        )
        self.type_crc = CredentialType.objects.create(
            name="Criminal Record Check",
            category="background_check",
            province=None,
            default_validity_months=60
        )
        self.type_vsc = CredentialType.objects.create(
            name="Vulnerable Sector Check",
            category="background_check",
            province=None,
            default_validity_months=60
        )
        self.type_food = CredentialType.objects.create(
            name="Food Handler Certification",
            category="certification",
            province=None,
            default_validity_months=60
        )


        # 5. Setup Staff for Daycare A
        self.emp_a1 = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Alice",
            last_name="Smith",
            email="alice@daycarea.com",
            role="Lead Teacher",
            job_title="Registered Early Childhood Educator",
            status="Active",
            employee_number="EMP-A101"
        )
        self.user_a1 = User.objects.create_user(
            username="alice",
            email="alice@daycarea.com",
            password="password123",
            daycare=self.daycare_a,
            is_staff=False
        )
        self.emp_a1.user = self.user_a1
        self.emp_a1.save()

        self.emp_a2 = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Bob",
            last_name="Jones",
            email="bob@daycarea.com",
            role="Assistant Teacher",
            job_title="Teacher Assistant",
            status="Active",
            employee_number="EMP-A102"
        )

        # 6. Setup Staff for Daycare B
        self.emp_b1 = Employee.objects.create(
            daycare=self.daycare_b,
            first_name="Charlie",
            last_name="Brown",
            email="charlie@daycareb.com",
            role="Lead Teacher",
            job_title="Senior ECE",
            status="Active",
            employee_number="EMP-B201"
        )

        # 7. Setup Guardian User
        self.guardian_user = User.objects.create_user(
            username="guardian",
            email="guardian@family.com",
            password="password123",
            is_staff=False
        )
        Guardian.objects.create(
            user=self.guardian_user,
            daycare=self.daycare_a,
            first_name="Gary",
            last_name="Guardian",
            email="guardian@family.com",
            created_at=timezone.now(),
            updated_at=timezone.now()
        )




        # 8. Setup Credentials for Alice (Compliant with active certs, one expiring in 20 days)
        today = date.today()
        self.cred_ece_a1 = ECECredential.objects.create(
            employee=self.emp_a1,
            daycare=self.daycare_a,
            credential_type=self.type_ece_on,
            province=self.prov_on,
            certificate_number="RECE-889900",
            issue_date=today - timedelta(days=300),
            expiry_date=today + timedelta(days=65),
            status="Active",
            verification_status="Verified",
            is_current=True,
            verified_by=self.admin_a,
            verified_at=timezone.now()
        )
        self.cred_fa_a1 = ECECredential.objects.create(
            employee=self.emp_a1,
            daycare=self.daycare_a,
            credential_type=self.type_fa,
            certificate_number="FA-776655",
            issue_date=today - timedelta(days=700),
            expiry_date=today + timedelta(days=20),  # Expiring in 20 days!
            status="Active",
            verification_status="Verified",
            is_current=True
        )
        self.cred_cpr_a1 = ECECredential.objects.create(
            employee=self.emp_a1,
            daycare=self.daycare_a,
            credential_type=self.type_cpr,
            certificate_number="CPR-112233",
            issue_date=today - timedelta(days=100),
            expiry_date=today + timedelta(days=265),
            status="Active",
            verification_status="Verified",
            is_current=True
        )
        self.cred_crc_a1 = ECECredential.objects.create(
            employee=self.emp_a1,
            daycare=self.daycare_a,
            credential_type=self.type_crc,
            certificate_number="CRC-990011",
            issue_date=today - timedelta(days=100),
            expiry_date=today + timedelta(days=1000),
            status="Active",
            verification_status="Verified",
            is_current=True
        )
        self.cred_vsc_a1 = ECECredential.objects.create(
            employee=self.emp_a1,
            daycare=self.daycare_a,
            credential_type=self.type_vsc,
            certificate_number="VSC-554433",
            issue_date=today - timedelta(days=100),
            expiry_date=today + timedelta(days=1000),
            status="Active",
            verification_status="Verified",
            is_current=True
        )

        # 9. Setup Credentials for Daycare B Charlie
        self.cred_ece_b1 = ECECredential.objects.create(
            employee=self.emp_b1,
            daycare=self.daycare_b,
            credential_type=self.type_ece_on,
            province=self.prov_on,
            certificate_number="RECE-B-SECRET",
            issue_date=today - timedelta(days=100),
            expiry_date=today + timedelta(days=200),
            status="Active",
            verification_status="Verified",
            is_current=True
        )



    # =========================================================================
    # 1. CREDENTIAL REPORTS (12 Standard Reports & Filtering)
    # =========================================================================
    def test_all_twelve_reports_generation(self):
        """Test all 12 reports return correct structure and data."""
        self.client.force_authenticate(user=self.admin_a)
        reports = [
            'ece', 'certification', 'expiring', 'expired', 'missing',
            'background_check', 'first_aid', 'cpr', 'food_safety',
            'training', 'employee_compliance', 'renewals'
        ]

        for rep in reports:
            res = self.client.get(reverse('credential_reports'), {'report_type': rep})
            self.assertEqual(res.status_code, status.HTTP_200_OK, f"Report {rep} failed")
            data = res.json()
            self.assertIn('title', data)
            self.assertIn('columns', data)
            self.assertIn('rows', data)
            self.assertIn('total', data)
            self.assertIsInstance(data['rows'], list)

    def test_credential_reports_filtering(self):
        """Test filtering reports by province, category, expiry days, and search."""
        self.client.force_authenticate(user=self.admin_a)

        # Filter by province ON
        res = self.client.get(reverse('credential_reports'), {'report_type': 'ece', 'province': 'ON'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertGreaterEqual(data['total'], 1)

        # Filter expiring within 30 days
        res_exp = self.client.get(reverse('credential_reports'), {'report_type': 'expiring', 'expiry_period': '30'})
        self.assertEqual(res_exp.status_code, status.HTTP_200_OK)
        data_exp = res_exp.json()
        self.assertEqual(data_exp['total'], 1)
        self.assertIn('FA-776655', str(data_exp['rows']))

    def test_credential_report_csv_streaming_export(self):
        """Test CSV export streaming endpoint."""
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.get(reverse('credential_reports'), {'report_type': 'ece', 'export_format': 'csv'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Content-Type'], 'text/csv')
        self.assertIn('attachment; filename="credential_ece_report_', res['Content-Disposition'])

        content = res.content.decode('utf-8')
        self.assertIn("KIDSYNQ - ECE CREDENTIAL REPORT", content)
        self.assertIn("Sunrise Academy A", content)
        self.assertIn("RECE-889900", content)

    # =========================================================================
    # 2. CREDENTIAL HISTORY & AUDIT LOG TIMELINE
    # =========================================================================
    def test_employee_credential_history_endpoint(self):
        """Test chronological credential audit history timeline."""
        self.client.force_authenticate(user=self.admin_a)

        # Record an audit log for Alice's ECE verification
        AuditLog.objects.create(
            user=self.admin_a,
            action="CREDENTIAL_VERIFIED",
            module="credentials",
            entity_type="credential",
            entity_id=str(self.cred_ece_a1.id),
            new_values={"details": "Certificate verified via Ontario College of ECE registry"}
        )

        res = self.client.get(reverse('employee_credential_history', kwargs={'pk': self.emp_a1.id}))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data['employee_id'], str(self.emp_a1.id))
        self.assertGreaterEqual(data['count'], 1)


    def test_credential_renewal_chain_preserves_history(self):
        """Test renewing credential preserves original record marked Superseded and logs history."""
        self.client.force_authenticate(user=self.admin_a)
        renew_url = reverse('credential_renew', kwargs={'pk': self.cred_fa_a1.id})
        today = date.today()

        res = self.client.post(renew_url, {
            'issue_date': str(today),
            'expiry_date': str(today + timedelta(days=1095)),
            'certificate_number': 'FA-RENEWED-999',
            'issuing_organization': 'Red Cross Canada',
            'notes': 'Renewed for 3 years'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Verify old record is superseded
        self.cred_fa_a1.refresh_from_db()
        self.assertEqual(self.cred_fa_a1.status, 'Superseded')

        # Check history contains renewal event
        res_hist = self.client.get(reverse('employee_credential_history', kwargs={'pk': self.emp_a1.id}))
        data_hist = res_hist.json()
        self.assertTrue(any('Renewed' in evt['action'] or 'Superseded' in evt['action'] for evt in data_hist['history']))

    # =========================================================================
    # 3. EMPLOYEE COMPLIANCE PROFILE CHECKLIST
    # =========================================================================
    def test_employee_compliance_profile_endpoint(self):
        """Test structured compliance profile checklist."""
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.get(reverse('employee_compliance_profile', kwargs={'pk': self.emp_a1.id}))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()

        self.assertIn('overall_status', data)
        self.assertEqual(data['overall_status'], 'WARNING')  # FA is expiring in 20 days
        self.assertIn('checks', data)
        self.assertEqual(data['checks']['ece']['status'], 'Valid')
        self.assertEqual(data['checks']['cpr']['status'], 'Valid')
        self.assertIn('Expires in', data['checks']['first_aid']['status'])

    # =========================================================================
    # 4. CLASSROOM TEACHER SERIALIZER COMPLIANCE INTEGRATION
    # =========================================================================
    def test_classroom_teacher_assignment_includes_compliance_data(self):
        """Test classroom teacher serializers embed compliance badges."""
        classroom = Classroom.objects.create(room_name="Toddler Blue", daycare=self.daycare_a, capacity=15)

        assignment = ClassroomTeacherAssignment.objects.create(
            classroom=classroom,
            employee=self.emp_a1,
            daycare=self.daycare_a,
            assignment_type="Primary",
            status="Active"
        )

        from core.serializers import ClassroomTeacherAssignmentSerializer
        serializer = ClassroomTeacherAssignmentSerializer(assignment)
        data = serializer.data

        self.assertIn('compliance_status', data)
        self.assertEqual(data['compliance_status'], 'WARNING')
        self.assertIn('compliance_status', data['teacher'])
        self.assertEqual(data['teacher']['compliance_status'], 'WARNING')

    # =========================================================================
    # 5. STRICT MULTI-TENANT ISOLATION (DAYCARE A VS DAYCARE B)
    # =========================================================================
    def test_tenant_isolation_reports(self):
        """Verify Daycare A admin report never leaks Daycare B credentials."""
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.get(reverse('credential_reports'), {'report_type': 'ece'})
        content = str(res.json()['rows'])

        self.assertIn("RECE-889900", content)
        self.assertNotIn("RECE-B-SECRET", content)
        self.assertNotIn("Charlie Brown", content)

    def test_tenant_isolation_cross_tenant_tampering(self):
        """Verify Daycare A admin cannot access Daycare B employee history or profile."""
        self.client.force_authenticate(user=self.admin_a)

        # Attempt to access Charlie's history (Daycare B)
        res_hist = self.client.get(reverse('employee_credential_history', kwargs={'pk': self.emp_b1.id}))
        self.assertEqual(res_hist.status_code, status.HTTP_404_NOT_FOUND)

        # Attempt to access Charlie's compliance profile (Daycare B)
        res_prof = self.client.get(reverse('employee_compliance_profile', kwargs={'pk': self.emp_b1.id}))
        self.assertEqual(res_prof.status_code, status.HTTP_404_NOT_FOUND)

        # Attempt to access Daycare B credential detail directly
        res_cred = self.client.get(reverse('credential_detail', kwargs={'pk': self.cred_ece_b1.id}))
        self.assertEqual(res_cred.status_code, status.HTTP_404_NOT_FOUND)

    # =========================================================================
    # 6. ROLE PERMISSIONS & PRIVACY
    # =========================================================================
    def test_role_teacher_can_only_view_own_history_and_profile(self):
        """Teacher can view their own profile and history, but is blocked from others and reports."""
        self.client.force_authenticate(user=self.user_a1)

        # 1. Own profile -> 200 OK
        res_own_prof = self.client.get(reverse('employee_compliance_profile', kwargs={'pk': self.emp_a1.id}))
        self.assertEqual(res_own_prof.status_code, status.HTTP_200_OK)

        # 2. Own history -> 200 OK
        res_own_hist = self.client.get(reverse('employee_credential_history', kwargs={'pk': self.emp_a1.id}))
        self.assertEqual(res_own_hist.status_code, status.HTTP_200_OK)

        # 3. Other employee profile -> 403 Forbidden
        res_other = self.client.get(reverse('employee_compliance_profile', kwargs={'pk': self.emp_a2.id}))
        self.assertEqual(res_other.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Daycare Reports -> 403 Forbidden
        res_rep = self.client.get(reverse('credential_reports'), {'report_type': 'ece'})
        self.assertEqual(res_rep.status_code, status.HTTP_403_FORBIDDEN)

    def test_role_guardian_strictly_blocked(self):
        """Guardian role is blocked from compliance endpoints."""
        self.client.force_authenticate(user=self.guardian_user)

        res_rep = self.client.get(reverse('credential_reports'), {'report_type': 'ece'})
        self.assertEqual(res_rep.status_code, status.HTTP_403_FORBIDDEN)

        res_prof = self.client.get(reverse('employee_compliance_profile', kwargs={'pk': self.emp_a1.id}))
        self.assertEqual(res_prof.status_code, status.HTTP_403_FORBIDDEN)

        res_hist = self.client.get(reverse('employee_credential_history', kwargs={'pk': self.emp_a1.id}))
        self.assertEqual(res_hist.status_code, status.HTTP_403_FORBIDDEN)

    def test_role_super_admin_has_global_access(self):
        """Super admin has global access to compliance profiles across all daycares."""
        self.client.force_authenticate(user=self.super_admin)

        res_a = self.client.get(reverse('employee_compliance_profile', kwargs={'pk': self.emp_a1.id}))
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)

        res_b = self.client.get(reverse('employee_compliance_profile', kwargs={'pk': self.emp_b1.id}))
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
