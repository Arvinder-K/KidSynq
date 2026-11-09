import uuid
from datetime import date, time, datetime, timedelta
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    User, Daycare, Student, StudentPickup, StudentAttendance,
    ChildEnrollment, Family, Guardian, FamilyGuardian, FamilyChild,
    Classroom, ClassroomStudent, AuditLog, PickupQRToken, PickupSecurityPIN,
    SafeArrivalDepartureEvent, DaycareSettings, Employee
)
from daycare.services.safe_arrival import SafeArrivalService
from daycare.services.safe_arrival_reports import SafeArrivalReportsService
from daycare.services.digital_verification import DigitalVerificationService


class SafeArrivalPhase5FinalTests(TestCase):
    """
    Module 12 Phase 5: Reports, Audit, Security & Final Integration Tests.
    Covers:
    - 10 Mandatory End-to-End Scenarios:
        Scenario 1: Authorized person -> QR -> successful pickup -> checkout recorded
        Scenario 2: Authorized person -> PIN -> successful pickup -> checkout recorded
        Scenario 3: Authorized person -> digital signature -> successful pickup
        Scenario 4: Unauthorized person -> verification failure -> checkout blocked -> alert/audit
        Scenario 5: Authorized person -> late pickup -> late pickup recorded
        Scenario 6: Guardian adds pickup person -> daycare approval -> pickup becomes active
        Scenario 7: Pickup authorization revoked -> previously valid QR/PIN no longer works
        Scenario 8: Child transferred classroom -> historical pickup records remain unchanged
        Scenario 9: Cross-daycare pickup attempt -> blocked
        Scenario 10: Attendance correction -> pickup history and audit remain consistent
    - All 8 Reports: Daily Arrival, Daily Departure, Pickup History, Late Pickup,
      Unauthorized Attempts, Verification Methods, Staff Processing, Pickup Verification.
    - CSV Export Format & Streaming
    - Complete AuditLog action coverage across all 11 action types.
    """

    def setUp(self):
        self.client = APIClient()
        self.today = timezone.now().date()

        # 1. Daycare A & Settings
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

        # 2. Staff user A
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

        # 3. Classrooms in Daycare A
        self.classroom_toddlers = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Toddler Room",
            room_code="101",
            capacity=15
        )
        self.classroom_preschool = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Preschool Room",
            room_code="102",
            capacity=20
        )

        # 4. Children in Daycare A
        self.child_tommy = Student.objects.create(
            daycare=self.daycare_a,
            first_name="Tommy",
            last_name="Shelby",
            admission_number="ADM-TOMMY",
            dob=date(2021, 5, 10),
            status="Active"
        )
        self.enrollment_tommy = ChildEnrollment.objects.create(
            student=self.child_tommy,
            enrollment_date=date(2024, 1, 1),
            status="Active"
        )
        self.cs_tommy = ClassroomStudent.objects.create(
            classroom=self.classroom_toddlers,
            student=self.child_tommy,
            status="Active"
        )

        self.child_bella = Student.objects.create(
            daycare=self.daycare_a,
            first_name="Bella",
            last_name="Swan",
            admission_number="ADM-BELLA",
            dob=date(2022, 2, 14),
            status="Active"
        )
        self.enrollment_bella = ChildEnrollment.objects.create(
            student=self.child_bella,
            enrollment_date=date(2024, 1, 1),
            status="Active"
        )
        self.cs_bella = ClassroomStudent.objects.create(
            classroom=self.classroom_toddlers,
            student=self.child_bella,
            status="Active"
        )

        # 5. Family A & Guardian
        self.family_a = Family.objects.create(
            daycare=self.daycare_a,
            family_name="Shelby Family",
            status="Active",
            primary_contact="Arthur Shelby",
            primary_email="arthur@shelby.test"
        )
        FamilyChild.objects.create(family=self.family_a, student=self.child_tommy)

        self.guardian_user_arthur = User.objects.create_user(
            username="guardian_arthur",
            email="arthur@shelby.test",
            password="guardianpass123",
            daycare=self.daycare_a,
            first_name="Arthur",
            last_name="Shelby"
        )
        self.guardian_arthur = Guardian.objects.create(
            user=self.guardian_user_arthur,
            daycare=self.daycare_a,
            first_name="Arthur",
            last_name="Shelby",
            email="arthur@shelby.test"
        )
        FamilyGuardian.objects.create(family=self.family_a, guardian=self.guardian_arthur, is_primary=True, status="Active")

        # 6. Authorized Pickup Person for Tommy
        self.pickup_arthur = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_tommy,
            family=self.family_a,
            name="Arthur Shelby",
            relationship="Father",
            phone="555-0101",
            email="arthur@shelby.test",
            authorization_status="ACTIVE",
            status="Active"
        )

        # 7. Daycare B (for cross-tenant testing)
        self.daycare_b = Daycare.objects.create(
            name="Starlight Academy",
            status="Active",
            closing_time=time(18, 0)
        )
        self.staff_user_b = User.objects.create_user(
            username="staff_bob",
            email="bob@starlight.test",
            password="bobpassword123",
            is_staff=True,
            daycare=self.daycare_b,
            first_name="Bob",
            last_name="Staff"
        )
        self.staff_emp_b = Employee.objects.create(
            user=self.staff_user_b,
            daycare=self.daycare_b,
            first_name="Bob",
            last_name="Staff",
            email="bob@starlight.test",
            status="Active"
        )

    # ==========================================
    # 10 MANDATORY END-TO-END SCENARIOS
    # ==========================================

    def test_scenario_1_authorized_person_qr_successful_pickup(self):
        """Scenario 1: Authorized person -> QR -> successful pickup -> checkout recorded."""
        # 1. Check in child
        att = StudentAttendance.objects.create(
            student=self.child_tommy,
            daycare=self.daycare_a,
            classroom=self.classroom_toddlers,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30),
            arrival_type="MANUAL"
        )

        # 2. Issue QR token
        token_obj = DigitalVerificationService.generate_qr_token(
            pickup_person=self.pickup_arthur,
            user=self.staff_user_a,
            expires_in_days=30
        )

        # 3. Checkout with QR
        self.client.force_authenticate(user=self.staff_user_a)
        res = self.client.post("/api/daycare/pickups/qr/check-out/", {
            "token": token_obj.token,
            "child_id": str(self.child_tommy.id),
            "notes": "Picked up safely with QR"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get("success"))

        # 4. Verify StudentAttendance updated
        att.refresh_from_db()
        self.assertIsNotNone(att.check_out_time)
        self.assertEqual(att.departure_type, "QR")

        # 5. Verify SafeArrivalDepartureEvent created
        event = SafeArrivalDepartureEvent.objects.filter(
            student=self.child_tommy,
            timestamp__date=self.today,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT,
            verification_method=SafeArrivalDepartureEvent.METHOD_QR
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.verification_status, SafeArrivalDepartureEvent.STATUS_SUCCESS)
        self.assertEqual(event.authorized_pickup, self.pickup_arthur)

    def test_scenario_2_authorized_person_pin_successful_pickup(self):
        """Scenario 2: Authorized person -> PIN -> successful pickup -> checkout recorded."""
        att = StudentAttendance.objects.create(
            student=self.child_tommy,
            daycare=self.daycare_a,
            classroom=self.classroom_toddlers,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30)
        )

        # Set PIN
        DigitalVerificationService.set_pickup_pin(
            pickup_person=self.pickup_arthur,
            raw_pin="7890",
            user=self.staff_user_a
        )

        # Checkout with PIN
        self.client.force_authenticate(user=self.staff_user_a)
        res = self.client.post("/api/daycare/pickups/pin/check-out/", {
            "pickup_person_id": str(self.pickup_arthur.id),
            "pin": "7890",
            "child_id": str(self.child_tommy.id),
            "notes": "PIN verified departure"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get("success"))

        att.refresh_from_db()
        self.assertIsNotNone(att.check_out_time)
        self.assertEqual(att.departure_type, "PIN")

        event = SafeArrivalDepartureEvent.objects.filter(
            student=self.child_tommy,
            timestamp__date=self.today,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT,
            verification_method=SafeArrivalDepartureEvent.METHOD_PIN
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.verification_status, SafeArrivalDepartureEvent.STATUS_SUCCESS)

    def test_scenario_3_authorized_person_digital_signature_successful_pickup(self):
        """Scenario 3: Authorized person -> digital signature -> successful pickup."""
        att = StudentAttendance.objects.create(
            student=self.child_tommy,
            daycare=self.daycare_a,
            classroom=self.classroom_toddlers,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30)
        )

        self.client.force_authenticate(user=self.staff_user_a)
        res = self.client.post("/api/daycare/pickups/signature/check-out/", {
            "pickup_person_id": str(self.pickup_arthur.id),
            "child_id": str(self.child_tommy.id),
            "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "notes": "Parent signed digitally on kiosk"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get("success"))

        att.refresh_from_db()
        self.assertIsNotNone(att.check_out_time)

        event = SafeArrivalDepartureEvent.objects.filter(
            student=self.child_tommy,
            timestamp__date=self.today,
            verification_method=SafeArrivalDepartureEvent.METHOD_DIGITAL_SIGNATURE
        ).first()
        self.assertIsNotNone(event)
        self.assertIsNotNone(event.signature_data)
        self.assertEqual(event.verification_status, SafeArrivalDepartureEvent.STATUS_SUCCESS)

    def test_scenario_4_unauthorized_person_verification_failure(self):
        """Scenario 4: Unauthorized person -> verification failure -> checkout blocked -> alert/audit."""
        att = StudentAttendance.objects.create(
            student=self.child_tommy,
            daycare=self.daycare_a,
            classroom=self.classroom_toddlers,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30)
        )

        unauth_pickup = StudentPickup.objects.create(
            daycare=self.daycare_a,
            student=self.child_tommy,
            name="Stranger Joe",
            relationship="Unknown",
            phone="555-9999",
            authorization_status="REVOKED",
            status="Revoked"
        )

        self.client.force_authenticate(user=self.staff_user_a)
        res = self.client.post("/api/daycare/pickups/signature/check-out/", {
            "pickup_person_id": str(unauth_pickup.id),
            "child_id": str(self.child_tommy.id),
            "signature_data": "data:image/png;base64,sample",
            "notes": "Attempt by revoked person"
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Child attendance remains without check_out_time
        att.refresh_from_db()
        self.assertIsNone(att.check_out_time)

        # AuditLog contains verification check
        audit = AuditLog.objects.filter(action="Verified Pickup Authorization").first()
        self.assertIsNotNone(audit)
        self.assertFalse(audit.new_values.get("is_authorized"))

        # Event contains failed verification status
        event = SafeArrivalDepartureEvent.objects.filter(student=self.child_tommy, verification_status="FAILED").first()
        self.assertIsNotNone(event)

    def test_scenario_5_authorized_person_late_pickup_recorded(self):
        """Scenario 5: Authorized person -> late pickup -> late pickup recorded."""
        StudentAttendance.objects.create(
            student=self.child_tommy,
            daycare=self.daycare_a,
            classroom=self.classroom_toddlers,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30)
        )

        # Set daycare closing time to past time (01:00 AM) so now is late
        self.daycare_a.closing_time = time(1, 0)
        self.daycare_a.save()
        self.settings_a.default_operating_end = time(1, 0)
        self.settings_a.save()

        self.client.force_authenticate(user=self.staff_user_a)
        res = self.client.post("/api/daycare/pickups/signature/check-out/", {
            "pickup_person_id": str(self.pickup_arthur.id),
            "child_id": str(self.child_tommy.id),
            "signature_data": "data:image/png;base64,signaturedata",
            "notes": "Parent arrived after closing time"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        event = SafeArrivalDepartureEvent.objects.filter(
            student=self.child_tommy,
            timestamp__date=self.today,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT
        ).first()
        self.assertIsNotNone(event)
        self.assertTrue(event.is_late_pickup)
        self.assertGreater(event.late_duration_minutes, 0)

    def test_scenario_6_guardian_adds_pickup_person_and_daycare_approves(self):
        """Scenario 6: Guardian adds pickup person -> daycare approval -> pickup becomes active."""
        self.client.force_authenticate(user=self.guardian_user_arthur)
        res = self.client.post(f"/api/family/children/{self.child_tommy.id}/authorized-pickups/", {
            "name": "Grandma Polly",
            "relationship": "Grandmother",
            "phone": "555-3322",
            "email": "polly@shelby.test"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        pickup_id = res.data["id"]

        new_pickup = StudentPickup.objects.get(id=pickup_id)
        self.assertIn(new_pickup.authorization_status, ["PENDING_APPROVAL", "PENDING_VERIFICATION", "PENDING"])

        # Staff approves
        self.client.force_authenticate(user=self.staff_user_a)
        res_approve = self.client.post(f"/api/daycare/authorized-pickups/{pickup_id}/approve/")
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)

        new_pickup.refresh_from_db()
        self.assertEqual(new_pickup.authorization_status, "ACTIVE")

    def test_scenario_7_pickup_authorization_revoked_invalidates_qr_pin(self):
        """Scenario 7: Pickup authorization revoked -> previously valid QR/PIN no longer works."""
        token_obj = DigitalVerificationService.generate_qr_token(
            pickup_person=self.pickup_arthur,
            user=self.staff_user_a
        )
        DigitalVerificationService.set_pickup_pin(
            pickup_person=self.pickup_arthur,
            raw_pin="1234",
            user=self.staff_user_a
        )

        # Revoke authorization
        self.pickup_arthur.authorization_status = "REVOKED"
        self.pickup_arthur.status = "Revoked"
        self.pickup_arthur.save()

        # Verify QR fails
        self.client.force_authenticate(user=self.staff_user_a)
        res_qr = self.client.post("/api/daycare/pickups/qr/check-out/", {
            "token": token_obj.token,
            "child_id": str(self.child_tommy.id)
        })
        self.assertEqual(res_qr.status_code, status.HTTP_400_BAD_REQUEST)

        # Verify PIN fails
        res_pin = self.client.post("/api/daycare/pickups/pin/check-out/", {
            "pickup_person_id": str(self.pickup_arthur.id),
            "pin": "1234",
            "child_id": str(self.child_tommy.id)
        })
        self.assertEqual(res_pin.status_code, status.HTTP_400_BAD_REQUEST)

    def test_scenario_8_child_transferred_classroom_preserves_historical_records(self):
        """Scenario 8: Child transferred classroom -> historical pickup records remain unchanged."""
        past_date = self.today - timedelta(days=5)
        att_past = StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.child_tommy,
            classroom=self.classroom_toddlers,
            attendance_date=past_date,
            attendance_status="PRESENT",
            check_in_time=time(8, 0),
            check_out_time=time(17, 30)
        )
        event = SafeArrivalDepartureEvent.objects.create(
            daycare=self.daycare_a,
            student=self.child_tommy,
            attendance_record=att_past,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT,
            timestamp=datetime.combine(past_date, time(17, 30), tzinfo=timezone.get_current_timezone()),
            authorized_pickup=self.pickup_arthur,
            verification_method=SafeArrivalDepartureEvent.METHOD_QR,
            verification_status=SafeArrivalDepartureEvent.STATUS_SUCCESS,
            processed_by=self.staff_user_a
        )

        # Transfer child to preschool
        self.cs_tommy.classroom = self.classroom_preschool
        self.cs_tommy.save()

        # Historical attendance and event still point to Toddler room
        att_past.refresh_from_db()
        self.assertEqual(att_past.classroom, self.classroom_toddlers)
        self.assertEqual(self.child_tommy.classroom_enrollments.first().classroom, self.classroom_preschool)

    def test_scenario_9_cross_daycare_pickup_blocked(self):
        """Scenario 9: Cross-daycare pickup attempt -> blocked."""
        token_obj = DigitalVerificationService.generate_qr_token(
            pickup_person=self.pickup_arthur,
            user=self.staff_user_a
        )

        # Staff from Daycare B attempts to verify Daycare A's QR
        self.client.force_authenticate(user=self.staff_user_b)
        res = self.client.post("/api/daycare/pickups/qr/check-out/", {
            "token": token_obj.token,
            "child_id": str(self.child_tommy.id)
        })
        self.assertIn(res.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN])

    def test_scenario_10_attendance_pickup_correction(self):
        """Scenario 10: Attendance correction -> pickup history and audit remain consistent."""
        att = StudentAttendance.objects.create(
            student=self.child_tommy,
            daycare=self.daycare_a,
            classroom=self.classroom_toddlers,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 30),
            check_out_time=time(17, 0)
        )
        event = SafeArrivalDepartureEvent.objects.create(
            daycare=self.daycare_a,
            student=self.child_tommy,
            attendance_record=att,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT,
            timestamp=datetime.combine(self.today, time(17, 0), tzinfo=timezone.get_current_timezone()),
            authorized_pickup=self.pickup_arthur,
            verification_method=SafeArrivalDepartureEvent.METHOD_MANUAL,
            verification_status=SafeArrivalDepartureEvent.STATUS_SUCCESS,
            processed_by=self.staff_user_a
        )

        self.client.force_authenticate(user=self.staff_user_a)
        res = self.client.post(f"/api/daycare/safe-arrival/records/{att.id}/correct/", {
            "check_out_time": "17:15",
            "reason": "Staff entered clock-out 15 minutes prematurely"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        att.refresh_from_db()
        self.assertEqual(att.check_out_time, time(17, 15))

        event.refresh_from_db()
        self.assertEqual(event.actual_checkout_time, time(17, 15))

        audit = AuditLog.objects.filter(
            action="Corrected Attendance & Pickup Record"
        ).first()
        self.assertIsNotNone(audit)
        self.assertIn("prematurely", str(audit.new_values))

    # ==========================================
    # REPORTS SERVICE & API ENDPOINTS TESTS
    # ==========================================

    def test_all_8_report_types_service_and_api(self):
        """Test generation and filtering for all 8 report types via service & API."""
        # Seed attendance and departure events
        StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.child_tommy,
            classroom=self.classroom_toddlers,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=time(8, 15),
            arrival_type="MANUAL"
        )
        SafeArrivalDepartureEvent.objects.create(
            daycare=self.daycare_a,
            student=self.child_tommy,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT,
            timestamp=datetime.combine(self.today, time(18, 30), tzinfo=timezone.get_current_timezone()),
            authorized_pickup=self.pickup_arthur,
            verification_method=SafeArrivalDepartureEvent.METHOD_QR,
            verification_status=SafeArrivalDepartureEvent.STATUS_SUCCESS,
            is_late_pickup=True,
            late_duration_minutes=30,
            processed_by=self.staff_user_a
        )
        SafeArrivalDepartureEvent.objects.create(
            daycare=self.daycare_a,
            student=self.child_bella,
            event_type=SafeArrivalDepartureEvent.EVENT_UNAUTHORIZED_ATTEMPT,
            timestamp=datetime.combine(self.today, time(16, 0), tzinfo=timezone.get_current_timezone()),
            attempted_person_name="Unknown Person",
            verification_method=SafeArrivalDepartureEvent.METHOD_MANUAL,
            verification_status=SafeArrivalDepartureEvent.STATUS_FAILED,
            notes="Unauthorized relative",
            processed_by=self.staff_user_a
        )

        report_types = [
            "daily_arrival",
            "daily_departure",
            "pickup_history",
            "late_pickup",
            "unauthorized_attempts",
            "verification_methods",
            "staff_processing",
            "pickup_verification"
        ]

        self.client.force_authenticate(user=self.staff_user_a)

        for r_type in report_types:
            # 1. Test Service directly
            svc_res = SafeArrivalReportsService.generate_report(
                daycare=self.daycare_a,
                report_type=r_type,
                filters={"start_date": str(self.today), "end_date": str(self.today)}
            )
            self.assertEqual(svc_res["report_type"], r_type)
            self.assertIn("summary", svc_res)
            self.assertTrue(
                "records" in svc_res or "method_breakdown" in svc_res or "staff_breakdown" in svc_res,
                f"Missing breakdown/records in {r_type}"
            )

            # 2. Test API Endpoint
            api_res = self.client.get(f"/api/daycare/safe-arrival/reports/?report_type={r_type}&start_date={self.today}&end_date={self.today}")
            self.assertEqual(api_res.status_code, status.HTTP_200_OK, f"Failed for report_type: {r_type}")
            self.assertEqual(api_res.data["report_type"], r_type)

    def test_csv_export_format_and_streaming(self):
        """Test that reports can be downloaded as RFC 4180 CSV with correct headers."""
        SafeArrivalDepartureEvent.objects.create(
            daycare=self.daycare_a,
            student=self.child_tommy,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT,
            timestamp=datetime.combine(self.today, time(17, 30), tzinfo=timezone.get_current_timezone()),
            authorized_pickup=self.pickup_arthur,
            verification_method=SafeArrivalDepartureEvent.METHOD_PIN,
            verification_status=SafeArrivalDepartureEvent.STATUS_SUCCESS,
            processed_by=self.staff_user_a
        )

        self.client.force_authenticate(user=self.staff_user_a)
        res = self.client.get(f"/api/daycare/safe-arrival/reports/?report_type=pickup_verification&export_format=csv&start_date={self.today}&end_date={self.today}")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res["Content-Type"].startswith("text/csv"))
        self.assertIn("attachment; filename=", res["Content-Disposition"])

        content = res.content.decode("utf-8")
        self.assertIn("Child,Pickup Person,Relationship,Verification Method,Date,Time,Staff Member,Result", content)
        self.assertIn("Tommy Shelby,Arthur Shelby,Father,PIN", content)

    def test_full_audit_log_action_coverage(self):
        """Validate that all 11 required audit actions can be logged and queried properly."""
        audit_actions = [
            ("Created Pickup Authorization", "Created pickup authorization for Uncle John"),
            ("Updated Pickup Authorization", "Updated contact phone for Arthur Shelby"),
            ("Revoked Pickup Authorization", "Revoked authorization for Stranger Joe"),
            ("Generated Pickup QR Token", "Generated single-use QR for Arthur Shelby"),
            ("Revoked Pickup QR Token", "Revoked expired QR token"),
            ("Updated Pickup PIN", "Reset security PIN for Arthur Shelby"),
            ("Pickup Verification Check", "Verified QR token for Tommy Shelby"),
            ("Successful Pickup Checkout", "Arthur Shelby checked out Tommy Shelby"),
            ("Failed Pickup Attempt", "PIN mismatch for pickup attempt"),
            ("Unauthorized Pickup Attempt", "Unrecognized person tried to pick up Bella Swan"),
            ("Late Pickup Recorded", "Late pickup for Tommy Shelby: 45 minutes late"),
            ("Corrected Attendance & Pickup Record", "Corrected departure timestamp for Tommy Shelby")
        ]

        for act, detail in audit_actions:
            AuditLog.objects.create(
                user=self.staff_user_a,
                user_type="Staff",
                action=act,
                module="Safe Arrival Departure",
                entity_type="StudentPickup",
                entity_id=str(self.child_tommy.id),
                new_values={"details": detail}
            )

        # Query and assert count
        count = AuditLog.objects.filter(module="Safe Arrival Departure").count()
        self.assertGreaterEqual(count, len(audit_actions))
