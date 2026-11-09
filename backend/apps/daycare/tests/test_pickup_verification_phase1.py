import uuid
from datetime import date, timedelta
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import (
    User, Daycare, Branch, Student, ChildEnrollment,
    StudentPickup, AuditLog, Family, FamilyChild, FamilyGuardian, Guardian
)
from daycare.services.pickup import PickupVerificationService


class PickupVerificationPhase1Tests(APITestCase):
    def setUp(self):
        # 1. Daycares
        self.daycare_a = Daycare.objects.create(name="Sunshine Daycare A", status="Active")
        self.daycare_b = Daycare.objects.create(name="Moonlight Daycare B", status="Active")

        # 2. Users (Staff / Admins)
        self.admin_a = User.objects.create_user(
            email='admin_a@daycare.com', username='admin_a', password='password123',
            is_staff=True, daycare=self.daycare_a
        )
        self.admin_b = User.objects.create_user(
            email='admin_b@daycare.com', username='admin_b', password='password123',
            is_staff=True, daycare=self.daycare_b
        )

        # 3. Children
        self.child_a1 = Student.objects.create(
            daycare=self.daycare_a, first_name="Emma", last_name="Watson",
            admission_number="ADM-A1", status="Active"
        )
        self.child_a2 = Student.objects.create(
            daycare=self.daycare_a, first_name="Liam", last_name="Smith",
            admission_number="ADM-A2", status="Active"
        )
        self.child_b = Student.objects.create(
            daycare=self.daycare_b, first_name="Noah", last_name="Davis",
            admission_number="ADM-B1", status="Active"
        )

        # 4. Active Enrollments
        self.enrollment_a1 = ChildEnrollment.objects.create(
            student=self.child_a1, status="Active", start_date=date(2026, 1, 1)
        )
        self.enrollment_a2 = ChildEnrollment.objects.create(
            student=self.child_a2, status="Active", start_date=date(2026, 1, 1)
        )
        self.enrollment_b = ChildEnrollment.objects.create(
            student=self.child_b, status="Active", start_date=date(2026, 1, 1)
        )

        # 5. Families & Guardians
        now = timezone.now()
        self.family_a = Family.objects.create(
            family_name="Watson Family", daycare=self.daycare_a, status="Active",
            created_at=now, updated_at=now
        )
        FamilyChild.objects.create(family=self.family_a, student=self.child_a1, created_at=now)
        
        self.guardian_user_a = User.objects.create_user(
            email='guardian_a@test.com', username='guardian_a', password='password123',
            is_staff=False, daycare=self.daycare_a
        )
        self.guardian_a = Guardian.objects.create(
            user=self.guardian_user_a, daycare=self.daycare_a, first_name="John", last_name="Watson",
            email="guardian_a@test.com", status="Active",
            created_at=now, updated_at=now
        )
        FamilyGuardian.objects.create(
            family=self.family_a, guardian=self.guardian_a, relationship="Father", is_primary=True, status="Active",
            created_at=now
        )

        self.family_b = Family.objects.create(
            family_name="Davis Family", daycare=self.daycare_b, status="Active",
            created_at=now, updated_at=now
        )
        FamilyChild.objects.create(family=self.family_b, student=self.child_b, created_at=now)
        self.guardian_user_b = User.objects.create_user(
            email='guardian_b@test.com', username='guardian_b', password='password123',
            is_staff=False, daycare=self.daycare_b
        )
        self.guardian_b = Guardian.objects.create(
            user=self.guardian_user_b, daycare=self.daycare_b, first_name="Sarah", last_name="Davis",
            email="guardian_b@test.com", status="Active",
            created_at=now, updated_at=now
        )
        FamilyGuardian.objects.create(
            family=self.family_b, guardian=self.guardian_b, relationship="Mother", is_primary=True, status="Active",
            created_at=now
        )


        # 6. Authorized Pickups
        self.pickup_active = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            name="Grandma Watson",
            relationship="Grandmother",
            phone="555-0101",
            authorization_status="ACTIVE",
            valid_from=date.today() - timedelta(days=10),
            valid_until=date.today() + timedelta(days=30)
        )

        self.pickup_expired = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            name="Uncle Bob",
            relationship="Uncle",
            phone="555-0102",
            authorization_status="ACTIVE",
            valid_from=date.today() - timedelta(days=40),
            valid_until=date.today() - timedelta(days=1)
        )

        self.pickup_revoked = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            name="Neighbor Dave",
            relationship="Neighbor",
            phone="555-0103",
            authorization_status="REVOKED"
        )

        self.pickup_inactive = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            name="Aunt Clara",
            relationship="Aunt",
            phone="555-0104",
            authorization_status="INACTIVE"
        )

        self.pickup_pending = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            name="Babysitter Jill",
            relationship="Babysitter",
            phone="555-0105",
            authorization_status="PENDING_VERIFICATION"
        )

        self.pickup_child_b = StudentPickup.objects.create(
            daycare=self.daycare_b,
            student=self.child_b,
            name="Grandpa Davis",
            relationship="Grandfather",
            phone="555-0201",
            authorization_status="ACTIVE"
        )

    # ==========================================
    # 1. Verification Service Unit Tests
    # ==========================================

    def test_valid_pickup_verification(self):
        result = PickupVerificationService.verify(
            daycare=self.daycare_a,
            child_id=self.child_a1.id,
            pickup_person_id=self.pickup_active.id,
            user=self.admin_a
        )
        self.assertTrue(result['is_authorized'])
        self.assertEqual(result['status'], 'AUTHORIZED')
        self.assertIn("authorized and active", result['reason'])
        self.assertEqual(result['child']['first_name'], "Emma")
        self.assertEqual(result['pickup_person']['name'], "Grandma Watson")

        # Verify Audit Log
        log = AuditLog.objects.filter(entity_type="StudentPickup", entity_id=str(self.pickup_active.id), action="Verified Pickup Authorization").first()
        self.assertIsNotNone(log)
        self.assertTrue(log.new_values['is_authorized'])

    def test_expired_pickup_verification(self):
        result = PickupVerificationService.verify(
            daycare=self.daycare_a,
            child_id=self.child_a1.id,
            pickup_person_id=self.pickup_expired.id,
            user=self.admin_a
        )
        self.assertFalse(result['is_authorized'])
        self.assertEqual(result['status'], 'NOT_AUTHORIZED')
        self.assertIn("expired", result['reason'].lower())

    def test_revoked_pickup_verification(self):
        result = PickupVerificationService.verify(
            daycare=self.daycare_a,
            child_id=self.child_a1.id,
            pickup_person_id=self.pickup_revoked.id,
            user=self.admin_a
        )
        self.assertFalse(result['is_authorized'])
        self.assertEqual(result['status'], 'NOT_AUTHORIZED')
        self.assertIn("revoked", result['reason'].lower())

    def test_inactive_pickup_verification(self):
        result = PickupVerificationService.verify(
            daycare=self.daycare_a,
            child_id=self.child_a1.id,
            pickup_person_id=self.pickup_inactive.id,
            user=self.admin_a
        )
        self.assertFalse(result['is_authorized'])
        self.assertEqual(result['status'], 'NOT_AUTHORIZED')
        self.assertIn("inactive", result['reason'].lower())

    def test_pending_verification_pickup(self):
        result = PickupVerificationService.verify(
            daycare=self.daycare_a,
            child_id=self.child_a1.id,
            pickup_person_id=self.pickup_pending.id,
            user=self.admin_a
        )
        self.assertFalse(result['is_authorized'])
        self.assertEqual(result['status'], 'NOT_AUTHORIZED')
        self.assertIn("pending", result['reason'].lower())

    def test_wrong_child_verification(self):
        # pickup_active is authorized for child_a1, attempting to verify for child_a2
        result = PickupVerificationService.verify(
            daycare=self.daycare_a,
            child_id=self.child_a2.id,
            pickup_person_id=self.pickup_active.id,
            user=self.admin_a
        )
        self.assertFalse(result['is_authorized'])
        self.assertEqual(result['status'], 'NOT_AUTHORIZED')
        self.assertIn("not authorized for this child", result['reason'].lower())

    def test_child_without_active_enrollment(self):
        # Withdraw child_a1 enrollment
        self.enrollment_a1.status = "Withdrawn"
        self.enrollment_a1.save()

        result = PickupVerificationService.verify(
            daycare=self.daycare_a,
            child_id=self.child_a1.id,
            pickup_person_id=self.pickup_active.id,
            user=self.admin_a
        )
        self.assertFalse(result['is_authorized'])
        self.assertEqual(result['status'], 'NOT_AUTHORIZED')
        self.assertIn("active enrollment", result['reason'].lower())

    def test_missing_pickup_authorization(self):
        result = PickupVerificationService.verify(
            daycare=self.daycare_a,
            child_id=self.child_a1.id,
            pickup_person_id=uuid.uuid4(),
            user=self.admin_a
        )
        self.assertFalse(result['is_authorized'])
        self.assertEqual(result['status'], 'NOT_AUTHORIZED')
        self.assertIn("not found", result['reason'].lower())

    def test_wrong_daycare_verification(self):
        # Admin from daycare A attempts to verify pickup for Child B
        result = PickupVerificationService.verify(
            daycare=self.daycare_a,
            child_id=self.child_b.id,
            pickup_person_id=self.pickup_child_b.id,
            user=self.admin_a
        )
        self.assertFalse(result['is_authorized'])
        self.assertEqual(result['status'], 'NOT_AUTHORIZED')
        self.assertIn("does not belong to this daycare", result['reason'])

    # ==========================================
    # 2. REST API Verification Endpoint Tests
    # ==========================================

    def test_api_verify_pickup_authorized(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post('/api/daycare/pickups/verify/', {
            "child_id": str(self.child_a1.id),
            "pickup_person_id": str(self.pickup_active.id),
            "notes": "Verified photo and driver license."
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_authorized'])
        self.assertEqual(response.data['status'], 'AUTHORIZED')

    def test_api_verify_pickup_not_authorized(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post('/api/daycare/pickups/verify/', {
            "child_id": str(self.child_a1.id),
            "pickup_person_id": str(self.pickup_revoked.id)
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_authorized'])
        self.assertEqual(response.data['status'], 'NOT_AUTHORIZED')

    def test_api_active_pickups_list(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(f'/api/daycare/children/{self.child_a1.id}/pickups/active/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only include pickup_active (not expired, revoked, inactive, pending)
        pickup_ids = [p['id'] for p in response.data]
        self.assertIn(str(self.pickup_active.id), pickup_ids)
        self.assertNotIn(str(self.pickup_expired.id), pickup_ids)
        self.assertNotIn(str(self.pickup_revoked.id), pickup_ids)

    # ==========================================
    # 3. Pickup Management & Actions (Activate, Revoke, Set Expiry)
    # ==========================================

    def test_pickup_create_and_tenant_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(f'/api/daycare/children/{self.child_a1.id}/authorized-pickups/', {
            "name": "Uncle Tommy",
            "relationship": "Uncle",
            "phone": "555-9988",
            "email": "tommy@test.com",
            "authorization_status": "ACTIVE",
            "valid_from": str(date.today()),
            "valid_until": str(date.today() + timedelta(days=60)),
            "notes": "Allowed for afternoon pickups"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], "Uncle Tommy")
        new_id = response.data['id']

        # Ensure AuditLog created
        log = AuditLog.objects.filter(entity_type="StudentPickup", entity_id=str(new_id), action="Created Pickup Authorization").first()
        self.assertIsNotNone(log)

        # Ensure Daycare B cannot access this pickup
        self.client.force_authenticate(user=self.admin_b)
        response_b = self.client.get(f'/api/daycare/authorized-pickups/{new_id}/')
        self.assertEqual(response_b.status_code, status.HTTP_404_NOT_FOUND)

    def test_pickup_revoke_action(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(f'/api/daycare/authorized-pickups/{self.pickup_active.id}/revoke/', {
            "reason": "Parent requested revocation due to court order"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['authorization_status'], "REVOKED")

        self.pickup_active.refresh_from_db()
        self.assertEqual(self.pickup_active.authorization_status, "REVOKED")
        self.assertIn("court order", self.pickup_active.notes)

        # AuditLog recorded
        log = AuditLog.objects.filter(entity_type="StudentPickup", entity_id=str(self.pickup_active.id), action="Revoked Pickup Authorization").first()
        self.assertIsNotNone(log)

    def test_pickup_set_expiry_action(self):
        self.client.force_authenticate(user=self.admin_a)
        new_date = str(date.today() + timedelta(days=15))
        response = self.client.post(f'/api/daycare/authorized-pickups/{self.pickup_active.id}/set-expiry/', {
            "valid_until": new_date
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['valid_until'], new_date)

    def test_pickup_history_action(self):
        self.client.force_authenticate(user=self.admin_a)
        # Perform verification to generate audit log
        PickupVerificationService.verify(
            daycare=self.daycare_a,
            child_id=self.child_a1.id,
            pickup_person_id=self.pickup_active.id,
            user=self.admin_a
        )
        response = self.client.get(f'/api/daycare/authorized-pickups/{self.pickup_active.id}/history/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    # ==========================================
    # 4. Photo Security & Upload Tests
    # ==========================================

    def test_photo_upload_and_secure_download(self):
        self.client.force_authenticate(user=self.admin_a)
        image_content = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00"
        dummy_file = SimpleUploadedFile("pickup.jpg", image_content, content_type="image/jpeg")

        # 1. Upload photo
        response = self.client.post(
            f'/api/daycare/authorized-pickups/{self.pickup_active.id}/photo/',
            {'photo': dummy_file},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pickup_active.refresh_from_db()
        self.assertTrue(bool(self.pickup_active.photo))

        # 2. Admin A can view photo
        get_resp = self.client.get(f'/api/daycare/authorized-pickups/{self.pickup_active.id}/photo/')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)

        # 3. Admin B (different daycare) CANNOT view photo (404/403)
        self.client.force_authenticate(user=self.admin_b)
        get_resp_b = self.client.get(f'/api/daycare/authorized-pickups/{self.pickup_active.id}/photo/')
        self.assertIn(get_resp_b.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

        # 4. Unauthenticated user CANNOT view photo (401)
        self.client.logout()
        get_resp_anon = self.client.get(f'/api/daycare/authorized-pickups/{self.pickup_active.id}/photo/')
        self.assertEqual(get_resp_anon.status_code, status.HTTP_401_UNAUTHORIZED)

    # ==========================================
    # 5. Guardian Portal Isolation Tests
    # ==========================================

    def test_guardian_pickup_isolation(self):
        # Guardian A can view pickups for child_a1
        self.client.force_authenticate(user=self.guardian_user_a)
        resp_a = self.client.get(f'/api/family/children/{self.child_a1.id}/authorized-pickups/')
        self.assertEqual(resp_a.status_code, status.HTTP_200_OK)
        names = [p['name'] for p in resp_a.data]
        self.assertIn("Grandma Watson", names)

        # Guardian A CANNOT view child_b pickups
        resp_b = self.client.get(f'/api/family/children/{self.child_b.id}/authorized-pickups/')
        self.assertEqual(resp_b.status_code, status.HTTP_403_FORBIDDEN)
