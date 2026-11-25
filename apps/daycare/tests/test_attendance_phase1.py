import uuid
from datetime import date, time, timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import (
    User, Daycare, Branch, Student, ChildEnrollment, Classroom,
    ClassroomStudent, StudentAttendance, StudentPickup, Employee, AuditLog
)


class AttendancePhase1Tests(APITestCase):
    def setUp(self):
        # 1. Create Daycare A
        self.daycare_a = Daycare.objects.create(
            name="Sunshine Academy",
            status="Active",
            opening_time=time(8, 30),
            closing_time=time(17, 30)
        )
        self.branch_a = Branch.objects.create(
            daycare=self.daycare_a,
            name="Main Branch"
        )
        self.admin_a = User.objects.create_user(
            email='admin_a@sunshine.com',
            username='admin_a',
            password='password123',
            is_staff=True,
            daycare=self.daycare_a
        )
        self.emp_a = Employee.objects.create(
            daycare=self.daycare_a,
            user=self.admin_a,
            first_name="Admin",
            last_name="Staff",
            role="Staff",
            status="Active"
        )

        # 2. Create Daycare B (for cross-tenant tests)
        self.daycare_b = Daycare.objects.create(
            name="Little Stars",
            status="Active",
            opening_time=time(8, 0),
            closing_time=time(18, 0)
        )
        self.branch_b = Branch.objects.create(
            daycare=self.daycare_b,
            name="West Branch"
        )
        self.admin_b = User.objects.create_user(
            email='admin_b@littlestars.com',
            username='admin_b',
            password='password123',
            is_staff=True,
            daycare=self.daycare_b
        )

        # 3. Classrooms
        self.classroom_infants = Classroom.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            room_name="Infants Room",
            room_code="INF-01",
            capacity=10,
            status="Active"
        )
        self.classroom_toddlers = Classroom.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            room_name="Toddlers Room",
            room_code="TOD-01",
            capacity=15,
            status="Active"
        )
        self.classroom_b = Classroom.objects.create(
            daycare=self.daycare_b,
            branch=self.branch_b,
            room_name="Daycare B Room",
            room_code="B-01",
            capacity=12,
            status="Active"
        )

        # 4. Children
        self.child_active = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            first_name="Emma",
            last_name="Watson",
            admission_number="ADM-001",
            status="Active"
        )
        self.enrollment_active = ChildEnrollment.objects.create(
            student=self.child_active,
            status="Active",
            start_date=date(2026, 1, 1)
        )
        self.assignment_infants = ClassroomStudent.objects.create(
            student=self.child_active,
            classroom=self.classroom_infants,
            status="Active",
            start_date=date(2026, 1, 1)
        )

        # Inactive child
        self.child_inactive = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            first_name="Noah",
            last_name="Inactive",
            admission_number="ADM-002",
            status="Withdrawn"
        )

        # Daycare B child
        self.child_b = Student.objects.create(
            daycare=self.daycare_b,
            branch=self.branch_b,
            first_name="Liam",
            last_name="Miller",
            admission_number="ADM-B01",
            status="Active"
        )

        # Authorized Pickup
        self.pickup_person = StudentPickup.objects.create(
            student=self.child_active,
            name="Grandma Watson",
            relationship="Grandmother",
            phone="555-123-4567"
        )

        self.today = timezone.now().date()

    # 1. Successful Check-In
    def test_successful_check_in(self):
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_in_time": "08:15:00",
            "remarks": "Arrived cheerful with mom"
        }
        response = self.client.post('/api/daycare/attendance/check-in/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['attendance_status'], 'PRESENT')
        self.assertEqual(response.data['check_in_time'], '08:15:00')
        self.assertFalse(response.data['is_late'])
        self.assertEqual(str(response.data['classroom']), str(self.classroom_infants.id))

        # Check DB record
        record = StudentAttendance.objects.get(student=self.child_active, attendance_date=self.today)
        self.assertEqual(record.received_by, self.emp_a)
        self.assertEqual(record.created_by, self.admin_a)

        # Check Audit Log
        log = AuditLog.objects.filter(entity_id=str(record.id), action="CHILD_CHECK_IN").first()
        self.assertIsNotNone(log)

    # 2. Duplicate Check-In Prevention
    def test_duplicate_check_in_prevention(self):
        self.client.force_authenticate(user=self.admin_a)
        # First check-in
        self.client.post('/api/daycare/attendance/check-in/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_in_time": "08:15:00"
        })

        # Second check-in attempt on the same day
        response = self.client.post('/api/daycare/attendance/check-in/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_in_time": "08:30:00"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already checked in", str(response.data))

    # 3. Successful Check-Out
    def test_successful_check_out(self):
        self.client.force_authenticate(user=self.admin_a)
        # Check in first
        self.client.post('/api/daycare/attendance/check-in/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_in_time": "08:15:00"
        })

        # Check out
        checkout_payload = {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_out_time": "17:45:00",
            "pickup_person_id": str(self.pickup_person.id),
            "remarks": "Picked up by grandmother"
        }
        response = self.client.post('/api/daycare/attendance/check-out/', checkout_payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['check_out_time'], '17:45:00')
        self.assertFalse(response.data['is_early_pickup'])
        self.assertEqual(str(response.data['pickup_person']), str(self.pickup_person.id))

        # Check DB
        record = StudentAttendance.objects.get(student=self.child_active, attendance_date=self.today)
        self.assertEqual(record.released_by, self.emp_a)

    # 4. Check-Out Without Check-In Blocked
    def test_checkout_without_check_in_blocked(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post('/api/daycare/attendance/check-out/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_out_time": "17:00:00"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not been checked in", str(response.data))

    # 5. Check-Out Before Check-In Blocked
    def test_checkout_before_check_in_blocked(self):
        self.client.force_authenticate(user=self.admin_a)
        self.client.post('/api/daycare/attendance/check-in/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_in_time": "09:00:00"
        })

        response = self.client.post('/api/daycare/attendance/check-out/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_out_time": "08:30:00"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be earlier than check-in time", str(response.data))

    # 6. Duplicate Check-Out Blocked
    def test_duplicate_checkout_blocked(self):
        self.client.force_authenticate(user=self.admin_a)
        self.client.post('/api/daycare/attendance/check-in/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_in_time": "08:15:00"
        })
        self.client.post('/api/daycare/attendance/check-out/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_out_time": "17:00:00"
        })

        # Second checkout attempt
        response = self.client.post('/api/daycare/attendance/check-out/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_out_time": "17:15:00"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already checked out", str(response.data))

    # 7. Late Arrival Identification
    def test_late_arrival_detection(self):
        self.client.force_authenticate(user=self.admin_a)
        # Daycare opening_time is 08:30. Check in at 09:15.
        response = self.client.post('/api/daycare/attendance/check-in/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_in_time": "09:15:00",
            "late_reason": "Doctor appointment"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['is_late'])
        self.assertEqual(response.data['attendance_status'], 'LATE')
        self.assertEqual(response.data['arrival_type'], 'LATE')
        self.assertEqual(response.data['late_reason'], 'Doctor appointment')

    # 8. Early Pickup Identification
    def test_early_pickup_detection(self):
        self.client.force_authenticate(user=self.admin_a)
        # Daycare closing_time is 17:30. Check out at 14:00.
        self.client.post('/api/daycare/attendance/check-in/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_in_time": "08:15:00"
        })
        response = self.client.post('/api/daycare/attendance/check-out/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_out_time": "14:00:00",
            "early_pickup_reason": "Family trip"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_early_pickup'])
        self.assertEqual(response.data['departure_type'], 'EARLY_PICKUP')
        self.assertEqual(response.data['early_pickup_reason'], 'Family trip')

    # 9. Cross-Daycare Access Blocked (Tenant Isolation)
    def test_cross_daycare_tenant_isolation(self):
        # Admin A cannot check in Daycare B's child
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post('/api/daycare/attendance/check-in/', {
            "student_id": str(self.child_b.id),
            "date": str(self.today),
            "check_in_time": "08:15:00"
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Admin A cannot view Daycare B child's attendance history
        response = self.client.get(f'/api/daycare/children/{self.child_b.id}/attendance/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 10. Inactive Child Check-In Blocked
    def test_inactive_child_check_in_blocked(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post('/api/daycare/attendance/check-in/', {
            "student_id": str(self.child_inactive.id),
            "date": str(self.today),
            "check_in_time": "08:15:00"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive or withdrawn", str(response.data))

    # 11. Historical Classroom Preservation
    def test_historical_classroom_preservation(self):
        self.client.force_authenticate(user=self.admin_a)
        past_date = date(2026, 2, 1)

        # Record attendance in Infants Room on 2026-02-01
        self.client.post('/api/daycare/attendance/check-in/', {
            "student_id": str(self.child_active.id),
            "date": str(past_date),
            "check_in_time": "08:15:00"
        })
        att_record = StudentAttendance.objects.get(student=self.child_active, attendance_date=past_date)
        self.assertEqual(att_record.classroom, self.classroom_infants)

        # Later, child graduates to Toddlers Room
        self.assignment_infants.status = 'Ended'
        self.assignment_infants.end_date = date(2026, 2, 15)
        self.assignment_infants.save()

        ClassroomStudent.objects.create(
            student=self.child_active,
            classroom=self.classroom_toddlers,
            status="Active",
            start_date=date(2026, 2, 16)
        )

        # Query past roster: should preserve Infants Room
        past_roster = self.client.get(f'/api/daycare/attendance/daily/?date={past_date}')
        self.assertEqual(past_roster.status_code, status.HTTP_200_OK)
        child_item = next(r for r in past_roster.data['roster'] if r['student_id'] == str(self.child_active.id))
        self.assertEqual(child_item['classroom']['room_name'], "Infants Room")

        # Query today roster: should show Toddlers Room
        today_roster = self.client.get(f'/api/daycare/attendance/daily/?date={self.today}')
        self.assertEqual(today_roster.status_code, status.HTTP_200_OK)
        child_item_today = next(r for r in today_roster.data['roster'] if r['student_id'] == str(self.child_active.id))
        self.assertEqual(child_item_today['classroom']['room_name'], "Toddlers Room")

    # 12. Mark Absent and Excused Absence
    def test_mark_absent_and_excused(self):
        self.client.force_authenticate(user=self.admin_a)

        # Mark Absent
        response = self.client.post('/api/daycare/attendance/mark-absent/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "remarks": "Parent called in sick with flu"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['attendance_status'], 'ABSENT')
        self.assertIsNone(response.data['check_in_time'])

        # Mark Excused Absence
        response = self.client.post('/api/daycare/attendance/mark-excused/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "remarks": "Scheduled medical surgery"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['attendance_status'], 'EXCUSED_ABSENCE')

    # 13. Daily Roster and Summary Statistics
    def test_daily_roster_and_summary_stats(self):
        self.client.force_authenticate(user=self.admin_a)

        # Check in child
        self.client.post('/api/daycare/attendance/check-in/', {
            "student_id": str(self.child_active.id),
            "date": str(self.today),
            "check_in_time": "08:15:00"
        })

        response = self.client.get(f'/api/daycare/attendance/daily/?date={self.today}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        summary = response.data['summary']
        self.assertEqual(summary['total_children'], 1)
        self.assertEqual(summary['present_count'], 1)
        self.assertEqual(summary['checked_in_count'], 1)
        self.assertEqual(summary['checked_out_count'], 0)
        self.assertEqual(summary['absent_count'], 0)

    # 14. Child Attendance History Endpoint
    def test_child_attendance_history_endpoint(self):
        self.client.force_authenticate(user=self.admin_a)

        # Create 3 days of attendance
        d1 = self.today - timedelta(days=2)
        d2 = self.today - timedelta(days=1)
        d3 = self.today

        StudentAttendance.objects.create(
            daycare=self.daycare_a, student=self.child_active, attendance_date=d1,
            attendance_status='PRESENT', check_in_time=time(8, 15), check_out_time=time(17, 30)
        )
        StudentAttendance.objects.create(
            daycare=self.daycare_a, student=self.child_active, attendance_date=d2,
            attendance_status='LATE', is_late=True, check_in_time=time(9, 30), check_out_time=time(17, 30)
        )
        StudentAttendance.objects.create(
            daycare=self.daycare_a, student=self.child_active, attendance_date=d3,
            attendance_status='ABSENT'
        )

        response = self.client.get(f'/api/daycare/children/{self.child_active.id}/attendance/?start_date={d1}&end_date={d3}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['summary']['total_days'], 3)
        self.assertEqual(response.data['summary']['present_count'], 2) # PRESENT + LATE
        self.assertEqual(response.data['summary']['absent_count'], 1)
        self.assertEqual(response.data['summary']['late_count'], 1)
        self.assertEqual(len(response.data['records']), 3)
