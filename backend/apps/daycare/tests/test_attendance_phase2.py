import uuid
from datetime import date, time, datetime, timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Daycare, Branch, Student, Classroom, ClassroomStudent,
    ChildEnrollment, StudentAttendance, Employee, StudentPickup,
    AuditLog, Document, DocumentFolder, Guardian
)

User = get_user_model()


class AttendancePhase2TestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Daycares
        self.daycare_a = Daycare.objects.create(
            name="Sunrise Academy",
            status="Active",
            opening_time=time(8, 0),
            closing_time=time(17, 0)
        )
        self.daycare_b = Daycare.objects.create(
            name="Starlight Childcare",
            status="Active",
            opening_time=time(8, 0),
            closing_time=time(17, 0)
        )

        # Create Branches
        self.branch_a = Branch.objects.create(
            daycare=self.daycare_a,
            name="Main Branch"
        )

        # Create Users
        self.admin_user_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@sunrise.com",
            password="password123",
            daycare=self.daycare_a,
            is_staff=True
        )
        self.emp_admin_a = Employee.objects.create(
            daycare=self.daycare_a,
            user=self.admin_user_a,
            first_name="Admin",
            last_name="A",
            role="Daycare Admin",
            status="Active"
        )

        self.staff_user_a = User.objects.create_user(
            username="staff_a",
            email="staff_a@sunrise.com",
            password="password123",
            daycare=self.daycare_a,
            is_staff=False
        )
        self.emp_staff_a = Employee.objects.create(
            daycare=self.daycare_a,
            user=self.staff_user_a,
            first_name="Staff",
            last_name="A",
            role="Staff",
            status="Active"
        )

        self.guardian_user_a = User.objects.create_user(
            username="guardian_a",
            email="guardian_a@sunrise.com",
            password="password123",
            daycare=self.daycare_a,
            is_staff=False
        )
        self.guardian_profile_a = Guardian.objects.create(
            user=self.guardian_user_a,
            daycare=self.daycare_a,
            first_name="Parent",
            last_name="Guardian",
            email="guardian_a@sunrise.com",
            status="Active"
        )

        self.admin_user_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@starlight.com",
            password="password123",
            daycare=self.daycare_b,
            is_staff=True
        )
        self.emp_admin_b = Employee.objects.create(
            daycare=self.daycare_b,
            user=self.admin_user_b,
            first_name="Admin",
            last_name="B",
            role="Daycare Admin",
            status="Active"
        )

        # Create Classroom
        self.classroom_toddler = Classroom.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            room_name="Toddler Explorers",
            room_code="TOD-01",
            capacity=15,
            status="Active"
        )

        self.classroom_preschool = Classroom.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            room_name="Preschool Stars",
            room_code="PRE-01",
            capacity=20,
            status="Active"
        )

        # Create Students
        self.student_1 = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            first_name="Leo",
            last_name="Johnson",
            dob=date(2022, 5, 10),
            admission_number="ADM-001",
            status="Active"
        )
        self.student_2 = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            first_name="Maya",
            last_name="Smith",
            dob=date(2021, 3, 15),
            admission_number="ADM-002",
            status="Active"
        )
        self.student_3 = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            first_name="Noah",
            last_name="Williams",
            dob=date(2023, 1, 20),
            admission_number="ADM-003",
            status="Active"
        )

        # Assign Classrooms
        ClassroomStudent.objects.create(
            classroom=self.classroom_toddler,
            student=self.student_1,
            start_date=date(2026, 1, 1),
            status='Active'
        )
        ClassroomStudent.objects.create(
            classroom=self.classroom_toddler,
            student=self.student_2,
            start_date=date(2026, 1, 1),
            status='Active'
        )
        ClassroomStudent.objects.create(
            classroom=self.classroom_preschool,
            student=self.student_3,
            start_date=date(2026, 1, 1),
            status='Active'
        )

        # Enrollments
        ChildEnrollment.objects.create(
            student=self.student_1,
            start_date=date(2026, 1, 1),
            status='Active'
        )
        ChildEnrollment.objects.create(
            student=self.student_2,
            start_date=date(2026, 1, 1),
            status='Active'
        )
        ChildEnrollment.objects.create(
            student=self.student_3,
            start_date=date(2026, 1, 1),
            status='Active'
        )

        # Daycare B Student
        self.student_b = Student.objects.create(
            daycare=self.daycare_b,
            first_name="Ethan",
            last_name="Davis",
            status="Active"
        )

    def test_mark_absent_records_lifecycle(self):
        """Test marking a child as absent records status, reason, audit, and prevents simultaneous PRESENT"""
        self.client.force_authenticate(user=self.staff_user_a)
        target_date = "2026-09-10"

        url = "/api/daycare/attendance/mark-absent/"
        response = self.client.post(url, {
            "student_id": str(self.student_1.id),
            "date": target_date,
            "remarks": "Child has a fever and stayed home"
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['attendance_status'], "ABSENT")
        self.assertIsNone(response.data['check_in_time'])
        self.assertIsNone(response.data['check_out_time'])

        # Verify only 1 record exists in DB for this child and date
        records = StudentAttendance.objects.filter(student=self.student_1, attendance_date=target_date)
        self.assertEqual(records.count(), 1)
        self.assertEqual(records.first().attendance_status, "ABSENT")

        # Verify AuditLog created
        audit = AuditLog.objects.filter(
            entity_id=str(records.first().id),
            action="CHILD_MARK_ABSENT"
        ).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.user, self.staff_user_a)

    def test_mark_excused_absence_with_reason_and_document(self):
        """Test marking an excused absence with categorized reason and document attachment"""
        self.client.force_authenticate(user=self.staff_user_a)
        target_date = "2026-09-11"

        # Create a document
        doc = Document.objects.create(
            daycare=self.daycare_a,
            title="Doctor_Note_Medical_Exemption.pdf",
            file_type="application/pdf",
            uploaded_by=self.staff_user_a
        )

        url = "/api/daycare/attendance/mark-excused/"
        response = self.client.post(url, {
            "student_id": str(self.student_1.id),
            "date": target_date,
            "excused_reason_type": "MEDICAL",
            "supporting_document_id": str(doc.id),
            "remarks": "Approved pediatrician appointment"
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['attendance_status'], "EXCUSED_ABSENCE")
        self.assertEqual(response.data['excused_reason_type'], "MEDICAL")
        self.assertEqual(str(response.data['supporting_document']), str(doc.id))
        self.assertEqual(response.data['supporting_document_title'], "Doctor_Note_Medical_Exemption.pdf")

        # Verify DB
        rec = StudentAttendance.objects.get(student=self.student_1, attendance_date=target_date)
        self.assertEqual(rec.excused_reason_type, "MEDICAL")
        self.assertEqual(rec.supporting_document, doc)

        # Verify AuditLog
        audit = AuditLog.objects.filter(entity_id=str(rec.id), action="CHILD_MARK_EXCUSED").first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.new_values['excused_reason_type'], "MEDICAL")

    def test_controlled_correction_success(self):
        """Test controlled attendance correction by Daycare Admin with mandatory reason and AuditLog snapshot"""
        # Create an initial check-in
        att = StudentAttendance.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            student=self.student_1,
            classroom=self.classroom_toddler,
            attendance_date=date(2026, 9, 12),
            attendance_status="PRESENT",
            check_in_time=time(9, 15),
            is_late=True,
            late_reason="Traffic",
            created_by=self.staff_user_a
        )

        # Perform correction as Daycare Admin
        self.client.force_authenticate(user=self.admin_user_a)
        url = f"/api/daycare/attendance/records/{att.id}/correct/"
        response = self.client.post(url, {
            "check_in_time": "08:00:00",
            "check_out_time": "17:00:00",
            "attendance_status": "PRESENT",
            "is_late": False,
            "late_reason": "",
            "correction_reason": "Parent called explaining child was actually checked in at 8am by substitute teacher",
            "remarks": "Corrected time based on gate entry log"
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_corrected'])
        self.assertEqual(response.data['correction_reason'], "Parent called explaining child was actually checked in at 8am by substitute teacher")
        self.assertEqual(response.data['check_in_time'], "08:00:00")
        self.assertEqual(response.data['check_out_time'], "17:00:00")
        self.assertFalse(response.data['is_late'])

        # Verify DB state
        att.refresh_from_db()
        self.assertTrue(att.is_corrected)
        self.assertEqual(att.corrected_by, self.admin_user_a)
        self.assertIsNotNone(att.corrected_at)
        self.assertEqual(att.check_in_time, time(8, 0))

        # Verify AuditLog with CORRECTION action and diff snapshots
        audit = AuditLog.objects.filter(entity_id=str(att.id), action="CORRECTION").first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.user, self.admin_user_a)
        self.assertEqual(audit.old_values['check_in_time'], "09:15:00")
        self.assertEqual(audit.new_values['check_in_time'], "08:00:00")
        self.assertEqual(audit.new_values['correction_reason'], "Parent called explaining child was actually checked in at 8am by substitute teacher")

    def test_correction_reason_mandatory(self):
        """Test that correction without a valid reason is strictly rejected with a 400 error"""
        att = StudentAttendance.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            student=self.student_1,
            classroom=self.classroom_toddler,
            attendance_date=date(2026, 9, 12),
            attendance_status="PRESENT",
            check_in_time=time(9, 0),
            created_by=self.staff_user_a
        )

        self.client.force_authenticate(user=self.admin_user_a)
        url = f"/api/daycare/attendance/records/{att.id}/correct/"

        # 1. Missing correction_reason
        response = self.client.post(url, {
            "check_in_time": "08:30:00"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Empty string correction_reason
        response = self.client.post(url, {
            "check_in_time": "08:30:00",
            "correction_reason": "   "
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_correction_permission_restrictions(self):
        """Test that regular staff without admin permissions cannot perform corrections"""
        att = StudentAttendance.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            student=self.student_1,
            classroom=self.classroom_toddler,
            attendance_date=date(2026, 9, 12),
            attendance_status="PRESENT",
            check_in_time=time(9, 0),
            created_by=self.staff_user_a
        )

        self.client.force_authenticate(user=self.staff_user_a)
        url = f"/api/daycare/attendance/records/{att.id}/correct/"
        response = self.client.post(url, {
            "check_in_time": "08:30:00",
            "correction_reason": "Trying to modify without admin permissions"
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_guardian_cannot_modify_attendance(self):
        """Test that family/guardian users cannot create or correct attendance"""
        self.client.force_authenticate(user=self.guardian_user_a)

        # Check-in attempt blocked
        res = self.client.post("/api/daycare/attendance/check-in/", {
            "student_id": str(self.student_1.id),
            "date": "2026-09-15"
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Mark absent attempt blocked
        res = self.client.post("/api/daycare/attendance/mark-absent/", {
            "student_id": str(self.student_1.id),
            "date": "2026-09-15"
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_attendance_record_audit_trail_endpoint(self):
        """Test retrieving the full chronological audit history for an attendance record"""
        att = StudentAttendance.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a,
            student=self.student_1,
            classroom=self.classroom_toddler,
            attendance_date=date(2026, 9, 13),
            attendance_status="PRESENT",
            check_in_time=time(8, 30),
            created_by=self.staff_user_a
        )

        # Create Initial Check-in Audit
        AuditLog.objects.create(
            user=self.staff_user_a,
            user_type="Staff",
            action="CHILD_CHECK_IN",
            module="Attendance Management",
            entity_type="StudentAttendance",
            entity_id=str(att.id),
            new_values={"check_in_time": "08:30:00", "status": "PRESENT"}
        )

        # Create Correction Audit
        AuditLog.objects.create(
            user=self.admin_user_a,
            user_type="Daycare Admin",
            action="CORRECTION",
            module="Attendance Management",
            entity_type="StudentAttendance",
            entity_id=str(att.id),
            old_values={"check_in_time": "08:30:00"},
            new_values={"check_in_time": "08:15:00", "correction_reason": "Time adjusted"}
        )

        self.client.force_authenticate(user=self.staff_user_a)
        url = f"/api/daycare/attendance/records/{att.id}/audit/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['attendance_id'], str(att.id))
        self.assertEqual(len(response.data['logs']), 2)
        actions = [l['action'] for l in response.data['logs']]
        self.assertIn("CORRECTION", actions)
        self.assertIn("CHILD_CHECK_IN", actions)

    def test_monthly_attendance_matrix_calculation(self):
        """Test monthly matrix generation with status codes (P, A, E, L, EP) and summary aggregations"""
        target_year = 2026
        target_month = 9

        # Student 1:
        # Sep 1: Present (P)
        # Sep 2: Late (L)
        # Sep 3: Early Pickup (EP)
        # Sep 4: Absent (A)
        # Sep 5: Excused (E)
        StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.student_1,
            classroom=self.classroom_toddler,
            attendance_date=date(2026, 9, 1),
            attendance_status="PRESENT",
            check_in_time=time(8, 0),
            check_out_time=time(17, 0)
        )
        StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.student_1,
            classroom=self.classroom_toddler,
            attendance_date=date(2026, 9, 2),
            attendance_status="LATE",
            is_late=True,
            check_in_time=time(9, 30)
        )
        StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.student_1,
            classroom=self.classroom_toddler,
            attendance_date=date(2026, 9, 3),
            attendance_status="EARLY_PICKUP",
            is_early_pickup=True,
            check_in_time=time(8, 0),
            check_out_time=time(14, 0)
        )
        StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.student_1,
            classroom=self.classroom_toddler,
            attendance_date=date(2026, 9, 4),
            attendance_status="ABSENT"
        )
        StudentAttendance.objects.create(
            daycare=self.daycare_a,
            student=self.student_1,
            classroom=self.classroom_toddler,
            attendance_date=date(2026, 9, 5),
            attendance_status="EXCUSED_ABSENCE",
            excused_reason_type="FAMILY_APPROVED"
        )

        self.client.force_authenticate(user=self.staff_user_a)
        url = f"/api/daycare/attendance/monthly/?year={target_year}&month={target_month}"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['year'], 2026)
        self.assertEqual(response.data['month'], 9)
        self.assertEqual(response.data['num_days'], 30) # Sept has 30 days
        self.assertEqual(len(response.data['days_in_month']), 30)

        # Locate Student 1 row
        student_rows = response.data['students']
        s1_row = next((s for s in student_rows if s['student_id'] == str(self.student_1.id)), None)
        self.assertIsNotNone(s1_row)

        daily_cells = s1_row['daily_cells']
        # Check codes
        self.assertEqual(daily_cells['1']['code'], 'P')
        self.assertEqual(daily_cells['2']['code'], 'L')
        self.assertEqual(daily_cells['3']['code'], 'EP')
        self.assertEqual(daily_cells['4']['code'], 'A')
        self.assertEqual(daily_cells['5']['code'], 'E')
        self.assertEqual(daily_cells['6']['code'], '-') # Unmarked

        # Check Student 1 summary
        s1_summary = s1_row['summary']
        self.assertEqual(s1_summary['present_count'], 3) # Sep 1, 2, 3
        self.assertEqual(s1_summary['absent_count'], 1)  # Sep 4
        self.assertEqual(s1_summary['excused_count'], 1) # Sep 5
        self.assertEqual(s1_summary['late_count'], 1)
        self.assertEqual(s1_summary['early_pickup_count'], 1)
        self.assertEqual(s1_summary['total_recorded_days'], 5)
        self.assertEqual(s1_summary['attendance_rate'], 60.0) # 3/5 * 100

    def test_monthly_attendance_cross_daycare_isolation(self):
        """Test tenant isolation on monthly attendance matrix and audit endpoints"""
        # Create Daycare B record
        att_b = StudentAttendance.objects.create(
            daycare=self.daycare_b,
            student=self.student_b,
            attendance_date=date(2026, 9, 1),
            attendance_status="PRESENT"
        )

        # Daycare A user tries to query monthly matrix
        self.client.force_authenticate(user=self.staff_user_a)
        res = self.client.get("/api/daycare/attendance/monthly/?year=2026&month=9")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Should only have Daycare A students
        returned_ids = [s['student_id'] for s in res.data['students']]
        self.assertNotIn(str(self.student_b.id), returned_ids)

        # Daycare A user tries to access Daycare B audit trail
        res_audit = self.client.get(f"/api/daycare/attendance/records/{att_b.id}/audit/")
        self.assertEqual(res_audit.status_code, status.HTTP_404_NOT_FOUND)
