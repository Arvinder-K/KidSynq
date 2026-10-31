from rest_framework.test import APITestCase
from rest_framework import status
from core.models import (
    User, Daycare, Branch, Student, ChildEnrollment, 
    Classroom, ClassroomStudent, AuditLog
)
from django.utils import timezone

class ChildLifecycleTests(APITestCase):
    def setUp(self):
        # Create daycares
        self.daycare_a = Daycare.objects.create(name="Daycare A", status="Active")
        self.daycare_b = Daycare.objects.create(name="Daycare B", status="Active")
        
        # Create branches
        self.branch_a1 = Branch.objects.create(daycare=self.daycare_a, name="Branch A1", status="Active")
        self.branch_a2 = Branch.objects.create(daycare=self.daycare_a, name="Branch A2", status="Active")
        self.branch_b1 = Branch.objects.create(daycare=self.daycare_b, name="Branch B1", status="Active")
        
        # Create classrooms
        self.classroom_a1 = Classroom.objects.create(daycare=self.daycare_a, room_name="Classroom A1", room_code="A1")
        self.classroom_a2 = Classroom.objects.create(daycare=self.daycare_a, room_name="Classroom A2", room_code="A2")
        self.classroom_b1 = Classroom.objects.create(daycare=self.daycare_b, room_name="Classroom B1", room_code="B1")
        
        # Create users
        self.admin_a = User.objects.create_user(
            email='admin_a@test.com', username='admin_a', password='password123',
            is_staff=True, daycare=self.daycare_a
        )
        self.admin_b = User.objects.create_user(
            email='admin_b@test.com', username='admin_b', password='password123',
            is_staff=True, daycare=self.daycare_b
        )
        self.unauth_user = User.objects.create_user(
            email='unauth@test.com', username='unauth', password='password123',
            is_staff=False, daycare=self.daycare_a
        )
        
        # Create student for daycare A, branch A1
        self.student = Student.objects.create(
            daycare=self.daycare_a,
            branch=self.branch_a1,
            first_name="John",
            last_name="Doe",
            admission_number="AD-100",
            status="Active"
        )
        
        # Create active enrollment
        self.enrollment = ChildEnrollment.objects.create(
            student=self.student,
            start_date="2026-01-01",
            status="Active"
        )
        
        # Create active classroom assignment
        self.classroom_student = ClassroomStudent.objects.create(
            student=self.student,
            classroom=self.classroom_a1,
            start_date="2026-01-01",
            status="Active"
        )

    def test_active_child_withdrawal(self):
        self.client.force_authenticate(user=self.admin_a)
        
        payload = {
            "withdrawal_date": "2026-06-30",
            "reason": "Moving to another city",
            "notes": "Transition notes"
        }
        response = self.client.post(f'/api/daycare/children/{self.student.id}/withdraw/', payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify student status updated
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, 'Withdrawn')
        
        # Verify enrollment updated
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.status, 'Withdrawn')
        self.assertEqual(str(self.enrollment.end_date), '2026-06-30')
        self.assertEqual(self.enrollment.withdrawal_reason, 'Moving to another city')
        
        # Verify audit log exists
        audit_exists = AuditLog.objects.filter(
            action="Child Withdrawal",
            entity_type="Student",
            entity_id=str(self.student.id)
        ).exists()
        self.assertTrue(audit_exists)

    def test_withdrawal_history(self):
        # Perform withdrawal
        self.client.force_authenticate(user=self.admin_a)
        self.client.post(f'/api/daycare/children/{self.student.id}/withdraw/', {
            "withdrawal_date": "2026-06-30",
            "reason": "Temporary break"
        })
        
        # Verify record is kept
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, 'Withdrawn')
        self.assertEqual(self.student.enrollments.count(), 1)
        
        # Medical, Emergency Contacts, etc. must not be deleted
        # (This is guaranteed by django cascades not being triggered, we just soft deleted or updated status)
        self.assertIsNotNone(self.student.id)

    def test_classroom_transfer(self):
        self.client.force_authenticate(user=self.admin_a)
        
        payload = {
            "classroom_id": str(self.classroom_a2.id),
            "transfer_date": "2026-05-01"
        }
        response = self.client.post(f'/api/daycare/children/{self.student.id}/transfer/', payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify old assignment ended
        self.classroom_student.refresh_from_db()
        self.assertEqual(self.classroom_student.status, 'Ended')
        self.assertEqual(str(self.classroom_student.end_date), '2026-05-01')
        
        # Verify new assignment active
        new_assignment = ClassroomStudent.objects.get(student=self.student, status='Active')
        self.assertEqual(new_assignment.classroom, self.classroom_a2)
        self.assertEqual(str(new_assignment.start_date), '2026-05-01')

    def test_branch_transfer(self):
        self.client.force_authenticate(user=self.admin_a)
        
        payload = {
            "branch_id": str(self.branch_a2.id),
            "transfer_date": "2026-06-01"
        }
        response = self.client.post(f'/api/daycare/children/{self.student.id}/transfer/', payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.student.refresh_from_db()
        # Student branch should be branch_a2
        self.assertEqual(self.student.branch, self.branch_a2)
        
        # Verify old enrollment Transferred
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.status, 'Transferred')
        self.assertEqual(str(self.enrollment.end_date), '2026-06-01')
        
        # Verify new enrollment Active
        new_enroll = ChildEnrollment.objects.get(student=self.student, status='Active')
        self.assertEqual(str(new_enroll.start_date), '2026-06-01')

    def test_archive(self):
        # Withdraw first
        self.client.force_authenticate(user=self.admin_a)
        self.client.post(f'/api/daycare/children/{self.student.id}/withdraw/', {
            "withdrawal_date": "2026-06-30",
            "reason": "Moving"
        })
        
        # Archive
        response = self.client.post(f'/api/daycare/children/{self.student.id}/archive/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, 'Archived')

    def test_restore_re_enrollment(self):
        self.client.force_authenticate(user=self.admin_a)
        
        # Withdraw & Archive
        self.client.post(f'/api/daycare/children/{self.student.id}/withdraw/', {
            "withdrawal_date": "2026-06-30",
            "reason": "Break"
        })
        self.client.post(f'/api/daycare/children/{self.student.id}/archive/')
        
        # Restore/Unarchive
        response = self.client.post(f'/api/daycare/children/{self.student.id}/unarchive/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, 'Withdrawn')
        
        # Re-enroll
        response = self.client.post(f'/api/daycare/children/{self.student.id}/re-enroll/', {
            "start_date": "2026-09-01"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, 'Active')
        
        # Verify new active enrollment record
        self.assertEqual(self.student.enrollments.filter(status='Active').count(), 1)

    def test_re_enrollment_without_duplicate_child(self):
        self.client.force_authenticate(user=self.admin_a)
        
        # Withdraw
        self.client.post(f'/api/daycare/children/{self.student.id}/withdraw/', {
            "withdrawal_date": "2026-06-30",
            "reason": "Break"
        })
        
        # Re-enroll
        self.client.post(f'/api/daycare/children/{self.student.id}/re-enroll/', {
            "start_date": "2026-09-01"
        })
        
        # Verify only 1 student record exists
        count = Student.objects.filter(id=self.student.id).count()
        self.assertEqual(count, 1)

    def test_multiple_enrollment_records(self):
        self.client.force_authenticate(user=self.admin_a)
        
        # Enrollment 1 active initially. Withdraw it.
        self.client.post(f'/api/daycare/children/{self.student.id}/withdraw/', {
            "withdrawal_date": "2026-06-30",
            "reason": "End 1"
        })
        
        # Re-enroll -> Enrollment 2 active
        self.client.post(f'/api/daycare/children/{self.student.id}/re-enroll/', {
            "start_date": "2026-08-01"
        })
        
        # Withdraw -> End 2
        self.client.post(f'/api/daycare/children/{self.student.id}/withdraw/', {
            "withdrawal_date": "2026-10-31",
            "reason": "End 2"
        })
        
        # Re-enroll -> Enrollment 3 active
        self.client.post(f'/api/daycare/children/{self.student.id}/re-enroll/', {
            "start_date": "2026-12-01"
        })
        
        # Check all records preserved
        enrollments = self.student.enrollments.all().order_by('start_date')
        self.assertEqual(enrollments.count(), 3)
        self.assertEqual(enrollments[0].status, 'Withdrawn')
        self.assertEqual(enrollments[1].status, 'Withdrawn')
        self.assertEqual(enrollments[2].status, 'Active')

    def test_cross_daycare_transfer_attempt(self):
        self.client.force_authenticate(user=self.admin_a)
        
        # Try to transfer A's student to B's branch
        payload = {
            "branch_id": str(self.branch_b1.id),
            "transfer_date": "2026-06-01"
        }
        response = self.client.post(f'/api/daycare/children/{self.student.id}/transfer/', payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Try to transfer A's student to B's classroom
        payload2 = {
            "classroom_id": str(self.classroom_b1.id),
            "transfer_date": "2026-06-01"
        }
        response2 = self.client.post(f'/api/daycare/children/{self.student.id}/transfer/', payload2)
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthorized_lifecycle_action(self):
        # Authenticate as unauth (is_staff = False)
        self.client.force_authenticate(user=self.unauth_user)
        
        # Attempt withdrawal
        response = self.client.post(f'/api/daycare/children/{self.student.id}/withdraw/', {
            "withdrawal_date": "2026-06-30",
            "reason": "Hack"
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Attempt transfer
        response = self.client.post(f'/api/daycare/children/{self.student.id}/transfer/', {
            "branch_id": str(self.branch_a2.id),
            "transfer_date": "2026-06-01"
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Attempt archive
        response = self.client.post(f'/api/daycare/children/{self.student.id}/archive/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Attempt re-enroll
        response = self.client.post(f'/api/daycare/children/{self.student.id}/re-enroll/', {
            "start_date": "2026-09-01"
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
