import uuid
from datetime import date, time, datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import (
    Daycare, Branch, Classroom, Student, StudentAttendance, StudentPickup,
    Employee, StaffNotification, AuditLog, DaycareSettings, ChildEnrollment,
    PickupQRToken, PickupSecurityPIN, SafeArrivalDepartureEvent
)
from daycare.services.digital_verification import DigitalVerificationService
from daycare.services.safe_arrival import SafeArrivalService
from daycare.services.pickup import PickupVerificationService

User = get_user_model()


class PickupPhase3LateAndExceptionsTests(APITestCase):
    def setUp(self):
        # 1. Daycare Setup
        self.daycare = Daycare.objects.create(
            name="Sunshine Early Learning Center",
            status="Active",
            closing_time=time(17, 0)  # 5:00 PM closing
        )
        self.settings = DaycareSettings.objects.create(
            daycare=self.daycare,
            timezone="America/Toronto",
            date_format="YYYY-MM-DD",
            time_format="HH:mm",
            currency="CAD",
            default_language="en",
            week_start_day="Monday",
            default_operating_start=time(7, 30),
            default_operating_end=time(17, 30),
            allow_parent_notifications=True,
            allow_staff_notifications=True,
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        # 2. Staff User
        self.staff_user = User.objects.create_user(
            username="staff_sarah",
            email="sarah@sunshine.test",
            password="Password123!",
            first_name="Sarah",
            last_name="Jenkins",
            daycare=self.daycare,
            is_staff=True
        )
        self.staff_emp = Employee.objects.create(
            user=self.staff_user,
            daycare=self.daycare,
            first_name="Sarah",
            last_name="Jenkins",
            email="sarah@sunshine.test",
            status="Active"
        )

        # 3. Children
        self.child1 = Student.objects.create(
            daycare=self.daycare,
            first_name="Leo",
            last_name="Miller",
            admission_number="KID-001",
            status="Active",
            admission_date=date(2026, 1, 1)
        )
        self.child2 = Student.objects.create(
            daycare=self.daycare,
            first_name="Mia",
            last_name="Miller",
            admission_number="KID-002",
            status="Active",
            admission_date=date(2026, 1, 1)
        )

        ChildEnrollment.objects.create(student=self.child1, status="Active", start_date=date(2026, 1, 1))
        ChildEnrollment.objects.create(student=self.child2, status="Active", start_date=date(2026, 1, 1))

        # 4. Authorized Pickups
        self.pickup_grandma = StudentPickup.objects.create(
            daycare=self.daycare,
            student=self.child1,
            name="Grandma Evelyn Miller",
            relationship="Grandmother",
            phone="555-0199",
            authorization_status=StudentPickup.STATUS_ACTIVE
        )
        self.pickup_uncle_revoked = StudentPickup.objects.create(
            daycare=self.daycare,
            student=self.child1,
            name="Uncle Robert",
            relationship="Uncle",
            phone="555-0188",
            authorization_status=StudentPickup.STATUS_REVOKED
        )

        # 5. QR Token and PIN setup for Grandma
        self.qr_token = DigitalVerificationService.generate_qr_token(
            pickup_person=self.pickup_grandma,
            user=self.staff_user
        )
        DigitalVerificationService.set_pickup_pin(
            pickup_person=self.pickup_grandma,
            raw_pin="5432",
            user=self.staff_user
        )

        # 6. Secondary Daycare for Multi-Tenant Tests
        self.daycare2 = Daycare.objects.create(
            name="Oakridge Childcare",
            status="Active",
            closing_time=time(18, 0)
        )
        self.child_other = Student.objects.create(
            daycare=self.daycare2,
            first_name="Tommy",
            last_name="Other",
            admission_number="KID-999",
            status="Active"
        )
        ChildEnrollment.objects.create(student=self.child_other, status="Active", start_date=date(2026, 1, 1))

        self.staff_other = User.objects.create_user(
            username="staff_other",
            email="other@oakridge.test",
            password="Password123!",
            daycare=self.daycare2,
            is_staff=True
        )

    # =========================================================================
    # PART A – EXPECTED PICKUP TIME TESTS
    # =========================================================================

    def test_01_expected_pickup_time_resolution(self):
        """01. Resolves expected pickup time based on daycare closing time, settings, or fallback"""
        # Daycare closing_time is 17:00
        exp_time = DigitalVerificationService.get_expected_pickup_time(self.daycare, self.child1)
        self.assertEqual(exp_time, time(17, 0))

        # If daycare closing_time is None, falls back to DaycareSettings default_operating_end (17:30)
        self.daycare.closing_time = None
        self.daycare.save()
        exp_time_settings = DigitalVerificationService.get_expected_pickup_time(self.daycare, self.child1)
        self.assertEqual(exp_time_settings, time(17, 30))

        # If child's attendance record has custom expected_departure_time (e.g. 15:30), it takes top precedence
        today = timezone.now().date()
        StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child1,
            attendance_date=today,
            expected_departure_time=time(15, 30)
        )
        exp_time_child_custom = DigitalVerificationService.get_expected_pickup_time(self.daycare, self.child1, attendance_date=today)
        self.assertEqual(exp_time_child_custom, time(15, 30))

    # =========================================================================
    # PART B – LATE PICKUP TESTS
    # =========================================================================

    def test_02_on_time_departure_checkout(self):
        """02. Checkout before or at expected pickup time is flagged as on-time"""
        self.client.force_authenticate(user=self.staff_user)

        # Check-in child first
        checkin_resp = self.client.post('/api/daycare/pickups/qr/check-in/', {
            'token': self.qr_token.token,
            'child_id': str(self.child1.id)
        })
        self.assertEqual(checkin_resp.status_code, status.HTTP_200_OK)

        # Execute checkout
        resp = self.client.post('/api/daycare/pickups/qr/check-out/', {
            'token': self.qr_token.token,
            'child_id': str(self.child1.id)
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        
        # Verify event
        event = SafeArrivalDepartureEvent.objects.get(id=resp.data['event_id'])
        self.assertEqual(event.event_type, SafeArrivalDepartureEvent.EVENT_CHECK_OUT)
        self.assertEqual(event.verification_status, SafeArrivalDepartureEvent.STATUS_SUCCESS)
        self.assertIsNotNone(event.expected_pickup_time)
        self.assertIsNotNone(event.actual_checkout_time)
        self.assertEqual(event.processed_by, self.staff_user)

    def test_03_late_pickup_detection_and_calculation(self):
        """03. Checkout past expected pickup time marks LATE_PICKUP and computes duration late"""
        self.client.force_authenticate(user=self.staff_user)

        # Create attendance with expected departure in past (e.g. 10:00 AM)
        today = timezone.now().date()
        att = StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child1,
            attendance_date=today,
            check_in_time=time(8, 0),
            expected_departure_time=time(10, 0),
            attendance_status="PRESENT"
        )

        # Process checkout via PIN
        resp = self.client.post('/api/daycare/pickups/pin/check-out/', {
            'pickup_person_id': str(self.pickup_grandma.id),
            'pin': '5432',
            'child_id': str(self.child1.id)
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['is_late_pickup'])
        self.assertGreater(resp.data['late_duration_minutes'], 0)

        # Verify event record in database
        event = SafeArrivalDepartureEvent.objects.get(id=resp.data['event_id'])
        self.assertTrue(event.is_late_pickup)
        self.assertEqual(event.expected_pickup_time, time(10, 0))
        self.assertGreater(event.late_duration_minutes, 0)
        self.assertEqual(event.processed_by, self.staff_user)

        # Ensure attendance checkout data was updated without data destruction
        att.refresh_from_db()
        self.assertIsNotNone(att.check_out_time)
        self.assertEqual(att.departure_type, "PIN")
        self.assertEqual(att.pickup_person, self.pickup_grandma)
        self.assertTrue(att.is_late)

    # =========================================================================
    # PART C & D – UNAUTHORIZED PICKUP AND ALERT TESTS
    # =========================================================================

    def test_04_unauthorized_pickup_attempt_blocks_checkout_and_records_event(self):
        """04. Block checkout for unauthorized person, records UNAUTHORIZED_ATTEMPT with failure reason"""
        self.client.force_authenticate(user=self.staff_user)

        # Try to checkout with revoked Uncle Robert via PIN
        DigitalVerificationService.set_pickup_pin(
            pickup_person=self.pickup_uncle_revoked,
            raw_pin="9999",
            user=self.staff_user
        )

        resp = self.client.post('/api/daycare/pickups/pin/check-out/', {
            'pickup_person_id': str(self.pickup_uncle_revoked.id),
            'pin': '9999',
            'child_id': str(self.child1.id)
        })

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("unauthorized", str(resp.data).lower())

        # Verify unauthorized attempt event was recorded
        event = SafeArrivalDepartureEvent.objects.filter(
            daycare=self.daycare,
            student=self.child1,
            verification_status=SafeArrivalDepartureEvent.STATUS_FAILED
        ).first()

        self.assertIsNotNone(event)
        self.assertEqual(event.event_type, SafeArrivalDepartureEvent.EVENT_UNAUTHORIZED_ATTEMPT)
        self.assertEqual(event.attempted_person_name, "Uncle Robert")
        self.assertIn("revoked", event.failure_reason.lower())
        self.assertEqual(event.processed_by, self.staff_user)

    def test_05_unauthorized_pickup_attempt_dispatches_security_alert(self):
        """05. Unauthorized attempt generates StaffNotification alert for authorized daycare staff"""
        self.client.force_authenticate(user=self.staff_user)

        # Count prior notifications
        prior_notifs = StaffNotification.objects.filter(
            daycare=self.daycare,
            notification_type="unauthorized_pickup_attempt"
        ).count()

        # Trigger unauthorized checkout attempt with revoked Uncle Robert
        DigitalVerificationService.set_pickup_pin(
            pickup_person=self.pickup_uncle_revoked,
            raw_pin="1234",
            user=self.staff_user
        )

        self.client.post('/api/daycare/pickups/pin/check-out/', {
            'pickup_person_id': str(self.pickup_uncle_revoked.id),
            'pin': '1234',
            'child_id': str(self.child1.id)
        })

        # Verify new notification was dispatched to staff
        new_notifs = StaffNotification.objects.filter(
            daycare=self.daycare,
            notification_type="unauthorized_pickup_attempt"
        )
        self.assertGreater(new_notifs.count(), prior_notifs)
        latest_notif = new_notifs.first()
        self.assertEqual(latest_notif.title, "UNAUTHORIZED PICKUP ATTEMPT")
        self.assertIn("Leo Miller", latest_notif.message)
        self.assertIn("Action Required", latest_notif.message)

    # =========================================================================
    # PART E – STAFF PROCESSING CONTEXT TESTS
    # =========================================================================

    def test_06_authenticated_backend_user_recorded_as_processed_by(self):
        """06. All successful and failed pickups record authenticated request.user backend context"""
        self.client.force_authenticate(user=self.staff_user)

        resp = self.client.post('/api/daycare/pickups/signature/check-out/', {
            'pickup_person_id': str(self.pickup_grandma.id),
            'signature_data': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
            'child_id': str(self.child1.id)
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        event = SafeArrivalDepartureEvent.objects.get(id=resp.data['event_id'])
        self.assertEqual(event.processed_by, self.staff_user)
        self.assertEqual(resp.data['processed_by']['id'], str(self.staff_user.id))
        self.assertEqual(resp.data['processed_by']['name'], "Sarah Jenkins")

    # =========================================================================
    # PART F – PICKUP HISTORY TESTS
    # =========================================================================

    def test_07_child_pickup_history_endpoint(self):
        """07. GET /api/daycare/children/{child_id}/pickup-history/ returns full chronological timeline"""
        self.client.force_authenticate(user=self.staff_user)

        # Create arrival and departure events
        self.client.post('/api/daycare/pickups/qr/check-in/', {
            'token': self.qr_token.token,
            'child_id': str(self.child1.id)
        })
        self.client.post('/api/daycare/pickups/qr/check-out/', {
            'token': self.qr_token.token,
            'child_id': str(self.child1.id)
        })

        resp = self.client.get(f'/api/daycare/children/{self.child1.id}/pickup-history/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['child']['name'], "Leo Miller")
        self.assertGreaterEqual(len(resp.data['history']), 2)

        first_item = resp.data['history'][0]
        self.assertIn('date', first_item)
        self.assertIn('time', first_item)
        self.assertIn('verification_method', first_item)
        self.assertIn('processed_by', first_item)
        self.assertIn('is_late_pickup', first_item)

    # =========================================================================
    # PART G – DAILY SAFE ARRIVAL DASHBOARD TESTS
    # =========================================================================

    def test_08_safe_arrival_dashboard_kpis_and_roster(self):
        """08. GET /api/daycare/safe-arrival/dashboard/ returns accurate KPI counts and child roster"""
        self.client.force_authenticate(user=self.staff_user)

        today = timezone.now().date()

        # Child 1 is checked in and currently present
        StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child1,
            attendance_date=today,
            check_in_time=time(8, 30),
            attendance_status="PRESENT"
        )

        resp = self.client.get(f'/api/daycare/safe-arrival/dashboard/?date={today.isoformat()}')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        summary = resp.data['summary']
        self.assertEqual(summary['children_expected'], 2)  # child1 and child2
        self.assertEqual(summary['children_checked_in'], 1)  # child1
        self.assertEqual(summary['children_not_arrived'], 1)  # child2
        self.assertEqual(summary['children_currently_present'], 1)  # child1
        self.assertEqual(summary['children_checked_out'], 0)

        # Verify roster entries
        self.assertEqual(len(resp.data['roster']), 2)
        child1_entry = next(r for r in resp.data['roster'] if r['child_id'] == str(self.child1.id))
        self.assertEqual(child1_entry['status'], "PRESENT")
        self.assertEqual(child1_entry['check_in_time'], "08:30:00")

    # =========================================================================
    # PART H – EXCEPTION MANAGEMENT TESTS
    # =========================================================================

    def test_09_pickup_exceptions_list_filtering(self):
        """09. GET /api/daycare/pickups/exceptions/ returns unauthorized attempts and late pickups"""
        self.client.force_authenticate(user=self.staff_user)

        DigitalVerificationService.set_pickup_pin(
            pickup_person=self.pickup_uncle_revoked,
            raw_pin="1111",
            user=self.staff_user
        )

        # Trigger an unauthorized attempt
        self.client.post('/api/daycare/pickups/pin/check-out/', {
            'pickup_person_id': str(self.pickup_uncle_revoked.id),
            'pin': '1111',
            'child_id': str(self.child1.id)
        })

        resp = self.client.get('/api/daycare/pickups/exceptions/?type=unauthorized')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['category'], "UNAUTHORIZED_ATTEMPT")

    # =========================================================================
    # CROSS-DAYCARE TENANT ISOLATION TESTS
    # =========================================================================

    def test_10_cross_daycare_access_forbidden(self):
        """10. Cannot view or process pickups for another daycare's child"""
        self.client.force_authenticate(user=self.staff_user)

        # Attempt to access child from daycare 2
        resp = self.client.get(f'/api/daycare/children/{self.child_other.id}/pickup-history/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
