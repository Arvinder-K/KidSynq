import uuid
from datetime import date, datetime, timedelta
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    User, Daycare, Branch, Student, ChildEnrollment,
    StudentPickup, StudentAttendance, Employee,
    PickupQRToken, PickupSecurityPIN, SafeArrivalDepartureEvent,
    AuditLog, Family, FamilyChild, FamilyGuardian, Guardian
)
from daycare.services.digital_verification import DigitalVerificationService


class PickupVerificationPhase2Tests(TestCase):
    """
    Module 12 Phase 2: QR, PIN & Digital Verification Tests
    Covers QR generation/revocation/scan, QR check-in & check-out, PIN security & lockout,
    Digital signature departure, tenant isolation, wrong-child rejections, and event auditing.
    """

    def setUp(self):
        self.client = APIClient()
        self.today = timezone.now().date()
        self.now = timezone.now()

        # 1. Daycares
        self.daycare_a = Daycare.objects.create(name=f"Alpha Daycare {uuid.uuid4().hex[:4]}", status="Active")
        self.daycare_b = Daycare.objects.create(name=f"Beta Daycare {uuid.uuid4().hex[:4]}", status="Active")

        # 2. Staff Users & Employees
        self.admin_user_a = User.objects.create_user(
            username=f"admin_a_{uuid.uuid4().hex[:4]}",
            email="admin_a@test.com",
            password="Password123!",
            daycare=self.daycare_a
        )
        self.employee_a = Employee.objects.create(
            user=self.admin_user_a,
            daycare=self.daycare_a,
            first_name="Alice",
            last_name="Director",
            status="active"
        )

        self.admin_user_b = User.objects.create_user(
            username=f"admin_b_{uuid.uuid4().hex[:4]}",
            email="admin_b@test.com",
            password="Password123!",
            daycare=self.daycare_b
        )
        self.employee_b = Employee.objects.create(
            user=self.admin_user_b,
            daycare=self.daycare_b,
            first_name="Bob",
            last_name="Director",
            status="active"
        )

        # 3. Children (Daycare A & Daycare B)
        self.child_a1 = Student.objects.create(
            daycare=self.daycare_a,
            first_name="Emma",
            last_name="Watson",
            admission_number="ADM-A1",
            status="Active",
            dob=self.today - timedelta(days=1000)
        )
        self.child_a2 = Student.objects.create(
            daycare=self.daycare_a,
            first_name="Lucas",
            last_name="Watson",
            admission_number="ADM-A2",
            status="Active",
            dob=self.today - timedelta(days=700)
        )
        self.child_b1 = Student.objects.create(
            daycare=self.daycare_b,
            first_name="Noah",
            last_name="Miller",
            admission_number="ADM-B1",
            status="Active",
            dob=self.today - timedelta(days=900)
        )

        # Active Enrollments
        ChildEnrollment.objects.create(student=self.child_a1, status="Active", start_date=date(2026, 1, 1))
        ChildEnrollment.objects.create(student=self.child_a2, status="Active", start_date=date(2026, 1, 1))
        ChildEnrollment.objects.create(student=self.child_b1, status="Active", start_date=date(2026, 1, 1))

        # 4. Authorized Pickups
        # Pickup 1: Authorized for Child A1
        self.pickup_a1 = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            name="Grandma Watson",
            relationship="Grandmother",
            phone="555-0101",
            authorization_status="ACTIVE",
            valid_from=self.today - timedelta(days=30),
            valid_until=self.today + timedelta(days=90)
        )

        # Pickup 2: Authorized for Child B1 (Daycare B)
        self.pickup_b1 = StudentPickup.objects.create(
            daycare=self.daycare_b,
            student=self.child_b1,
            name="Uncle Bob",
            relationship="Uncle",
            phone="555-0202",
            authorization_status="ACTIVE",
            valid_from=self.today - timedelta(days=30),
            valid_until=self.today + timedelta(days=90)
        )

    def test_01_qr_token_generation_and_security(self):
        """01. QR token generation creates secure, unique random token with no child PII embedded"""
        token_obj = DigitalVerificationService.generate_qr_token(
            pickup_person=self.pickup_a1,
            user=self.admin_user_a,
            expires_in_days=30
        )

        self.assertIsNotNone(token_obj.token)
        self.assertGreaterEqual(len(token_obj.token), 32)
        self.assertTrue(token_obj.is_active)
        self.assertTrue(token_obj.is_valid)

        # Ensure no sensitive child/parent PII is embedded in raw token string
        self.assertNotIn(self.child_a1.first_name.lower(), token_obj.token.lower())
        self.assertNotIn("watson", token_obj.token.lower())
        self.assertNotIn("grandma", token_obj.token.lower())

        # AuditLog verified
        audit = AuditLog.objects.filter(entity_type="PickupQRToken", entity_id=str(token_obj.id)).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.action, "Generated Pickup QR Token")

    def test_02_qr_token_scan_resolves_pickup_context(self):
        """02. Scanning valid QR token returns authorized context and eligible children"""
        token_obj = DigitalVerificationService.generate_qr_token(
            pickup_person=self.pickup_a1,
            user=self.admin_user_a,
            expires_in_days=14
        )

        scan_result = DigitalVerificationService.scan_and_resolve_qr(
            daycare=self.daycare_a,
            token_str=token_obj.token,
            user=self.admin_user_a
        )

        self.assertTrue(scan_result["is_valid"])
        self.assertEqual(scan_result["pickup_person"]["name"], "Grandma Watson")
        self.assertEqual(len(scan_result["children"]), 1)
        self.assertEqual(scan_result["children"][0]["id"], str(self.child_a1.id))

    def test_03_qr_child_check_in_updates_attendance(self):
        """03. QR Check-In records attendance arrival and SafeArrivalDepartureEvent"""
        token_obj = DigitalVerificationService.generate_qr_token(
            pickup_person=self.pickup_a1,
            user=self.admin_user_a
        )

        self.client.force_authenticate(user=self.admin_user_a)
        resp = self.client.post('/api/daycare/pickups/qr/check-in/', {
            'token': token_obj.token,
            'child_id': str(self.child_a1.id),
            'notes': 'Arrived early with grandmother'
        })

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['success'])
        self.assertEqual(resp.data['event_type'], 'CHECK_IN')

        # Verify StudentAttendance
        att = StudentAttendance.objects.get(student=self.child_a1, attendance_date=self.today)
        self.assertIsNotNone(att.check_in_time)
        self.assertIsNone(att.check_out_time)
        self.assertEqual(att.arrival_type, "QR")
        self.assertEqual(att.attendance_status, "PRESENT")

        # Verify SafeArrivalDepartureEvent
        event = SafeArrivalDepartureEvent.objects.get(id=resp.data['event_id'])
        self.assertEqual(event.event_type, SafeArrivalDepartureEvent.EVENT_CHECK_IN)
        self.assertEqual(event.verification_method, SafeArrivalDepartureEvent.METHOD_QR)
        self.assertEqual(event.verification_status, SafeArrivalDepartureEvent.STATUS_SUCCESS)

    def test_04_qr_child_check_out_updates_attendance(self):
        """04. QR Check-Out records departure in StudentAttendance and SafeArrivalDepartureEvent"""
        token_obj = DigitalVerificationService.generate_qr_token(
            pickup_person=self.pickup_a1,
            user=self.admin_user_a
        )

        # Initial check-in
        DigitalVerificationService.process_qr_checkin(
            daycare=self.daycare_a,
            token_str=token_obj.token,
            child_id=str(self.child_a1.id),
            staff_user=self.admin_user_a
        )

        self.client.force_authenticate(user=self.admin_user_a)
        resp = self.client.post('/api/daycare/pickups/qr/check-out/', {
            'token': token_obj.token,
            'child_id': str(self.child_a1.id),
            'notes': 'Picked up on time'
        })

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['success'])
        self.assertEqual(resp.data['event_type'], 'CHECK_OUT')

        # Verify StudentAttendance
        att = StudentAttendance.objects.get(student=self.child_a1, attendance_date=self.today)
        self.assertIsNotNone(att.check_in_time)
        self.assertIsNotNone(att.check_out_time)
        self.assertEqual(att.departure_type, "QR")
        self.assertEqual(att.pickup_person, self.pickup_a1)

        # Verify SafeArrivalDepartureEvent
        event = SafeArrivalDepartureEvent.objects.get(id=resp.data['event_id'])
        self.assertEqual(event.event_type, SafeArrivalDepartureEvent.EVENT_CHECK_OUT)
        self.assertEqual(event.verification_method, SafeArrivalDepartureEvent.METHOD_QR)
        self.assertEqual(event.verification_status, SafeArrivalDepartureEvent.STATUS_SUCCESS)

    def test_05_invalid_qr_token_rejection(self):
        """05. Unrecognized or forged QR token is rejected and logged as failed event"""
        self.client.force_authenticate(user=self.admin_user_a)
        resp = self.client.post('/api/daycare/pickups/qr/scan/', {
            'token': 'non-existent-fake-token-12345'
        })

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Failed event recorded
        event = SafeArrivalDepartureEvent.objects.filter(
            verification_method="QR",
            verification_status="FAILED"
        ).first()
        self.assertIsNotNone(event)

    def test_06_expired_qr_token_rejection(self):
        """06. Expired QR token is rejected"""
        token_obj = PickupQRToken.objects.create(
            daycare=self.daycare_a,
            pickup_person=self.pickup_a1,
            token="expired-token-sample-9999",
            is_active=True,
            expires_at=timezone.now() - timedelta(days=2)
        )

        self.assertFalse(token_obj.is_valid)

        self.client.force_authenticate(user=self.admin_user_a)
        resp = self.client.post('/api/daycare/pickups/qr/scan/', {
            'token': token_obj.token
        })

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_07_revoked_qr_token_rejection(self):
        """07. Revoked QR token is rejected"""
        token_obj = DigitalVerificationService.generate_qr_token(
            pickup_person=self.pickup_a1,
            user=self.admin_user_a
        )

        # Revoke token
        DigitalVerificationService.revoke_qr_token(
            token_id_or_obj=token_obj,
            user=self.admin_user_a,
            reason="Card reported lost"
        )

        self.client.force_authenticate(user=self.admin_user_a)
        resp = self.client.post('/api/daycare/pickups/qr/scan/', {
            'token': token_obj.token
        })

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_08_pin_set_and_successful_checkout(self):
        """08. PIN configuration and successful PIN departure checkout"""
        self.client.force_authenticate(user=self.admin_user_a)

        # Set PIN
        resp_set = self.client.post('/api/daycare/pickups/pin/set/', {
            'pickup_person_id': str(self.pickup_a1.id),
            'pin': '4829'
        })
        self.assertEqual(resp_set.status_code, status.HTTP_200_OK)

        # PIN must be hashed in DB, never plaintext
        pin_obj = PickupSecurityPIN.objects.get(pickup_person=self.pickup_a1)
        self.assertNotEqual(pin_obj.pin_hash, '4829')
        self.assertTrue(pin_obj.pin_hash.startswith('pbkdf2_sha256$'))

        # Verify PIN Check-out
        resp_out = self.client.post('/api/daycare/pickups/pin/check-out/', {
            'pickup_person_id': str(self.pickup_a1.id),
            'pin': '4829',
            'child_id': str(self.child_a1.id),
            'notes': 'PIN verified departure'
        })
        self.assertEqual(resp_out.status_code, status.HTTP_200_OK)
        self.assertTrue(resp_out.data['success'])
        self.assertEqual(resp_out.data['verification_method'], 'PIN')

        # Verify Attendance
        att = StudentAttendance.objects.get(student=self.child_a1, attendance_date=self.today)
        self.assertEqual(att.departure_type, "PIN")

    def test_09_invalid_pin_rejection(self):
        """09. Incorrect PIN is rejected and increments failed attempts"""
        DigitalVerificationService.set_pickup_pin(
            pickup_person=self.pickup_a1,
            raw_pin='1234',
            user=self.admin_user_a
        )

        self.client.force_authenticate(user=self.admin_user_a)
        resp = self.client.post('/api/daycare/pickups/pin/check-out/', {
            'pickup_person_id': str(self.pickup_a1.id),
            'pin': '9999',
            'child_id': str(self.child_a1.id)
        })

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        pin_obj = PickupSecurityPIN.objects.get(pickup_person=self.pickup_a1)
        self.assertEqual(pin_obj.failed_attempts_count, 1)

    def test_10_pin_lockout_rate_limiting(self):
        """10. Repeated failed PIN entries (5 attempts) triggers temporary lockout"""
        DigitalVerificationService.set_pickup_pin(
            pickup_person=self.pickup_a1,
            raw_pin='5678',
            user=self.admin_user_a
        )

        self.client.force_authenticate(user=self.admin_user_a)

        # 5 failed attempts
        for _ in range(5):
            self.client.post('/api/daycare/pickups/pin/verify/', {
                'pickup_person_id': str(self.pickup_a1.id),
                'pin': '0000'
            })

        pin_obj = PickupSecurityPIN.objects.get(pickup_person=self.pickup_a1)
        self.assertTrue(pin_obj.is_locked)
        self.assertIsNotNone(pin_obj.locked_until)

        # 6th attempt with CORRECT PIN is blocked during lockout
        resp = self.client.post('/api/daycare/pickups/pin/verify/', {
            'pickup_person_id': str(self.pickup_a1.id),
            'pin': '5678'
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("locked", str(resp.data))

    def test_11_digital_signature_checkout(self):
        """11. Digital signature departure captures stroke data and updates records"""
        sample_sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

        self.client.force_authenticate(user=self.admin_user_a)
        resp = self.client.post('/api/daycare/pickups/signature/check-out/', {
            'pickup_person_id': str(self.pickup_a1.id),
            'child_id': str(self.child_a1.id),
            'signature_data': sample_sig,
            'notes': 'Signed on tablet'
        })

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['verification_method'], 'DIGITAL_SIGNATURE')

        # Check Event has signature data
        event = SafeArrivalDepartureEvent.objects.get(id=resp.data['event_id'])
        self.assertEqual(event.verification_method, SafeArrivalDepartureEvent.METHOD_DIGITAL_SIGNATURE)
        self.assertEqual(event.signature_data, sample_sig)

        # Check Attendance departure_type
        att = StudentAttendance.objects.get(student=self.child_a1, attendance_date=self.today)
        self.assertEqual(att.departure_type, "DIGITAL_SIGNATURE")

    def test_12_wrong_child_authorization_rejection(self):
        """12. Attempting to checkout a child that the pickup person is NOT authorized for is rejected"""
        # Grandma Watson is NOT authorized for Lucas (child_a2) in our setup
        token_obj = DigitalVerificationService.generate_qr_token(
            pickup_person=self.pickup_a1,
            user=self.admin_user_a
        )

        self.client.force_authenticate(user=self.admin_user_a)
        resp = self.client.post('/api/daycare/pickups/qr/check-out/', {
            'token': token_obj.token,
            'child_id': str(self.child_a2.id)
        })

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Failure recorded
        event = SafeArrivalDepartureEvent.objects.filter(
            verification_status=SafeArrivalDepartureEvent.STATUS_FAILED
        ).first()
        self.assertIsNotNone(event)

    def test_13_cross_daycare_tenant_isolation(self):
        """13. Tokens and PINs from Daycare A cannot be scanned or used in Daycare B"""
        token_a = DigitalVerificationService.generate_qr_token(
            pickup_person=self.pickup_a1,
            user=self.admin_user_a
        )

        # Admin B tries to scan Daycare A token
        self.client.force_authenticate(user=self.admin_user_b)
        resp = self.client.post('/api/daycare/pickups/qr/scan/', {
            'token': token_a.token
        })

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_14_safe_arrival_departure_events_feed_and_audit(self):
        """14. Safe arrival and departure events feed endpoint correctly returns filtered audit records"""
        # Create successful check-in
        token_obj = DigitalVerificationService.generate_qr_token(pickup_person=self.pickup_a1)
        DigitalVerificationService.process_qr_checkin(
            daycare=self.daycare_a,
            token_str=token_obj.token,
            child_id=str(self.child_a1.id),
            staff_user=self.admin_user_a
        )

        self.client.force_authenticate(user=self.admin_user_a)
        resp = self.client.get('/api/daycare/pickups/events/')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(resp.data), 1)

        first_event = resp.data[0]
        self.assertIn('verification_method', first_event)
        self.assertIn('event_type', first_event)
        self.assertEqual(first_event['child_name'], f"{self.child_a1.first_name} {self.child_a1.last_name}")
