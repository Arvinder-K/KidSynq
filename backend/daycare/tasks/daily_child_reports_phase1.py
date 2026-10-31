import datetime
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.exceptions import ValidationError

from core.models import (
    Daycare, Branch, User, Student, Classroom, ClassroomStudent,
    StudentAttendance, DailyReport, MealRecord, NapRecord,
    ToiletingRecord, ActivityRecord, MoodRecord,
    DailyTemperatureRecord, DailyNoteRecord, DailyPhotoRecord,
    Medication, MedicationAdministration, IncidentReport, Employee, AuditLog
)
from daycare.services.daily_reports import DailyReportService


class DailyChildReportsPhase1TestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Daycare A & B
        self.daycare_a = Daycare.objects.create(name="Sunshine Daycare", status="Active")
        self.daycare_b = Daycare.objects.create(name="Starlight Daycare", status="Active")

        # 2. Branch
        self.branch_a = Branch.objects.create(name="Main Campus", daycare=self.daycare_a)

        # 3. Users
        self.admin_user_a = User.objects.create_user(
            username="admin_a", email="admin_a@test.com", password="password123",
            daycare=self.daycare_a
        )
        self.admin_user_a.role = "Daycare Admin"
        self.admin_user_a.save()

        self.staff_user_a = User.objects.create_user(
            username="staff_a", email="staff_a@test.com", password="password123",
            daycare=self.daycare_a
        )
        self.staff_user_a.role = "Staff"
        self.staff_user_a.save()

        self.guardian_user_a = User.objects.create_user(
            username="guardian_a", email="guardian_a@test.com", password="password123",
            daycare=self.daycare_a
        )
        self.guardian_user_a.role = "Guardian"
        self.guardian_user_a.guardian = True
        self.guardian_user_a.save()

        self.admin_user_b = User.objects.create_user(
            username="admin_b", email="admin_b@test.com", password="password123",
            daycare=self.daycare_b
        )
        self.admin_user_b.role = "Daycare Admin"
        self.admin_user_b.save()

        # 4. Employee
        self.employee_a = Employee.objects.create(
            user=self.staff_user_a,
            daycare=self.daycare_a,
            first_name="Jane",
            last_name="Educator",
            status="Active"
        )

        # 5. Classrooms
        self.classroom_a = Classroom.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            room_name="Toddler Explorers",
            capacity=15
        )

        # 6. Students
        self.student_1 = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            first_name="Tommy",
            last_name="Pickles",
            status="Active",
            dob=datetime.date(2023, 1, 15)
        )
        self.student_2 = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            first_name="Chuckie",
            last_name="Finster",
            status="Active",
            dob=datetime.date(2023, 3, 20)
        )
        self.student_b = Student.objects.create(
            daycare=self.daycare_b,
            first_name="Angelica",
            last_name="Pickles",
            status="Active",
            dob=datetime.date(2022, 5, 12)
        )

        # Assign students to classroom
        ClassroomStudent.objects.create(classroom=self.classroom_a, student=self.student_1, status="Active")
        ClassroomStudent.objects.create(classroom=self.classroom_a, student=self.student_2, status="Active")

        # 7. Date & Attendance
        self.today = datetime.date.today()
        self.attendance_1 = StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.student_1,
            attendance_date=self.today,
            attendance_status="PRESENT",
            check_in_time=datetime.time(8, 30)
        )

    # -------------------------------------------------------------
    # 1. Report Foundation & Service Tests
    # -------------------------------------------------------------
    def test_01_get_or_create_daily_report(self):
        """Test creating and retrieving a DailyReport automatically linking attendance and classroom"""
        report = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare_a,
            student=self.student_1,
            report_date=self.today,
            user=self.staff_user_a
        )
        self.assertIsNotNone(report)
        self.assertEqual(report.student, self.student_1)
        self.assertEqual(report.report_date, self.today)
        self.assertEqual(report.classroom, self.classroom_a)
        self.assertEqual(report.attendance_record, self.attendance_1)
        self.assertEqual(report.status, 'Draft')

        # Calling again should retrieve the exact same report
        report2 = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare_a,
            student=self.student_1,
            report_date=self.today,
            user=self.staff_user_a
        )
        self.assertEqual(report.id, report2.id)

    def test_02_meal_and_snack_entries(self):
        """Test logging breakfast, lunch, and snack with intake levels"""
        report = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )

        meal = DailyReportService.add_meal_entry(
            daily_report=report,
            meal_type="Breakfast",
            meal_category="Meal",
            food_provided="Oatmeal with berries",
            amount_eaten="All",
            time=datetime.time(9, 0),
            notes="Ate happily",
            user=self.staff_user_a
        )
        self.assertEqual(meal.meal_type, "Breakfast")
        self.assertEqual(meal.amount_eaten, "All")

        snack = DailyReportService.add_meal_entry(
            daily_report=report,
            meal_type="AM Snack",
            meal_category="Snack",
            food_provided="Apple slices & crackers",
            amount_eaten="Most",
            time=datetime.time(10, 30),
            notes="Left 1 slice",
            user=self.staff_user_a
        )
        self.assertEqual(snack.meal_category, "Snack")
        self.assertEqual(report.meals.count(), 2)

    def test_03_nap_duration_and_overlap_rejection(self):
        """Test nap duration calculation and rejecting invalid times / overlaps"""
        report = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )

        # 1. Valid Nap: 12:30 to 14:00 (90 mins)
        nap = DailyReportService.add_nap_entry(
            daily_report=report,
            start_time=datetime.time(12, 30),
            end_time=datetime.time(14, 0),
            quality="Slept",
            notes="Fell asleep quickly",
            user=self.staff_user_a
        )
        self.assertEqual(nap.duration_minutes, 90)

        # 2. Inverted time: End before start should raise ValidationError
        with self.assertRaises(ValidationError):
            DailyReportService.add_nap_entry(
                daily_report=report,
                start_time=datetime.time(15, 0),
                end_time=datetime.time(14, 30),
                user=self.staff_user_a
            )

        # 3. Overlapping nap: 13:00 to 14:30 overlaps with 12:30 to 14:00
        with self.assertRaises(ValidationError):
            DailyReportService.add_nap_entry(
                daily_report=report,
                start_time=datetime.time(13, 0),
                end_time=datetime.time(14, 30),
                user=self.staff_user_a
            )

        # 4. Non-overlapping second nap should succeed: 15:00 to 15:30 (30 mins)
        nap2 = DailyReportService.add_nap_entry(
            daily_report=report,
            start_time=datetime.time(15, 0),
            end_time=datetime.time(15, 30),
            quality="Rested",
            user=self.staff_user_a
        )
        self.assertEqual(nap2.duration_minutes, 30)
        self.assertEqual(report.naps.count(), 2)

    def test_04_diaper_and_toilet_records(self):
        """Test recording diaper changes and potty assistance"""
        report = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )

        # Diaper
        diaper = DailyReportService.add_toileting_entry(
            daily_report=report,
            record_type="Diaper",
            condition="BM",
            time=datetime.time(10, 15),
            notes="Diaper cream applied",
            user=self.staff_user_a
        )
        self.assertEqual(diaper.type, "Diaper")
        self.assertEqual(diaper.condition, "BM")

        # Potty / Toilet
        potty = DailyReportService.add_toileting_entry(
            daily_report=report,
            record_type="Toilet",
            condition="Clean",
            assistance_level="Prompted",
            time=datetime.time(14, 15),
            notes="Used potty successfully",
            user=self.staff_user_a
        )
        self.assertEqual(potty.assistance_level, "Prompted")
        self.assertEqual(report.toileting.count(), 2)

    def test_05_mood_records(self):
        """Test recording child mood throughout the day"""
        report = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )

        mood1 = DailyReportService.add_mood_entry(
            daily_report=report,
            mood="Happy",
            time=datetime.time(9, 0),
            notes="Smiled at drop-off",
            user=self.staff_user_a
        )
        mood2 = DailyReportService.add_mood_entry(
            daily_report=report,
            mood="Tired",
            time=datetime.time(12, 15),
            notes="Rubbing eyes before nap",
            user=self.staff_user_a
        )
        self.assertEqual(report.moods.count(), 2)

    def test_06_activities_learning_and_outdoor_play(self):
        """Test recording activities, learning areas, and outdoor play with duration"""
        report = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )

        # Learning activity
        learning = DailyReportService.add_activity_entry(
            daily_report=report,
            activity_type="Learning & Development",
            activity_category="Learning & Development",
            name="Color Sorting",
            learning_area="Cognitive",
            description="Sorted colored wooden blocks into matching baskets",
            participation="High",
            teacher_notes="Identified blue and yellow correctly",
            start_time=datetime.time(10, 0),
            end_time=datetime.time(10, 30),
            user=self.staff_user_a
        )
        self.assertEqual(learning.duration_minutes, 30)
        self.assertEqual(learning.learning_area, "Cognitive")

        # Outdoor play
        outdoor = DailyReportService.add_activity_entry(
            daily_report=report,
            activity_type="Outdoor Play",
            activity_category="Outdoor Play",
            name="Playground Sandbox",
            description="Built sandcastles and ran on grass",
            participation="High",
            start_time=datetime.time(11, 0),
            end_time=datetime.time(11, 45),
            user=self.staff_user_a
        )
        self.assertEqual(outdoor.duration_minutes, 45)
        self.assertEqual(report.activities.count(), 2)

    def test_07_temperature_validation(self):
        """Test recording temperature and validating physiological ranges"""
        report = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )

        # Valid Celsius (36.8°C)
        t1 = DailyReportService.add_temperature_entry(
            daily_report=report,
            temperature_value="36.80",
            unit="Celsius",
            time=datetime.time(8, 45),
            method="Forehead",
            notes="Normal check",
            user=self.staff_user_a
        )
        self.assertEqual(float(t1.temperature_value), 36.8)

        # Valid Fahrenheit (98.6°F)
        t2 = DailyReportService.add_temperature_entry(
            daily_report=report,
            temperature_value="98.60",
            unit="Fahrenheit",
            time=datetime.time(13, 0),
            user=self.staff_user_a
        )
        self.assertEqual(float(t2.temperature_value), 98.6)

        # Invalid temperature (out of bounds)
        with self.assertRaises(ValidationError):
            DailyReportService.add_temperature_entry(
                daily_report=report,
                temperature_value="55.0",
                unit="Celsius",
                user=self.staff_user_a
            )

    def test_08_notes_and_photos(self):
        """Test adding staff notes and photo references"""
        report = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )

        note = DailyReportService.add_note_entry(
            daily_report=report,
            category="Reminder",
            note_text="Please bring extra diapers tomorrow",
            time=datetime.time(16, 0),
            user=self.staff_user_a
        )
        self.assertEqual(note.category, "Reminder")
        self.assertEqual(report.staff_notes.count(), 1)

        photo = DailyReportService.add_photo_entry(
            daily_report=report,
            student=self.student_1,
            photo_url="https://example.com/photos/painting.jpg",
            caption="Tommy painting a rainbow",
            activity_context="Creative Arts",
            file_size=102400,
            user=self.staff_user_a
        )
        self.assertEqual(photo.caption, "Tommy painting a rainbow")
        self.assertEqual(report.photos.count(), 1)

    def test_09_status_transitions(self):
        """Test report transitions from Draft -> Completed -> Published"""
        report = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )
        self.assertEqual(report.status, 'Draft')

        DailyReportService.complete_report(report, user=self.staff_user_a)
        self.assertEqual(report.status, 'Completed')
        self.assertIsNotNone(report.completed_at)

        DailyReportService.publish_report(report, user=self.staff_user_a)
        self.assertEqual(report.status, 'Published')
        self.assertIsNotNone(report.published_at)

    def test_10_medication_and_incident_linkage(self):
        """Test that serializer includes active medications and incidents for that child and date"""
        # Create a medication administration
        med = Medication.objects.create(
            student=self.student_1,
            medication_name="Amoxicillin",
            dosage="5ml",
            start_date=self.today,
            end_date=self.today
        )
        MedicationAdministration.objects.create(
            medication=med,
            dosage_given="5ml",
            date=self.today,
            time=datetime.time(12, 0),
            administered_by=self.staff_user_a,
            teacher_notes="Given with food"
        )

        # Create an incident
        IncidentReport.objects.create(
            daycare=self.daycare_a,
            student=self.student_1,
            reporting_employee=self.employee_a,
            activity_date=self.today,
            time=datetime.time(11, 15),
            incident_type="Fall",
            description="Tripped on playground grass",
            action_taken="Applied ice pack",
            severity="Low"
        )

        report = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )

        self.client.force_authenticate(user=self.staff_user_a)
        res = self.client.get(f'/api/daycare/daily-reports/{report.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['medications']), 1)
        self.assertEqual(res.data['medications'][0]['medication_name'], "Amoxicillin")
        self.assertEqual(len(res.data['incidents']), 1)
        self.assertEqual(res.data['incidents'][0]['incident_type'], "Fall")

    # -------------------------------------------------------------
    # 2. REST API & Endpoint Tests
    # -------------------------------------------------------------
    def test_11_api_get_or_create_endpoint(self):
        """Test API endpoint POST /api/daycare/daily-reports/get-or-create/"""
        self.client.force_authenticate(user=self.staff_user_a)
        res = self.client.post('/api/daycare/daily-reports/get-or-create/', {
            'student_id': str(self.student_2.id),
            'date': self.today.isoformat(),
            'classroom_id': str(self.classroom_a.id)
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(str(res.data['student']), str(self.student_2.id))
        self.assertEqual(res.data['classroom_name'], "Toddler Explorers")

    def test_12_api_add_entries_flow(self):
        """Test logging all types of entries via REST API"""
        self.client.force_authenticate(user=self.staff_user_a)
        rep_res = self.client.post('/api/daycare/daily-reports/get-or-create/', {
            'student_id': str(self.student_1.id),
            'date': self.today.isoformat()
        })
        rep_id = rep_res.data['id']

        # Add Meal
        m_res = self.client.post(f'/api/daycare/daily-reports/{rep_id}/meals/', {
            'meal_type': 'Lunch',
            'food_provided': 'Pasta & peas',
            'amount_eaten': 'Most',
            'time': '12:00:00'
        })
        self.assertEqual(m_res.status_code, status.HTTP_201_CREATED)

        # Add Nap
        n_res = self.client.post(f'/api/daycare/daily-reports/{rep_id}/naps/', {
            'start_time': '13:00',
            'end_time': '14:30',
            'quality': 'Slept'
        })
        self.assertEqual(n_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(n_res.data['duration_minutes'], 90)

        # Add Toileting
        t_res = self.client.post(f'/api/daycare/daily-reports/{rep_id}/toileting/', {
            'type': 'Diaper',
            'condition': 'Wet',
            'time': '14:45'
        })
        self.assertEqual(t_res.status_code, status.HTTP_201_CREATED)

        # Add Mood
        mood_res = self.client.post(f'/api/daycare/daily-reports/{rep_id}/moods/', {
            'mood': 'Playful',
            'notes': 'Loved the sandbox'
        })
        self.assertEqual(mood_res.status_code, status.HTTP_201_CREATED)

        # Add Temperature
        temp_res = self.client.post(f'/api/daycare/daily-reports/{rep_id}/temperatures/', {
            'temperature_value': '36.90',
            'unit': 'Celsius',
            'method': 'Forehead'
        })
        self.assertEqual(temp_res.status_code, status.HTTP_201_CREATED)

        # Add Note
        note_res = self.client.post(f'/api/daycare/daily-reports/{rep_id}/notes/', {
            'category': 'General',
            'note_text': 'Great participation today!'
        })
        self.assertEqual(note_res.status_code, status.HTTP_201_CREATED)

        # Complete & Publish
        c_res = self.client.post(f'/api/daycare/daily-reports/{rep_id}/complete/')
        self.assertEqual(c_res.status_code, status.HTTP_200_OK)
        self.assertEqual(c_res.data['status'], 'Completed')

        p_res = self.client.post(f'/api/daycare/daily-reports/{rep_id}/publish/')
        self.assertEqual(p_res.status_code, status.HTTP_200_OK)
        self.assertEqual(p_res.data['status'], 'Published')

    def test_13_api_delete_entry(self):
        """Test deleting an entry via API"""
        report = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )
        meal = DailyReportService.add_meal_entry(
            daily_report=report, meal_type="Breakfast", food_provided="Eggs", user=self.staff_user_a
        )

        self.client.force_authenticate(user=self.staff_user_a)
        del_res = self.client.delete(f'/api/daycare/daily-reports/{report.id}/entries/meals/{meal.id}/')
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertEqual(report.meals.count(), 0)

    def test_14_api_roster_matrix(self):
        """Test GET /api/daycare/daily-reports/roster/"""
        # Create report for student 1
        DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )

        self.client.force_authenticate(user=self.staff_user_a)
        res = self.client.get(f'/api/daycare/daily-reports/roster/?classroom_id={self.classroom_a.id}&date={self.today.isoformat()}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2) # student_1 and student_2 in classroom_a

        s1_data = next(item for item in res.data if item['child_id'] == str(self.student_1.id))
        self.assertEqual(s1_data['attendance_status'], 'PRESENT')
        self.assertEqual(s1_data['report_status'], 'Draft')

        s2_data = next(item for item in res.data if item['child_id'] == str(self.student_2.id))
        self.assertEqual(s2_data['attendance_status'], 'Unrecorded')
        self.assertEqual(s2_data['report_status'], 'No Report')

    def test_15_security_and_multi_tenancy(self):
        """Test cross-tenant isolation and guardian restrictions"""
        report_a = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )

        # Daycare B admin cannot access Daycare A report
        self.client.force_authenticate(user=self.admin_user_b)
        res_b = self.client.get(f'/api/daycare/daily-reports/{report_a.id}/')
        self.assertEqual(res_b.status_code, status.HTTP_404_NOT_FOUND)

        # Guardian cannot create or mutate reports
        self.client.force_authenticate(user=self.guardian_user_a)
        res_g = self.client.post('/api/daycare/daily-reports/get-or-create/', {
            'student_id': str(self.student_1.id),
            'date': self.today.isoformat()
        })
        self.assertEqual(res_g.status_code, status.HTTP_403_FORBIDDEN)

    def test_16_audit_logging(self):
        """Test that AuditLog tracks daily report creation and modifications"""
        initial_count = AuditLog.objects.filter(module='DailyReports').count()

        report = DailyReportService.get_or_create_daily_report(
            self.daycare_a, self.student_1, self.today, self.staff_user_a
        )
        DailyReportService.add_meal_entry(
            daily_report=report, meal_type="Snack", food_provided="Banana", user=self.staff_user_a
        )

        new_count = AuditLog.objects.filter(module='DailyReports').count()
        self.assertGreater(new_count, initial_count)
