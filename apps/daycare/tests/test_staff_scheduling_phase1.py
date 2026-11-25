from datetime import date, time, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from core.models import (
    Daycare, Employee, Classroom, Branch, StaffSchedule,
    EmployeeAvailability, AuditLog
)

User = get_user_model()


class StaffSchedulingPhase1TestCase(APITestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Setup Daycare A
        self.daycare_a = Daycare.objects.create(name="Sunny Smiles Daycare A", email="admin@daycarea.com", status="Active")
        self.admin_a = User.objects.create_user(
            username="admin_a",
            email="admin@daycarea.com",
            password="password123",
            daycare=self.daycare_a,
            is_staff=True
        )

        # 2. Setup Daycare B (For Tenant Isolation)
        self.daycare_b = Daycare.objects.create(name="Starlight Academy B", email="admin@daycareb.com", status="Active")
        self.admin_b = User.objects.create_user(
            username="admin_b",
            email="admin@daycareb.com",
            password="password123",
            daycare=self.daycare_b,
            is_staff=True
        )

        # 3. Setup Branches & Classrooms
        self.branch_a = Branch.objects.create(name="North Campus A", daycare=self.daycare_a)
        self.branch_b = Branch.objects.create(name="South Campus B", daycare=self.daycare_b)

        self.room_infants_a = Classroom.objects.create(room_name="Infants Room A", daycare=self.daycare_a, capacity=10)
        self.room_toddlers_a = Classroom.objects.create(room_name="Toddlers Room A", daycare=self.daycare_a, capacity=15)
        self.room_b = Classroom.objects.create(room_name="Preschool Room B", daycare=self.daycare_b, capacity=12)

        # 4. Setup Employees
        self.emp_alice = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Alice",
            last_name="Johnson",
            job_title="Lead Educator",
            role="Teacher",
            status="active",
            employee_number="EMP-A101"
        )
        self.emp_bob = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Bob",
            last_name="Smith",
            job_title="Assistant Teacher",
            role="Assistant",
            status="active",
            employee_number="EMP-A102"
        )
        self.emp_inactive = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Ian",
            last_name="Inactive",
            job_title="Former Staff",
            role="Teacher",
            status="inactive",
            employee_number="EMP-A999"
        )
        self.emp_charlie_b = Employee.objects.create(
            daycare=self.daycare_b,
            first_name="Charlie",
            last_name="Brown",
            job_title="Educator B",
            role="Teacher",
            status="active",
            employee_number="EMP-B201"
        )

        # 5. Setup Availability for Alice
        # Alice is Available on Monday (Standard), Custom hours on Tuesday (08:00–16:00), Unavailable on Wednesday
        EmployeeAvailability.objects.create(
            employee=self.emp_alice,
            day_of_week="Monday",
            is_available=True,
            status="Available"
        )
        EmployeeAvailability.objects.create(
            employee=self.emp_alice,
            day_of_week="Tuesday",
            start_time=time(8, 0),
            end_time=time(16, 0),
            is_available=True,
            status="Custom hours"
        )
        EmployeeAvailability.objects.create(
            employee=self.emp_alice,
            day_of_week="Wednesday",
            is_available=False,
            status="Unavailable"
        )

        # 6. Target dates
        # Let's anchor on next Monday
        today = date.today()
        day_offset = (0 - today.weekday()) % 7
        if day_offset == 0:
            day_offset = 7
        self.next_monday = today + timedelta(days=day_offset)
        self.next_tuesday = self.next_monday + timedelta(days=1)
        self.next_wednesday = self.next_monday + timedelta(days=2)
        self.next_thursday = self.next_monday + timedelta(days=3)
        self.next_friday = self.next_monday + timedelta(days=4)

    # =========================================================================
    # 1. EMPLOYEE AVAILABILITY REUSE & STATUS
    # =========================================================================
    def test_employee_availability_7_day_lifecycle(self):
        """Test retrieving and updating employee 7-day availability with status."""
        self.client.force_authenticate(user=self.admin_a)
        url = f"/api/daycare/employees/{self.emp_bob.id}/availability/"

        # Update 7-day schedule
        payload = [
            {"day_of_week": "Monday", "is_available": True, "status": "Available"},
            {"day_of_week": "Tuesday", "start_time": "08:30:00", "end_time": "16:30:00", "is_available": True, "status": "Custom hours"},
            {"day_of_week": "Wednesday", "is_available": True, "status": "Available"},
            {"day_of_week": "Thursday", "is_available": True, "status": "Available"},
            {"day_of_week": "Friday", "start_time": "09:00:00", "end_time": "17:00:00", "is_available": True, "status": "Custom hours"},
            {"day_of_week": "Saturday", "is_available": False, "status": "Unavailable"},
            {"day_of_week": "Sunday", "is_available": False, "status": "Unavailable"},
        ]
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Fetch
        get_res = self.client.get(url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        days = {d['day_of_week']: d for d in get_res.json()}
        self.assertEqual(days['Monday']['status'], 'Available')
        self.assertEqual(days['Tuesday']['status'], 'Custom hours')
        self.assertEqual(days['Saturday']['status'], 'Unavailable')

    # =========================================================================
    # 2. CREATE VALID STAFF SCHEDULES
    # =========================================================================
    def test_create_valid_staff_schedule(self):
        """Test creating valid regular, opening, and closing shifts."""
        self.client.force_authenticate(user=self.admin_a)
        url = "/api/daycare/schedules/"

        # Alice on Monday (Available full day)
        payload = {
            "employee": str(self.emp_alice.id),
            "date": str(self.next_monday),
            "shift_start": "08:30:00",
            "shift_end": "17:00:00",
            "shift_type": "regular",
            "classroom": str(self.room_infants_a.id),
            "branch": str(self.branch_a.id),
            "status": "scheduled",
            "notes": "Infants morning lead"
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertEqual(data['employee_name'], "Alice Johnson")
        self.assertEqual(data['classroom_name'], "Infants Room A")
        self.assertEqual(data['duration_hours'], 8.5)

        # Verify Audit Log
        self.assertTrue(AuditLog.objects.filter(action='STAFF_SCHEDULE_CREATED', entity_id=data['id']).exists())

    # =========================================================================
    # 3. EDIT AND DELETE STAFF SCHEDULE
    # =========================================================================
    def test_edit_and_delete_staff_schedule(self):
        """Test updating shift timing, classroom, and deleting shift."""
        self.client.force_authenticate(user=self.admin_a)
        schedule = StaffSchedule.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_alice,
            date=self.next_monday,
            shift_start=time(8, 30),
            shift_end=time(17, 0),
            shift_type="regular",
            classroom=self.room_infants_a,
            created_by=self.admin_a
        )

        detail_url = f"/api/daycare/schedules/{schedule.id}/"

        # Edit Shift
        patch_payload = {
            "shift_start": "09:00:00",
            "shift_end": "17:30:00",
            "status": "confirmed",
            "classroom": str(self.room_toddlers_a.id)
        }
        patch_res = self.client.patch(detail_url, patch_payload, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.json()['status'], 'confirmed')
        self.assertEqual(patch_res.json()['classroom_name'], 'Toddlers Room A')

        # Delete Shift
        del_res = self.client.delete(detail_url)
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(StaffSchedule.objects.filter(id=schedule.id).exists())

    # =========================================================================
    # 4. OVERLAPPING SHIFT VALIDATION
    # =========================================================================
    def test_overlapping_shifts_rejection(self):
        """Prevent overlapping shifts for the same employee on the same date."""
        self.client.force_authenticate(user=self.admin_a)
        # Create initial shift: 09:00 to 17:00
        StaffSchedule.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_alice,
            date=self.next_monday,
            shift_start=time(9, 0),
            shift_end=time(17, 0),
            shift_type="regular",
            created_by=self.admin_a
        )

        url = "/api/daycare/schedules/"

        # Attempt overlapping shift 1: 13:00 to 18:00 (Starts during existing)
        res1 = self.client.post(url, {
            "employee": str(self.emp_alice.id),
            "date": str(self.next_monday),
            "shift_start": "13:00:00",
            "shift_end": "18:00:00",
            "shift_type": "closing"
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Overlapping shift conflict", str(res1.json()))

        # Attempt overlapping shift 2: 08:00 to 12:00 (Ends during existing)
        res2 = self.client.post(url, {
            "employee": str(self.emp_alice.id),
            "date": str(self.next_monday),
            "shift_start": "08:00:00",
            "shift_end": "12:00:00",
            "shift_type": "opening"
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Overlapping shift conflict", str(res2.json()))

        # Non-overlapping shift on same day: 17:00 to 20:00 (Evening wrap-up) -> Allowed!
        res3 = self.client.post(url, {
            "employee": str(self.emp_alice.id),
            "date": str(self.next_monday),
            "shift_start": "17:00:00",
            "shift_end": "20:00:00",
            "shift_type": "custom"
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_201_CREATED)

    # =========================================================================
    # 5. AVAILABILITY CONFLICT VALIDATION
    # =========================================================================
    def test_availability_conflict_rejection(self):
        """Reject shift when employee is Unavailable or outside Custom hours."""
        self.client.force_authenticate(user=self.admin_a)
        url = "/api/daycare/schedules/"

        # 1. Alice is marked 'Unavailable' on Wednesday
        res_wed = self.client.post(url, {
            "employee": str(self.emp_alice.id),
            "date": str(self.next_wednesday),
            "shift_start": "09:00:00",
            "shift_end": "17:00:00",
            "shift_type": "regular"
        }, format='json')
        self.assertEqual(res_wed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Unavailable on Wednesdays", str(res_wed.json()))

        # 2. Alice has custom hours 08:00–16:00 on Tuesday
        # Attempt shift 09:00–17:00 (ends after 16:00) -> Rejected!
        res_tue_late = self.client.post(url, {
            "employee": str(self.emp_alice.id),
            "date": str(self.next_tuesday),
            "shift_start": "09:00:00",
            "shift_end": "17:00:00",
            "shift_type": "regular"
        }, format='json')
        self.assertEqual(res_tue_late.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("outside available hours", str(res_tue_late.json()))

        # Attempt shift 08:30–15:30 (inside 08:00–16:00) -> Allowed!
        res_tue_ok = self.client.post(url, {
            "employee": str(self.emp_alice.id),
            "date": str(self.next_tuesday),
            "shift_start": "08:30:00",
            "shift_end": "15:30:00",
            "shift_type": "custom"
        }, format='json')
        self.assertEqual(res_tue_ok.status_code, status.HTTP_201_CREATED)

    # =========================================================================
    # 6. INACTIVE EMPLOYEE VALIDATION
    # =========================================================================
    def test_inactive_employee_scheduling_rejection(self):
        """Cannot schedule an inactive or terminated employee."""
        self.client.force_authenticate(user=self.admin_a)
        url = "/api/daycare/schedules/"

        res = self.client.post(url, {
            "employee": str(self.emp_inactive.id),
            "date": str(self.next_monday),
            "shift_start": "09:00:00",
            "shift_end": "17:00:00"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive", str(res.json()).lower())

    # =========================================================================
    # 7. TIME ORDER VALIDATION
    # =========================================================================
    def test_invalid_time_rejection(self):
        """Start time must be strictly before end time."""
        self.client.force_authenticate(user=self.admin_a)
        url = "/api/daycare/schedules/"

        # start >= end
        res = self.client.post(url, {
            "employee": str(self.emp_alice.id),
            "date": str(self.next_monday),
            "shift_start": "17:00:00",
            "shift_end": "09:00:00"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Shift start time must be before end time", str(res.json()))

    # =========================================================================
    # 8. CROSS-DAYCARE RESOURCE REJECTION
    # =========================================================================
    def test_cross_daycare_employee_rejection(self):
        """Cannot schedule Daycare B employee under Daycare A."""
        self.client.force_authenticate(user=self.admin_a)
        url = "/api/daycare/schedules/"

        res = self.client.post(url, {
            "employee": str(self.emp_charlie_b.id),
            "date": str(self.next_monday),
            "shift_start": "09:00:00",
            "shift_end": "17:00:00"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("does not belong to your daycare", str(res.json()))

    def test_cross_daycare_classroom_rejection(self):
        """Cannot assign Daycare B classroom under Daycare A."""
        self.client.force_authenticate(user=self.admin_a)
        url = "/api/daycare/schedules/"

        res = self.client.post(url, {
            "employee": str(self.emp_alice.id),
            "date": str(self.next_monday),
            "shift_start": "09:00:00",
            "shift_end": "17:00:00",
            "classroom": str(self.room_b.id)
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("does not belong to your daycare", str(res.json()))

    # =========================================================================
    # 9. STRICT TENANT ISOLATION
    # =========================================================================
    def test_tenant_isolation_schedule_queries(self):
        """Daycare A admin cannot see or modify Daycare B schedules."""
        # Create schedule for Daycare B
        sched_b = StaffSchedule.objects.create(
            daycare=self.daycare_b,
            employee=self.emp_charlie_b,
            date=self.next_monday,
            shift_start=time(9, 0),
            shift_end=time(17, 0),
            classroom=self.room_b,
            created_by=self.admin_b
        )

        # Authenticate as Daycare A admin
        self.client.force_authenticate(user=self.admin_a)

        # List query must not include Daycare B shift
        res_list = self.client.get("/api/daycare/schedules/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        b_ids = [s['id'] for s in res_list.json() if s['id'] == str(sched_b.id)]
        self.assertEqual(len(b_ids), 0)

        # Direct detail query for Daycare B shift must return 404
        res_detail = self.client.get(f"/api/daycare/schedules/{sched_b.id}/")
        self.assertEqual(res_detail.status_code, status.HTTP_404_NOT_FOUND)

        # Direct patch tampering must return 404
        res_patch = self.client.patch(f"/api/daycare/schedules/{sched_b.id}/", {"status": "cancelled"})
        self.assertEqual(res_patch.status_code, status.HTTP_404_NOT_FOUND)

    # =========================================================================
    # 10. COPY SCHEDULE BATCH ACTION
    # =========================================================================
    def test_copy_schedule_week(self):
        """Test batch copying weekly schedule to another week."""
        self.client.force_authenticate(user=self.admin_a)

        # Create source shifts on Monday and Thursday
        StaffSchedule.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_alice,
            date=self.next_monday,
            shift_start=time(8, 30),
            shift_end=time(16, 30),
            shift_type="regular",
            classroom=self.room_infants_a,
            created_by=self.admin_a
        )
        StaffSchedule.objects.create(
            daycare=self.daycare_a,
            employee=self.emp_bob,
            date=self.next_thursday,
            shift_start=time(9, 0),
            shift_end=time(17, 0),
            shift_type="closing",
            classroom=self.room_toddlers_a,
            created_by=self.admin_a
        )

        copy_url = "/api/daycare/schedules/copy/"
        target_monday = self.next_monday + timedelta(days=7)
        target_friday = self.next_friday + timedelta(days=7)

        copy_payload = {
            "source_start_date": str(self.next_monday),
            "source_end_date": str(self.next_friday),
            "target_start_date": str(target_monday),
            "overwrite_conflicts": False
        }

        res = self.client.post(copy_url, copy_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data['copied_count'], 2)
        self.assertEqual(data['skipped_count'], 0)

        # Verify new target shifts exist
        target_alice_shift = StaffSchedule.objects.filter(
            daycare=self.daycare_a,
            employee=self.emp_alice,
            date=target_monday
        ).first()
        self.assertIsNotNone(target_alice_shift)
        self.assertEqual(target_alice_shift.shift_start, time(8, 30))

    # =========================================================================
    # 11. WEEK NAVIGATION AND FILTERS
    # =========================================================================
    def test_week_navigation_and_filters(self):
        """Test schedule filters by date range, employee, classroom, and branch."""
        self.client.force_authenticate(user=self.admin_a)

        s1 = StaffSchedule.objects.create(
            daycare=self.daycare_a, employee=self.emp_alice, date=self.next_monday,
            shift_start=time(8, 30), shift_end=time(16, 30), shift_type="regular",
            classroom=self.room_infants_a, branch=self.branch_a, created_by=self.admin_a
        )
        s2 = StaffSchedule.objects.create(
            daycare=self.daycare_a, employee=self.emp_bob, date=self.next_tuesday,
            shift_start=time(9, 0), shift_end=time(17, 0), shift_type="opening",
            classroom=self.room_toddlers_a, branch=self.branch_a, created_by=self.admin_a
        )

        # Filter by employee Alice
        res_emp = self.client.get(f"/api/daycare/schedules/?employee={self.emp_alice.id}")
        self.assertEqual(len(res_emp.json()), 1)
        self.assertEqual(res_emp.json()[0]['id'], str(s1.id))

        # Filter by classroom Toddlers
        res_room = self.client.get(f"/api/daycare/schedules/?classroom={self.room_toddlers_a.id}")
        self.assertEqual(len(res_room.json()), 1)
        self.assertEqual(res_room.json()[0]['id'], str(s2.id))

        # Filter by shift_type opening
        res_type = self.client.get(f"/api/daycare/schedules/?shift_type=opening")
        self.assertEqual(len(res_type.json()), 1)
        self.assertEqual(res_type.json()[0]['id'], str(s2.id))

        # Filter by date range (only Monday)
        res_range = self.client.get(f"/api/daycare/schedules/?start_date={self.next_monday}&end_date={self.next_monday}")
        self.assertEqual(len(res_range.json()), 1)
        self.assertEqual(res_range.json()[0]['id'], str(s1.id))
