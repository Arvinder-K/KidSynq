import datetime
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    User, Daycare, Student, Classroom, ClassroomStudent, AgeGroup,
    StudentAttendance, DailyReport, MealRecord, NapRecord,
    ToiletingRecord, ActivityRecord, MoodRecord, DailyTemperatureRecord,
    DailyNoteRecord, DailyPhotoRecord, IncidentReport, Employee,
    Medication, MedicationAdministration, Family, Guardian, FamilyGuardian,
    FamilyChild, StaffNotification, AuditLog
)
from daycare.services.daily_reports import DailyReportService


class DailyChildReportsPhase2Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.now().date()
        self.today_str = self.today.isoformat()

        # Daycare setup
        self.daycare = Daycare.objects.create(name="Sunshine Academy", status="Active")

        # Admin / Teacher User
        self.teacher_user = User.objects.create_user(
            username="teacher_sarah",
            email="sarah@sunshine.test",
            password="testpassword123",
            daycare=self.daycare,
            first_name="Sarah",
            last_name="Connor"
        )
        self.teacher_user.role = "Daycare Admin"
        self.teacher_user.save()

        # Teacher Employee Profile
        self.teacher_employee = Employee.objects.create(
            daycare=self.daycare,
            user=self.teacher_user,
            first_name="Sarah",
            last_name="Connor",
            role="Lead Teacher",
            status="active"
        )

        # Classroom
        self.age_group = AgeGroup.objects.create(
            daycare=self.daycare,
            name="Toddlers",
            min_age_months=18,
            max_age_months=36
        )
        self.classroom = Classroom.objects.create(
            daycare=self.daycare,
            room_name="Blue Butterflies",
            capacity=15,
            age_group=self.age_group,
            primary_teacher=self.teacher_user
        )

        # Children
        self.child1 = Student.objects.create(
            daycare=self.daycare,
            first_name="Leo",
            last_name="Miller",
            preferred_name="Leo",
            status="Active",
            dob=datetime.date(2023, 1, 15)
        )
        self.child2 = Student.objects.create(
            daycare=self.daycare,
            first_name="Maya",
            last_name="Lin",
            preferred_name="Maya",
            status="Active",
            dob=datetime.date(2023, 3, 20)
        )

        ClassroomStudent.objects.create(classroom=self.classroom, student=self.child1, status="Active")
        ClassroomStudent.objects.create(classroom=self.classroom, student=self.child2, status="Active")

        # Guardian User & Family (Child 1)
        self.guardian_user = User.objects.create_user(
            username="guardian_david",
            email="david.miller@example.test",
            password="testpassword123",
            daycare=self.daycare,
            first_name="David",
            last_name="Miller"
        )
        self.guardian_user.role = "Guardian"
        self.guardian_user.guardian = True
        self.guardian_user.save()

        self.guardian_profile = Guardian.objects.create(
            daycare=self.daycare,
            user=self.guardian_user,
            first_name="David",
            last_name="Miller",
            email="david.miller@example.test",
            phone="555-0199"
        )
        self.family = Family.objects.create(
            daycare=self.daycare,
            family_name="Miller Family"
        )
        FamilyGuardian.objects.create(family=self.family, guardian=self.guardian_profile, relationship="Father", is_primary=True)
        FamilyChild.objects.create(family=self.family, student=self.child1)

        # Other Guardian User (Child 2)
        self.other_guardian_user = User.objects.create_user(
            username="guardian_emily",
            email="emily.lin@example.test",
            password="testpassword123",
            daycare=self.daycare,
            first_name="Emily",
            last_name="Lin"
        )
        self.other_guardian_user.role = "Guardian"
        self.other_guardian_user.guardian = True
        self.other_guardian_user.save()

        self.other_guardian_profile = Guardian.objects.create(
            daycare=self.daycare,
            user=self.other_guardian_user,
            first_name="Emily",
            last_name="Lin",
            email="emily.lin@example.test",
            phone="555-0288"
        )
        self.other_family = Family.objects.create(
            daycare=self.daycare,
            family_name="Lin Family"
        )
        FamilyGuardian.objects.create(family=self.other_family, guardian=self.other_guardian_profile, relationship="Mother", is_primary=True)
        FamilyChild.objects.create(family=self.other_family, student=self.child2)

        # Attendance Records
        self.att1 = StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child1,
            attendance_date=self.today,
            attendance_status='PRESENT',
            check_in_time=datetime.time(8, 30),
            check_out_time=datetime.time(16, 45)
        )
        self.att2 = StudentAttendance.objects.create(
            daycare=self.daycare,
            student=self.child2,
            attendance_date=self.today,
            attendance_status='PRESENT',
            check_in_time=datetime.time(9, 0)
        )

        # Medications
        self.medication1 = Medication.objects.create(
            student=self.child1,
            medication_name="Allergy Relief",
            dosage="5ml",
            frequency="Daily",
            start_date=self.today
        )
        self.medication2 = Medication.objects.create(
            student=self.child1,
            medication_name="Amoxicillin",
            dosage="10mg",
            frequency="Twice daily",
            start_date=self.today
        )

    # =========================================================================
    # Test 1: Complete 16-Section Report Generation with Stored Data
    # =========================================================================
    def test_complete_16_section_daily_report_generation(self):
        report = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare,
            student=self.child1,
            report_date=self.today_str,
            user=self.teacher_user,
            classroom_id=str(self.classroom.id)
        )

        # Add care entries across domains
        DailyReportService.add_meal_entry(
            daily_report=report,
            meal_type='Lunch',
            meal_category='Meal',
            food_provided='Organic turkey meatballs & brown rice',
            amount_eaten='All',
            time=datetime.time(12, 0),
            notes='Ate enthusiastically',
            user=self.teacher_user
        )
        DailyReportService.add_meal_entry(
            daily_report=report,
            meal_type='Snack',
            meal_category='Snack',
            food_provided='Apple slices & cheddar cheese',
            amount_eaten='Most',
            time=datetime.time(15, 0),
            notes='',
            user=self.teacher_user
        )
        DailyReportService.add_nap_entry(
            daily_report=report,
            start_time='12:45:00',
            end_time='14:30:00',
            quality='Slept Well',
            notes='Fell asleep quickly with story',
            user=self.teacher_user
        )
        DailyReportService.add_toileting_entry(
            daily_report=report,
            record_type='Diaper',
            condition='Wet',
            time=datetime.time(10, 15),
            notes='',
            user=self.teacher_user
        )
        DailyReportService.add_toileting_entry(
            daily_report=report,
            record_type='Toilet',
            condition='Dry',
            assistance_level='Prompted',
            time=datetime.time(14, 45),
            notes='Great potty try!',
            user=self.teacher_user
        )
        DailyReportService.add_mood_entry(
            daily_report=report,
            mood='Happy',
            time=datetime.time(9, 30),
            notes='Smiling during circle time',
            user=self.teacher_user
        )
        DailyReportService.add_activity_entry(
            daily_report=report,
            activity_type='Fine Motor',
            name='Finger Painting Butterflies',
            description='Mixed blue and yellow paint to create green patterns',
            teacher_notes='Showed excellent color recognition',
            start_time=datetime.time(10, 30),
            end_time=datetime.time(11, 15),
            learning_area='Creative Arts & Expression',
            participation='Active',
            user=self.teacher_user
        )
        DailyReportService.add_activity_entry(
            daily_report=report,
            activity_type='Outdoor Play',
            name='Playground Sandbox & Slides',
            description='Enjoyed building sandcastles with friends',
            start_time=datetime.time(11, 15),
            end_time=datetime.time(11, 45),
            user=self.teacher_user
        )
        DailyReportService.add_temperature_entry(
            daily_report=report,
            temperature_value='36.6',
            unit='Celsius',
            time=datetime.time(8, 45),
            method='Forehead',
            notes='Normal wellness check',
            user=self.teacher_user
        )
        DailyReportService.add_note_entry(
            daily_report=report,
            category='Supplies Needed',
            note_text='Please bring extra diapers for next week.',
            user=self.teacher_user
        )
        DailyReportService.add_photo_entry(
            daily_report=report,
            student=self.child1,
            photo_url='https://example.com/photos/leo_painting.jpg',
            caption='Leo having fun with water colors!',
            activity_context='Art Time',
            user=self.teacher_user
        )

        # Add Medication Administration (Module 11 integration)
        MedicationAdministration.objects.create(
            medication=self.medication1,
            date=self.today,
            time=datetime.time(13, 0),
            dosage_given='5ml (Allergy Relief)',
            administered_by=self.teacher_user,
            teacher_notes='Internal note: check for drowsiness'
        )

        # Publish report
        DailyReportService.publish_report(report, user=self.teacher_user)

        # Test Staff View via API
        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.get(f"/api/daycare/daily-reports/{report.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        self.assertEqual(data['student_name'], 'Leo Miller')
        self.assertEqual(data['status'], 'Published')
        self.assertEqual(len(data['meals']), 2)
        self.assertEqual(len(data['naps']), 1)
        self.assertEqual(len(data['toileting']), 2)
        self.assertEqual(len(data['activities']), 2)
        self.assertEqual(len(data['moods']), 1)
        self.assertEqual(len(data['temperatures']), 1)
        self.assertEqual(len(data['staff_notes']), 1)
        self.assertEqual(len(data['photos']), 1)
        self.assertEqual(len(data['medications']), 1)

    # =========================================================================
    # Test 2: Child Header & Attendance Check-In/Out Integration
    # =========================================================================
    def test_child_header_and_attendance_integration(self):
        report = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare,
            student=self.child1,
            report_date=self.today_str,
            user=self.teacher_user
        )
        DailyReportService.publish_report(report, user=self.teacher_user)

        # Guardian fetch
        self.client.force_authenticate(user=self.guardian_user)
        response = self.client.get(f"/api/family/daily-reports/{self.child1.id}/{self.today_str}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        self.assertEqual(data['child_name'], 'Leo Miller')
        self.assertEqual(data['preferred_name'], 'Leo')
        self.assertEqual(data['classroom_name'], 'Blue Butterflies')
        self.assertEqual(data['attendance_status'], 'PRESENT')
        self.assertEqual(data['check_in_time'], '08:30 AM')
        self.assertEqual(data['check_out_time'], '04:45 PM')

    # =========================================================================
    # Test 3: Missing Care Domain Handling (No Fake Data)
    # =========================================================================
    def test_missing_care_domains_return_clean_empty_values(self):
        # Create empty report for child2
        report = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare,
            student=self.child2,
            report_date=self.today_str,
            user=self.teacher_user
        )
        DailyReportService.publish_report(report, user=self.teacher_user)

        self.client.force_authenticate(user=self.other_guardian_user)
        response = self.client.get(f"/api/family/daily-reports/{self.child2.id}/{self.today_str}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        # Must not fabricate data
        self.assertEqual(data['meals'], [])
        self.assertEqual(data['snacks'], [])
        self.assertEqual(data['naps'], [])
        self.assertEqual(data['diapers'], [])
        self.assertEqual(data['toileting'], [])
        self.assertEqual(data['moods'], [])
        self.assertEqual(data['activities'], [])
        self.assertEqual(data['temperatures'], [])
        self.assertEqual(data['medications'], [])
        self.assertEqual(data['incidents'], [])
        self.assertEqual(data['photos'], [])

    # =========================================================================
    # Test 4: Care Summary and Completion Checklist Engine
    # =========================================================================
    def test_care_summary_and_checklist_calculation(self):
        report = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare,
            student=self.child1,
            report_date=self.today_str,
            user=self.teacher_user
        )

        DailyReportService.add_meal_entry(report, meal_type='Lunch', food_provided='Chicken Rice', user=self.teacher_user)
        DailyReportService.add_nap_entry(report, start_time='13:00:00', end_time='14:00:00', user=self.teacher_user)
        DailyReportService.add_mood_entry(report, mood='Joyful', user=self.teacher_user)

        checklist = DailyReportService.get_report_completion_checklist(report)
        self.assertGreaterEqual(checklist['total_domains'], 8)
        self.assertEqual(checklist['recorded_count'], 3)
        self.assertEqual(checklist['completion_percentage'], 60)
        self.assertEqual(checklist['domains']['meals']['status'], 'Recorded')
        self.assertEqual(checklist['domains']['naps']['status'], 'Recorded')
        self.assertEqual(checklist['domains']['moods']['status'], 'Recorded')
        self.assertEqual(checklist['domains']['toileting']['status'], 'Not Recorded')

        # API checklist endpoint
        self.client.force_authenticate(user=self.teacher_user)
        res = self.client.get(f"/api/daycare/daily-reports/{report.id}/checklist/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['recorded_count'], 3)

    # =========================================================================
    # Test 5: Strict Guardian Privacy & Access Authorization
    # =========================================================================
    def test_guardian_access_control_and_privacy(self):
        report1 = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare,
            student=self.child1,
            report_date=self.today_str,
            user=self.teacher_user
        )
        # Leave as Draft
        report1.status = 'Draft'
        report1.save()

        # 1. Unauthenticated request blocked
        self.client.force_authenticate(user=None)
        res = self.client.get(f"/api/family/daily-reports/{self.child1.id}/{self.today_str}/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Guardian accessing draft report blocked (404/not available)
        self.client.force_authenticate(user=self.guardian_user)
        res = self.client.get(f"/api/family/daily-reports/{self.child1.id}/{self.today_str}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Now publish report 1
        DailyReportService.publish_report(report1, user=self.teacher_user)

        # 3. Guardian 1 can view published report for Child 1
        res = self.client.get(f"/api/family/daily-reports/{self.child1.id}/{self.today_str}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # 4. Guardian 1 cannot access Child 2's report
        res = self.client.get(f"/api/family/daily-reports/{self.child2.id}/{self.today_str}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # =========================================================================
    # Test 6: Sanitization of Medication & Incident Reports for Parents
    # =========================================================================
    def test_sanitization_of_sensitive_health_and_incident_data(self):
        report = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare,
            student=self.child1,
            report_date=self.today_str,
            user=self.teacher_user
        )

        MedicationAdministration.objects.create(
            medication=self.medication2,
            date=self.today,
            time=datetime.time(11, 30),
            dosage_given='10mg Amoxicillin',
            administered_by=self.teacher_user,
            teacher_notes='INTERNAL CONFIDENTIAL: Child vomited earlier.'
        )

        IncidentReport.objects.create(
            daycare=self.daycare,
            student=self.child1,
            reporting_employee=self.teacher_employee,
            activity_date=self.today,
            time=datetime.time(10, 0),
            incident_type='Minor Scrape',
            description='Scraped knee while running on playground.',
            action_taken='Washed with soap and applied adhesive bandage.',
            severity='Low'
        )

        DailyReportService.publish_report(report, user=self.teacher_user)

        self.client.force_authenticate(user=self.guardian_user)
        res = self.client.get(f"/api/family/daily-reports/{self.child1.id}/{self.today_str}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Verify medication does not contain internal staff notes
        med = res.data['medications'][0]
        self.assertEqual(med['dosage_given'], '10mg Amoxicillin')
        self.assertNotIn('teacher_notes', med)
        self.assertNotIn('INTERNAL CONFIDENTIAL', str(med))

        # Verify incident contains parent-facing details only
        inc = res.data['incidents'][0]
        self.assertEqual(inc['incident_type'], 'Minor Scrape')
        self.assertEqual(inc['action_taken'], 'Washed with soap and applied adhesive bandage.')

    # =========================================================================
    # Test 7: Report Publication and In-App Notification Dispatch
    # =========================================================================
    def test_publication_triggers_non_duplicate_notifications(self):
        report = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare,
            student=self.child1,
            report_date=self.today_str,
            user=self.teacher_user
        )

        # Publish report
        DailyReportService.publish_report(report, user=self.teacher_user)

        # Check in-app notification created for guardian
        notifs = StaffNotification.objects.filter(
            user=self.guardian_user,
            notification_type='daily_report_published'
        )
        self.assertEqual(notifs.count(), 1)
        self.assertIn("Daily Report Available", notifs.first().title)
        self.assertIn("Leo's daily report", notifs.first().message)

        # Re-publish report - verify no duplicate notification created
        DailyReportService.publish_report(report, user=self.teacher_user)
        self.assertEqual(
            StaffNotification.objects.filter(
                user=self.guardian_user,
                notification_type='daily_report_published'
            ).count(),
            1
        )

    # =========================================================================
    # Test 8: Daycare Daily Reports Dashboard Summary
    # =========================================================================
    def test_daycare_dashboard_summary_kpis(self):
        report1 = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare,
            student=self.child1,
            report_date=self.today_str,
            user=self.teacher_user,
            classroom_id=str(self.classroom.id)
        )
        DailyReportService.publish_report(report1, user=self.teacher_user)

        # Child 2 is present but has no report started
        self.client.force_authenticate(user=self.teacher_user)
        res = self.client.get(f"/api/daycare/daily-reports/dashboard/?date={self.today_str}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        kpis = res.data['kpis']
        self.assertEqual(kpis['total_present'], 2)
        self.assertEqual(kpis['total_published'], 1)
        self.assertEqual(kpis['total_pending'], 1)
        self.assertEqual(len(res.data['classrooms']), 1)
        self.assertEqual(len(res.data['pending_children']), 1)
        self.assertEqual(res.data['pending_children'][0]['child_name'], 'Maya Lin')

    # =========================================================================
    # Test 9: Historical Search Endpoint & Filters
    # =========================================================================
    def test_historical_search_and_filters(self):
        report = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare,
            student=self.child1,
            report_date=self.today_str,
            user=self.teacher_user,
            classroom_id=str(self.classroom.id)
        )
        DailyReportService.publish_report(report, user=self.teacher_user)

        self.client.force_authenticate(user=self.teacher_user)
        # Search by date range and status
        res = self.client.get(
            f"/api/daycare/daily-reports/history/?start_date={self.today_str}&end_date={self.today_str}&status=Published"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['student_name'], 'Leo Miller')

        # Filter by different status (Draft) -> 0 results
        res_empty = self.client.get(
            f"/api/daycare/daily-reports/history/?start_date={self.today_str}&end_date={self.today_str}&status=Draft"
        )
        self.assertEqual(res_empty.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_empty.data), 0)

    # =========================================================================
    # Test 10: Export / Print Endpoint & Audit Logging
    # =========================================================================
    def test_export_report_and_audit_logging(self):
        report = DailyReportService.get_or_create_daily_report(
            daycare=self.daycare,
            student=self.child1,
            report_date=self.today_str,
            user=self.teacher_user
        )
        DailyReportService.publish_report(report, user=self.teacher_user)

        self.client.force_authenticate(user=self.teacher_user)
        res = self.client.get(f"/api/daycare/daily-reports/{report.id}/export/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['child_name'], 'Leo Miller')

        # Verify audit log recorded
        audit = AuditLog.objects.filter(
            action='EXPORT',
            entity_type='DailyReport',
            entity_id=str(report.id)
        ).first()
        self.assertIsNotNone(audit)
