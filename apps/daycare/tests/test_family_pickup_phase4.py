import uuid
from datetime import date, time, timedelta
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    User, Daycare, Student, StudentPickup, StudentAttendance,
    ChildEnrollment, Family, Guardian, FamilyGuardian, FamilyChild,
    FamilyMessage, PickupQRToken, PickupSecurityPIN, SafeArrivalDepartureEvent,
    DaycareSettings, Employee
)
from daycare.services.digital_verification import DigitalVerificationService
from daycare.services.family_notifications import FamilyNotificationService


class FamilyPickupPhase4Tests(TestCase):
    """
    Module 12 Phase 4: Family Portal Integration Tests.
    Covers:
    - Guardian child isolation and permissions
    - Guardian pickup creation (status=PENDING_APPROVAL)
    - Staff approval & rejection with family notification dispatch
    - QR token pass access & regeneration
    - PIN setup, hashing and status privacy
    - Real-time Safe Arrival child status (Module 11 attendance reuse)
    - Attendance arrival, departure, late pickup, and unauthorized attempt notifications
    - Data privacy (no leak of other families, staff notes, or internal audits)
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Setup Daycare A
        self.daycare_a = Daycare.objects.create(
            name="Sunshine Early Learning Center",
            status="Active",
            closing_time=time(18, 0)
        )
        self.settings_a = DaycareSettings.objects.create(
            daycare=self.daycare_a,
            allow_parent_notifications=True,
            allow_staff_notifications=True,
            default_operating_end=time(18, 0),
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        # 2. Staff user for Daycare A
        self.staff_user_a = User.objects.create_user(
            username="staff_alice",
            email="staff.alice@sunshine.test",
            password="staffpassword123",
            is_staff=True,
            daycare=self.daycare_a,
            first_name="Alice",
            last_name="Staff"
        )
        self.staff_emp_a = Employee.objects.create(
            user=self.staff_user_a,
            daycare=self.daycare_a,
            first_name="Alice",
            last_name="Staff",
            email="staff.alice@sunshine.test",
            status="Active"
        )

        # 3. Children in Daycare A
        self.child_a1 = Student.objects.create(
            daycare=self.daycare_a,
            first_name="Tommy",
            last_name="Shelby",
            dob=date(2021, 5, 10),
            status="Active"
        )
        self.enrollment_a1 = ChildEnrollment.objects.create(
            student=self.child_a1,
            enrollment_date=date(2024, 1, 1),
            status="Active"
        )

        self.child_a2 = Student.objects.create(
            daycare=self.daycare_a,
            first_name="Bella",
            last_name="Swan",
            dob=date(2022, 2, 14),
            status="Active"
        )
        self.enrollment_a2 = ChildEnrollment.objects.create(
            student=self.child_a2,
            enrollment_date=date(2024, 1, 1),
            status="Active"
        )

        # 4. Family A (owns Tommy Shelby)
        self.family_a = Family.objects.create(
            daycare=self.daycare_a,
            family_name="Shelby Family",
            status="Active",
            primary_contact="Arthur Shelby",
            primary_email="arthur@shelby.test"
        )
        FamilyChild.objects.create(family=self.family_a, student=self.child_a1)

        self.guardian_user_a = User.objects.create_user(
            username="guardian_arthur",
            email="arthur@shelby.test",
            password="guardianpass123",
            daycare=self.daycare_a,
            first_name="Arthur",
            last_name="Shelby"
        )
        self.guardian_a = Guardian.objects.create(
            user=self.guardian_user_a,
            daycare=self.daycare_a,
            first_name="Arthur",
            last_name="Shelby",
            email="arthur@shelby.test"
        )
        FamilyGuardian.objects.create(family=self.family_a, guardian=self.guardian_a, is_primary=True, status="Active")

        # 5. Family B (owns Bella Swan)
        self.family_b = Family.objects.create(
            daycare=self.daycare_a,
            family_name="Swan Family",
            status="Active",
            primary_contact="Charlie Swan",
            primary_email="charlie@swan.test"
        )
        FamilyChild.objects.create(family=self.family_b, student=self.child_a2)

        self.guardian_user_b = User.objects.create_user(
            username="guardian_charlie",
            email="charlie@swan.test",
            password="guardianpass123",
            daycare=self.daycare_a,
            first_name="Charlie",
            last_name="Swan"
        )
        self.guardian_b = Guardian.objects.create(
            user=self.guardian_user_b,
            daycare=self.daycare_a,
            first_name="Charlie",
            last_name="Swan",
            email="charlie@swan.test"
        )
        FamilyGuardian.objects.create(family=self.family_b, guardian=self.guardian_b, is_primary=True, status="Active")

    def test_01_guardian_child_isolation(self):
        """01. Guardian can view their own child's pickups, but is blocked from other children (403 Forbidden)."""
        self.client.force_authenticate(user=self.guardian_user_a)

        # Authorized pickups for own child (Tommy) -> 200 OK
        resp_own = self.client.get(f'/api/family/children/{self.child_a1.id}/authorized-pickups/')
        self.assertEqual(resp_own.status_code, status.HTTP_200_OK)

        # Attempt to access pickups for Family B's child (Bella) -> 403 Forbidden
        resp_other = self.client.get(f'/api/family/children/{self.child_a2.id}/authorized-pickups/')
        self.assertEqual(resp_other.status_code, status.HTTP_403_FORBIDDEN)

    def test_02_guardian_submit_pickup_person_defaults_pending(self):
        """02. Guardian submits new authorized pickup person -> status is PENDING_APPROVAL / Pending."""
        self.client.force_authenticate(user=self.guardian_user_a)

        payload = {
            "name": "Grandma Polly Gray",
            "relationship": "Grandmother",
            "phone": "555-0199",
            "email": "polly@gray.test",
            "valid_from": "2026-09-01",
            "valid_until": "2026-12-31",
            "notes": "Authorized for Friday afternoon pickups."
        }
        resp = self.client.post(f'/api/family/children/{self.child_a1.id}/authorized-pickups/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["name"], "Grandma Polly Gray")
        self.assertEqual(data["approval_status"], "Pending")
        self.assertEqual(data["authorization_status"], "PENDING_VERIFICATION")

        # Verify in database
        pickup_obj = StudentPickup.objects.get(id=data["id"])
        self.assertEqual(pickup_obj.student, self.child_a1)
        self.assertEqual(pickup_obj.family, self.family_a)
        self.assertEqual(pickup_obj.approval_status, "Pending")

    def test_03_staff_approval_workflow_and_notification(self):
        """03. Daycare staff approves pending pickup -> status ACTIVE/Approved and dispatches family notification."""
        # Guardian creates pickup
        pickup = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            family=self.family_a,
            name="Uncle Michael Gray",
            relationship="Uncle",
            phone="555-0200",
            approval_status="Pending",
            authorization_status="PENDING_VERIFICATION"
        )

        # Staff approves
        self.client.force_authenticate(user=self.staff_user_a)
        resp = self.client.post(f'/api/daycare/authorized-pickups/{pickup.id}/approve/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        pickup.refresh_from_db()
        self.assertEqual(pickup.approval_status, "Approved")
        self.assertEqual(pickup.authorization_status, StudentPickup.STATUS_ACTIVE)

        # Verify notification sent to Family A
        messages = FamilyMessage.objects.filter(family=self.family_a, subject="Pickup Authorization Approved")
        self.assertTrue(messages.exists())
        self.assertIn("Michael Gray", messages.first().body)

    def test_04_staff_rejection_workflow_and_notification(self):
        """04. Daycare staff rejects pending pickup -> status INACTIVE/Rejected and dispatches family notification."""
        pickup = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            family=self.family_a,
            name="Suspicious Stranger",
            relationship="Acquaintance",
            phone="555-9999",
            approval_status="Pending",
            authorization_status="PENDING_VERIFICATION"
        )

        # Staff rejects
        self.client.force_authenticate(user=self.staff_user_a)
        resp = self.client.post(f'/api/daycare/authorized-pickups/{pickup.id}/reject/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        pickup.refresh_from_db()
        self.assertEqual(pickup.approval_status, "Rejected")
        self.assertEqual(pickup.authorization_status, StudentPickup.STATUS_INACTIVE)

        # Verify notification sent to Family A
        messages = FamilyMessage.objects.filter(family=self.family_a, subject="Pickup Authorization Rejected")
        self.assertTrue(messages.exists())
        self.assertIn("Suspicious Stranger", messages.first().body)

    def test_05_qr_pass_access_for_approved_pickup_only(self):
        """05. Guardian can access QR token pass only for approved pickup; pending/rejected returns 400 Bad Request."""
        # 1. Approved pickup
        approved_pickup = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            family=self.family_a,
            name="Aunt Ada Thorne",
            relationship="Aunt",
            phone="555-0300",
            approval_status="Approved",
            authorization_status=StudentPickup.STATUS_ACTIVE
        )

        # 2. Pending pickup
        pending_pickup = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            family=self.family_a,
            name="John Shelby",
            relationship="Brother",
            phone="555-0301",
            approval_status="Pending",
            authorization_status="PENDING_VERIFICATION"
        )

        self.client.force_authenticate(user=self.guardian_user_a)

        # QR pass for approved pickup -> 200 OK with token
        resp_approved = self.client.get(f'/api/family/authorized-pickups/{approved_pickup.id}/qr-pass/')
        self.assertEqual(resp_approved.status_code, status.HTTP_200_OK)
        data = resp_approved.json()
        self.assertIn("qr_token", data)
        self.assertEqual(data["name"], "Aunt Ada Thorne")

        # QR pass for pending pickup -> 400 Bad Request
        resp_pending = self.client.get(f'/api/family/authorized-pickups/{pending_pickup.id}/qr-pass/')
        self.assertEqual(resp_pending.status_code, status.HTTP_400_BAD_REQUEST)

    def test_06_pin_setup_hashing_and_status(self):
        """06. Guardian can configure PIN for approved pickup; PIN is securely hashed and plaintext is never leaked."""
        approved_pickup = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            family=self.family_a,
            name="Finn Shelby",
            relationship="Brother",
            phone="555-0400",
            approval_status="Approved",
            authorization_status=StudentPickup.STATUS_ACTIVE
        )

        self.client.force_authenticate(user=self.guardian_user_a)

        # Check PIN status before setting -> has_pin: False
        resp_status_before = self.client.get(f'/api/family/authorized-pickups/{approved_pickup.id}/pin/')
        self.assertEqual(resp_status_before.status_code, status.HTTP_200_OK)
        self.assertFalse(resp_status_before.json()["has_pin"])

        # Set PIN
        resp_set = self.client.post(
            f'/api/family/authorized-pickups/{approved_pickup.id}/pin/',
            {"pin": "4826"},
            format='json'
        )
        self.assertEqual(resp_set.status_code, status.HTTP_200_OK)

        # Check PIN status after setting -> has_pin: True (no raw PIN in response)
        resp_status_after = self.client.get(f'/api/family/authorized-pickups/{approved_pickup.id}/pin/')
        self.assertEqual(resp_status_after.status_code, status.HTTP_200_OK)
        self.assertTrue(resp_status_after.json()["has_pin"])
        self.assertNotIn("4826", str(resp_status_after.json()))

        # Database verification: PBKDF2 hash stored
        pin_obj = PickupSecurityPIN.objects.get(pickup_person=approved_pickup)
        self.assertNotEqual(pin_obj.pin_hash, "4826")
        self.assertTrue(pin_obj.check_pin("4826"))

    def test_07_real_time_safe_arrival_status_api(self):
        """07. Guardian gets live safe arrival/departure states for own children reusing Module 11 attendance."""
        today = timezone.now().date()

        # Tommy is checked in at 8:30 AM
        StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            attendance_date=today,
            check_in_time=time(8, 30),
            attendance_status="PRESENT",
            arrival_type="QR"
        )

        self.client.force_authenticate(user=self.guardian_user_a)
        resp = self.client.get('/api/family/safe-arrival/status/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()

        self.assertEqual(data["total_children"], 1)
        child_status = data["children"][0]
        self.assertEqual(child_status["child_id"], str(self.child_a1.id))
        self.assertEqual(child_status["status"], "CURRENTLY_PRESENT")
        self.assertIn("08:30", child_status["check_in_time"])
        self.assertIsNone(child_status["check_out_time"])

    def test_08_attendance_checkin_and_checkout_notifications(self):
        """08. Digital verification check-in and check-out trigger family messages."""
        pickup = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            family=self.family_a,
            name="Uncle Arthur",
            relationship="Uncle",
            phone="555-0500",
            approval_status="Approved",
            authorization_status=StudentPickup.STATUS_ACTIVE
        )
        token_obj = DigitalVerificationService.generate_qr_token(pickup, user=self.staff_user_a)

        # 1. Check-In via QR
        DigitalVerificationService.process_qr_checkin(
            daycare=self.daycare_a,
            token_str=token_obj.token,
            child_id=str(self.child_a1.id),
            staff_user=self.staff_user_a
        )

        # Verify Check-In message to Family A
        in_msgs = FamilyMessage.objects.filter(family=self.family_a, subject="Child Arrival Recorded")
        self.assertTrue(in_msgs.exists())
        self.assertIn("Tommy Shelby has arrived", in_msgs.first().body)

        # 2. Check-Out via QR
        DigitalVerificationService.process_qr_checkout(
            daycare=self.daycare_a,
            token_str=token_obj.token,
            child_id=str(self.child_a1.id),
            staff_user=self.staff_user_a
        )

        # Verify Check-Out message to Family A
        out_msgs = FamilyMessage.objects.filter(family=self.family_a, subject="Child Departure Recorded")
        self.assertTrue(out_msgs.exists())
        self.assertIn("Uncle Arthur", out_msgs.first().body)

    def test_09_unauthorized_pickup_attempt_dispatches_security_alert_to_family(self):
        """09. Blocked unauthorized pickup attempt generates high-priority family security notification."""
        # Unapproved pickup person
        unapproved = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a1,
            family=self.family_a,
            name="Unapproved Guy",
            relationship="Stranger",
            phone="555-0000",
            approval_status="Pending",
            authorization_status=StudentPickup.STATUS_INACTIVE
        )

        # Attempt verification failure
        DigitalVerificationService._record_failed_event(
            daycare=self.daycare_a,
            student=self.child_a1,
            method=SafeArrivalDepartureEvent.METHOD_MANUAL,
            pickup_person=unapproved,
            reason="Pickup person is not active/approved.",
            user=self.staff_user_a,
            is_unauthorized=True
        )

        # Verify family alert
        sec_msgs = FamilyMessage.objects.filter(
            family=self.family_a,
            subject="Security Alert: Unauthorized Pickup Attempt"
        )
        self.assertTrue(sec_msgs.exists())
        self.assertIn("Tommy Shelby", sec_msgs.first().body)

    def test_10_privacy_and_cross_family_isolation(self):
        """10. Guardian A cannot access Guardian B's pickups, safe arrival status, or internal staff logs."""
        pickup_b = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_a2,
            family=self.family_b,
            name="Billy Black",
            relationship="Family Friend",
            phone="555-0777",
            approval_status="Approved",
            authorization_status=StudentPickup.STATUS_ACTIVE
        )

        self.client.force_authenticate(user=self.guardian_user_a)

        # 1. Attempt to get QR pass of Family B's pickup -> 404 Not Found
        resp_qr = self.client.get(f'/api/family/authorized-pickups/{pickup_b.id}/qr-pass/')
        self.assertEqual(resp_qr.status_code, status.HTTP_404_NOT_FOUND)

        # 2. Attempt to get PIN of Family B's pickup -> 404 Not Found
        resp_pin = self.client.get(f'/api/family/authorized-pickups/{pickup_b.id}/pin/')
        self.assertEqual(resp_pin.status_code, status.HTTP_404_NOT_FOUND)

        # 3. Attempt to access staff dashboard / exceptions -> 403 Forbidden
        resp_staff_dash = self.client.get('/api/daycare/safe-arrival/dashboard/')
        self.assertEqual(resp_staff_dash.status_code, status.HTTP_403_FORBIDDEN)

        resp_staff_ex = self.client.get('/api/daycare/safe-arrival/exceptions/')
        self.assertEqual(resp_staff_ex.status_code, status.HTTP_403_FORBIDDEN)
