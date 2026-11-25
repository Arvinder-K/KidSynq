from datetime import date, time, timedelta
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from core.models import Daycare, Employee, Classroom, Branch, AgeGroup, StaffSchedule, ShiftBreak, EmployeeAvailability

User = get_user_model()


class ClassroomSchedulingPhase2TestCase(APITestCase):
    def setUp(self):
        # 1. Primary Daycare & Users
        self.daycare = Daycare.objects.create(
            name="Sunflower Early Learning Centre",
            daycare_code="SUNFLOWER",
            capacity=40,
            status="Active",
            opening_time=time(7, 0),
            closing_time=time(18, 0)
        )
        self.admin_user = User.objects.create_user(
            username="admin@sunflower.com",
            email="admin@sunflower.com",
            password="Password123!",
            first_name="Alice",
            last_name="Director",
            daycare=self.daycare,
            is_staff=True
        )

        # 2. Branch
        self.branch_a = Branch.objects.create(daycare=self.daycare, name="Downtown Campus")
        self.branch_b = Branch.objects.create(daycare=self.daycare, name="West End Campus")

        # 3. Age Group & Classroom
        # Toddler: 13-24 months -> 1:5 ratio (seeded by post_save or created)
        self.age_group_toddler, _ = AgeGroup.objects.get_or_create(
            daycare=self.daycare,
            name="Toddler",
            defaults={"min_age_months": 13, "max_age_months": 24, "display_order": 2}
        )

        self.classroom = Classroom.objects.create(
            daycare=self.daycare,
            branch=self.branch_a,
            room_name="Toddler Explorers A",
            room_code="TOD-A",
            age_group=self.age_group_toddler,
            capacity=10,  # 10 children / 5 ratio = 2 staff required
            status="Active"
        )

        # 4. Inactive Classroom
        self.inactive_classroom = Classroom.objects.create(
            daycare=self.daycare,
            room_name="Renovation Room",
            status="Inactive",
            capacity=8
        )

        # 5. Employees
        self.emp1 = Employee.objects.create(
            daycare=self.daycare,
            first_name="Sarah",
            last_name="Jenkins",
            email="sarah@sunflower.com",
            job_title="Lead ECE",
            role="Teacher",
            status="active"
        )
        self.emp2 = Employee.objects.create(
            daycare=self.daycare,
            first_name="Marcus",
            last_name="Vance",
            email="marcus@sunflower.com",
            job_title="ECE Assistant",
            role="Assistant",
            status="active"
        )
        self.emp_inactive = Employee.objects.create(
            daycare=self.daycare,
            first_name="Inactive",
            last_name="Staff",
            email="inactive@sunflower.com",
            status="inactive"
        )

        # 6. Secondary Daycare (Tenant Isolation)
        self.daycare_other = Daycare.objects.create(
            name="Other Daycare",
            daycare_code="OTHER",
            status="Active"
        )
        self.other_user = User.objects.create_user(
            username="other@other.com",
            email="other@other.com",
            password="Password123!",
            daycare=self.daycare_other,
            is_staff=True
        )

        self.other_classroom = Classroom.objects.create(
            daycare=self.daycare_other,
            room_name="Other Room",
            capacity=10,
            status="Active"
        )

        # Authenticate
        self.client.force_authenticate(user=self.admin_user)

    def test_opening_shift_creation_and_duties(self):
        """Test creating an opening shift with duties."""
        test_date = date.today() + timedelta(days=1)
        payload = {
            "employee": str(self.emp1.id),
            "date": str(test_date),
            "shift_start": "06:30",
            "shift_end": "14:30",
            "shift_type": "opening",
            "classroom": str(self.classroom.id),
            "branch": str(self.branch_a.id),
            "status": "scheduled",
            "duties": "Inspect entrance, unlock main gates, check room temperature, set up breakfast stations.",
            "notes": "Opening shift for Toddler A"
        }

        res = self.client.post("/api/daycare/schedules/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["shift_type"], "opening")
        self.assertEqual(res.data["duties"], payload["duties"])
        self.assertEqual(res.data["total_shift_hours"], 8.0)
        self.assertEqual(res.data["net_working_hours"], 8.0)

    def test_closing_shift_creation_and_duties(self):
        """Test creating a closing shift with duties."""
        test_date = date.today() + timedelta(days=2)
        payload = {
            "employee": str(self.emp2.id),
            "date": str(test_date),
            "shift_start": "10:00",
            "shift_end": "18:30",
            "shift_type": "closing",
            "classroom": str(self.classroom.id),
            "branch": str(self.branch_a.id),
            "status": "scheduled",
            "duties": "Sanitize toys, verify all children picked up, log attendance, lock facility.",
            "notes": "Closing shift for Toddler A"
        }

        res = self.client.post("/api/daycare/schedules/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["shift_type"], "closing")
        self.assertEqual(res.data["duties"], payload["duties"])
        self.assertEqual(res.data["total_shift_hours"], 8.5)

    def test_shift_multiple_breaks_lifecycle(self):
        """Test adding multiple breaks (meal, rest) to a shift and retrieving them."""
        test_date = date.today() + timedelta(days=3)
        shift = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp1,
            date=test_date,
            shift_start=time(8, 0),
            shift_end=time(16, 30),
            classroom=self.classroom
        )

        # 1. Add 30-min unpaid meal break
        break_payload1 = {
            "break_start": "12:00",
            "break_end": "12:30",
            "break_type": "meal",
            "is_paid": False,
            "notes": "Lunch break"
        }
        res1 = self.client.post(f"/api/daycare/schedules/{shift.id}/breaks/", break_payload1, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED, res1.data)
        self.assertEqual(res1.data["duration_minutes"], 30)
        self.assertFalse(res1.data["is_paid"])

        # 2. Add 15-min paid rest break
        break_payload2 = {
            "break_start": "10:15",
            "break_end": "10:30",
            "break_type": "rest",
            "is_paid": True,
            "notes": "Morning coffee rest"
        }
        res2 = self.client.post(f"/api/daycare/schedules/{shift.id}/breaks/", break_payload2, format="json")
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED, res2.data)
        self.assertEqual(res2.data["duration_minutes"], 15)
        self.assertTrue(res2.data["is_paid"])

        # 3. List breaks
        list_res = self.client.get(f"/api/daycare/schedules/{shift.id}/breaks/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.data), 2)

    def test_net_working_hours_calculation(self):
        """Test that net working hours = shift duration - unpaid breaks."""
        test_date = date.today() + timedelta(days=4)
        payload = {
            "employee": str(self.emp1.id),
            "date": str(test_date),
            "shift_start": "08:00",
            "shift_end": "17:00",  # 9.0 total hours
            "shift_type": "regular",
            "classroom": str(self.classroom.id),
            "breaks": [
                {
                    "break_start": "12:00",
                    "break_end": "13:00",  # 1.0 hr unpaid meal
                    "break_type": "meal",
                    "is_paid": False
                },
                {
                    "break_start": "10:00",
                    "break_end": "10:15",  # 0.25 hr paid rest (should NOT deduct)
                    "break_type": "rest",
                    "is_paid": True
                }
            ]
        }

        res = self.client.post("/api/daycare/schedules/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["total_shift_hours"], 9.0)
        self.assertEqual(res.data["unpaid_break_hours"], 1.0)
        self.assertEqual(res.data["paid_break_hours"], 0.25)
        self.assertEqual(res.data["net_working_hours"], 8.0)  # 9.0 - 1.0 = 8.0

    def test_break_boundary_validation(self):
        """Test rejection of breaks outside shift window or invalid start/end."""
        test_date = date.today() + timedelta(days=5)
        shift = StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp1,
            date=test_date,
            shift_start=time(9, 0),
            shift_end=time(17, 0)
        )

        # 1. Break starts after end time
        res1 = self.client.post(f"/api/daycare/schedules/{shift.id}/breaks/", {
            "break_start": "13:00",
            "break_end": "12:00"
        }, format="json")
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Break falls outside shift
        res2 = self.client.post(f"/api/daycare/schedules/{shift.id}/breaks/", {
            "break_start": "08:00",
            "break_end": "08:30"
        }, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Overlapping breaks
        ShiftBreak.objects.create(
            schedule=shift,
            break_start=time(12, 0),
            break_end=time(12, 45)
        )
        res3 = self.client.post(f"/api/daycare/schedules/{shift.id}/breaks/", {
            "break_start": "12:30",
            "break_end": "13:00"
        }, format="json")
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

    def test_classroom_hourly_coverage_calculation(self):
        """Test classroom schedule & hourly coverage matrix endpoint."""
        test_date = date.today() + timedelta(days=6)
        # Schedule 2 staff to meet 2-staff requirement for 10 toddlers
        StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp1,
            date=test_date,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            classroom=self.classroom
        )
        StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp2,
            date=test_date,
            shift_start=time(8, 0),
            shift_end=time(16, 0),
            classroom=self.classroom
        )

        res = self.client.get(f"/api/daycare/classrooms/{self.classroom.id}/schedule/?date={test_date}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["classroom"]["room_name"], "Toddler Explorers A")
        self.assertEqual(res.data["coverage"]["required_staff_per_hour"], 2)
        self.assertEqual(res.data["coverage"]["ratio_standard"], "1:5")

        hourly = res.data["coverage"]["hourly_coverage"]
        slot_8_to_9 = next((s for s in hourly if s["slot_start"] == "08:00"), None)
        self.assertIsNotNone(slot_8_to_9)
        self.assertEqual(slot_8_to_9["required_staff"], 2)
        self.assertEqual(slot_8_to_9["scheduled_staff_count"], 2)
        self.assertEqual(slot_8_to_9["coverage_status"], "OK")

    def test_ratio_shortage_detection(self):
        """Test detection of ratio shortage when scheduled staff < required staff."""
        test_date = date.today() + timedelta(days=7)
        # Only 1 staff scheduled when 2 are required
        StaffSchedule.objects.create(
            daycare=self.daycare,
            employee=self.emp1,
            date=test_date,
            shift_start=time(8, 0),
            shift_end=time(12, 0),
            classroom=self.classroom
        )

        res = self.client.get(f"/api/daycare/classrooms/{self.classroom.id}/coverage/?date={test_date}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["overall_status"], "SHORTAGE")
        self.assertGreater(res.data["shortage_slots"], 0)

        slot_8_to_9 = next((s for s in res.data["hourly_coverage"] if s["slot_start"] == "08:00"), None)
        self.assertEqual(slot_8_to_9["coverage_status"], "SHORTAGE")
        self.assertEqual(slot_8_to_9["shortage"], 1)

    def test_inactive_classroom_conflict(self):
        """Test rejection of scheduling shift in an inactive classroom."""
        test_date = date.today() + timedelta(days=8)
        payload = {
            "employee": str(self.emp1.id),
            "date": str(test_date),
            "shift_start": "08:00",
            "shift_end": "16:00",
            "classroom": str(self.inactive_classroom.id)
        }
        res = self.client.post("/api/daycare/schedules/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("classroom", res.data)

    def test_branch_mismatch_conflict(self):
        """Test rejection when assigned branch contradicts classroom branch."""
        test_date = date.today() + timedelta(days=9)
        payload = {
            "employee": str(self.emp1.id),
            "date": str(test_date),
            "shift_start": "08:00",
            "shift_end": "16:00",
            "classroom": str(self.classroom.id),  # Belongs to branch_a
            "branch": str(self.branch_b.id)       # Mismatched branch_b
        }
        res = self.client.post("/api/daycare/schedules/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("branch", res.data)

    def test_tenant_isolation_classroom_schedule(self):
        """Test that user from Daycare B cannot access Daycare A classroom schedule or coverage."""
        self.client.force_authenticate(user=self.other_user)

        res1 = self.client.get(f"/api/daycare/classrooms/{self.classroom.id}/schedule/")
        self.assertEqual(res1.status_code, status.HTTP_404_NOT_FOUND)

        res2 = self.client.get(f"/api/daycare/classrooms/{self.classroom.id}/coverage/")
        self.assertEqual(res2.status_code, status.HTTP_404_NOT_FOUND)
