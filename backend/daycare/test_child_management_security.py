import uuid
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from core.models import (
    User, Daycare, Branch, Student, ChildEnrollment, 
    Classroom, ClassroomStudent, AuditLog, StudentEmergencyContact,
    StudentPickup, HealthProfile, Document, ChildVaccinationRecord
)

class ChildManagementSecurityTests(APITestCase):
    def setUp(self):
        # Create daycares
        self.daycare_a = Daycare.objects.create(name="Daycare A", status="Active")
        self.daycare_b = Daycare.objects.create(name="Daycare B", status="Active")
        
        # Create branches
        self.branch_a = Branch.objects.create(daycare=self.daycare_a, name="Branch A", status="Active")
        self.branch_b = Branch.objects.create(daycare=self.daycare_b, name="Branch B", status="Active")
        
        # Create classrooms
        self.classroom_a = Classroom.objects.create(daycare=self.daycare_a, room_name="Classroom A", room_code="A", capacity=2)
        self.classroom_b = Classroom.objects.create(daycare=self.daycare_b, room_name="Classroom B", room_code="B", capacity=5)
        
        # Create users
        self.admin_a = User.objects.create_user(
            email='admin_a_sec@test.com', username='admin_a_sec', password='password123',
            is_staff=True, daycare=self.daycare_a
        )
        self.admin_b = User.objects.create_user(
            email='admin_b_sec@test.com', username='admin_b_sec', password='password123',
            is_staff=True, daycare=self.daycare_b
        )
        self.unauth_user = User.objects.create_user(
            email='unauth_sec@test.com', username='unauth_sec', password='password123',
            is_staff=False, daycare=self.daycare_a
        )

        # Create daycare A child
        self.child_a = Student.objects.create(
            daycare=self.daycare_a, branch=self.branch_a,
            first_name="Alice", last_name="A", admission_number="ADM-A1", status="Active"
        )
        # Create daycare B child
        self.child_b = Student.objects.create(
            daycare=self.daycare_b, branch=self.branch_b,
            first_name="Bob", last_name="B", admission_number="ADM-B1", status="Active"
        )

        # Create sub-resources for child B
        self.enroll_b = ChildEnrollment.objects.create(student=self.child_b, status="Active", start_date="2026-01-01")
        self.health_b = HealthProfile.objects.create(daycare=self.daycare_b, student=self.child_b, ohip_number="123-456-789")
        self.contact_b = StudentEmergencyContact.objects.create(student=self.child_b, name="Parent B", mobile="999-999-9999", is_primary=True)
        self.pickup_b = StudentPickup.objects.create(student=self.child_b, name="Pickup B", status="Active")
        
        # Classroom assignment for child B
        self.class_student_b = ClassroomStudent.objects.create(student=self.child_b, classroom=self.classroom_b, status="Active", start_date="2026-01-01")

        # Document for child B
        from django.contrib.contenttypes.models import ContentType
        student_type = ContentType.objects.get_for_model(Student)
        self.doc_b = Document.objects.create(
            daycare=self.daycare_b, title="Report B", content_type=student_type, 
            object_id=self.child_b.id, file_path="documents/b.pdf", uploaded_by=self.admin_b
        )

    # 1. Authentication & Permissions
    def test_authentication_and_permissions(self):
        # Daycare Admin Login is verified by standard django rest auth, we focus on API endpoint checks
        # Non-authenticated user block
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/daycare/children/{self.child_a.id}/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Unauthorized parent user block from writing endpoints
        self.client.force_authenticate(user=self.unauth_user)
        response = self.client.post('/api/daycare/children/', {
            "first_name": "Hack", "last_name": "Kid", "admission_number": "ADM-H1"
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Authorized Daycare Admin access
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(f'/api/daycare/children/{self.child_a.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # 2. Tenant Isolation Checks
    def test_tenant_isolation_cross_access(self):
        self.client.force_authenticate(user=self.admin_a)

        # Try to view Daycare B child
        response = self.client.get(f'/api/daycare/children/{self.child_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Try to edit Daycare B child
        response = self.client.patch(f'/api/daycare/children/{self.child_b.id}/', {"first_name": "Hacked"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Direct manipulation of daycare_id in post payload (should be forced to admin's daycare)
        response = self.client.post('/api/daycare/children/', {
            "first_name": "Cloned", "last_name": "Child", "admission_number": "ADM-C1",
            "daycare": str(self.daycare_b.id)
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_child = Student.objects.get(admission_number="ADM-C1")
        self.assertEqual(new_child.daycare, self.daycare_a) # Forced to A

        # Cross-daycare emergency contact access
        response = self.client.get(f'/api/daycare/emergency-contacts/{self.contact_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Cross-daycare authorized pickup access
        response = self.client.get(f'/api/daycare/authorized-pickups/{self.pickup_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Cross-daycare medical profile view
        response = self.client.get(f'/api/daycare/children/{self.child_b.id}/medical/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Cross-daycare document view
        response = self.client.get(f'/api/daycare/documents/{self.doc_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Cross-daycare classroom assignment view
        response = self.client.get(f'/api/daycare/classroom-assignments/{self.class_student_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 3. Child Admission Rollback & Duplication Checks
    def test_child_admission_validation(self):
        self.client.force_authenticate(user=self.admin_a)

        # Duplicate admission number within same daycare
        response = self.client.post('/api/daycare/children/', {
            "first_name": "Another", "last_name": "Alice", "admission_number": "ADM-A1"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Admission number must be unique", response.data['detail'])

        # Transaction rollback on nested model creation failure:
        # If we supply an emergency contact with a missing required field (relationship), 
        # the atomic block should rollback the entire student creation.
        initial_student_count = Student.objects.filter(daycare=self.daycare_a).count()
        
        response = self.client.post('/api/daycare/children/', {
            "first_name": "Rollback",
            "last_name": "Test",
            "admission_number": "ADM-R1",
            "dob": "invalid-date-format", # Trigger serializer validation failure
            "emergency_contact": {
                "name": "Should Rollback"
            }
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Verify no student was created
        current_student_count = Student.objects.filter(daycare=self.daycare_a).count()
        self.assertEqual(current_student_count, initial_student_count)

    # 4. Profile Editing & Photo Upload
    def test_profile_details_manipulation(self):
        self.client.force_authenticate(user=self.admin_a)
        
        payload = {
            "first_name": "Alice Updated",
            "preferred_name": "Ally",
            "language": "French",
            "dob": "2022-05-15",
            "gender": "Female"
        }
        response = self.client.patch(f'/api/daycare/children/{self.child_a.id}/', payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.child_a.refresh_from_db()
        self.assertEqual(self.child_a.first_name, "Alice Updated")
        self.assertEqual(self.child_a.preferred_name, "Ally")
        self.assertEqual(self.child_a.language, "French")
        self.assertEqual(str(self.child_a.dob), "2022-05-15")
        self.assertEqual(self.child_a.gender, "Female")

    # 5. Medical Profile View, Edit & Masking
    def test_medical_profile_logic(self):
        # Create health profile for child A
        hp_a = HealthProfile.objects.create(daycare=self.daycare_a, student=self.child_a, ohip_number="8888-888-888")
        
        # 1. Staff Admin Access (Reads raw details)
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(f'/api/daycare/children/{self.child_a.id}/medical/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['ohip_number'], "8888-888-888")

        # Edit medical profile
        payload = {
            "ohip_number": "9999-999-999",
            "allergies": "Peanuts",
            "special_needs": "None"
        }
        response = self.client.patch(f'/api/daycare/children/{self.child_a.id}/medical/', payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        hp_a.refresh_from_db()
        self.assertEqual(hp_a.ohip_number, "9999-999-999")
        self.child_a.refresh_from_db()
        self.assertEqual(self.child_a.allergies, "Peanuts")

        # 2. Non-staff Access (ohip_number Masked, updates blocked)
        self.client.force_authenticate(user=self.unauth_user)
        response = self.client.get(f'/api/daycare/children/{self.child_a.id}/medical/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['ohip_number'], "***-***-***") # Masked!

        # Try to edit medical profile (Should fail)
        response = self.client.patch(f'/api/daycare/children/{self.child_a.id}/medical/', {"ohip_number": "1111"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # 6. Classroom Capacity validation
    def test_classroom_capacity_limit(self):
        self.client.force_authenticate(user=self.admin_a)

        # Classroom A has a capacity of 2.
        # Assign student A to Classroom A
        response = self.client.post(f'/api/daycare/children/{self.child_a.id}/classrooms/', {
            "classroom": str(self.classroom_a.id), "start_date": "2026-08-01"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Create student 2 in daycare A
        student2 = Student.objects.create(
            daycare=self.daycare_a, branch=self.branch_a,
            first_name="Kid2", last_name="A", admission_number="ADM-A2", status="Active"
        )
        # Assign student 2 to Classroom A (total 2 active, matches capacity)
        response = self.client.post(f'/api/daycare/children/{student2.id}/classrooms/', {
            "classroom": str(self.classroom_a.id), "start_date": "2026-08-01"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Create student 3 in daycare A
        student3 = Student.objects.create(
            daycare=self.daycare_a, branch=self.branch_a,
            first_name="Kid3", last_name="A", admission_number="ADM-A3", status="Active"
        )
        # Assign student 3 to Classroom A (Exceeds capacity -> should fail)
        response = self.client.post(f'/api/daycare/children/{student3.id}/classrooms/', {
            "classroom": str(self.classroom_a.id), "start_date": "2026-08-01"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Classroom capacity has been reached", response.data[0])

    # 7. Document Handling & Security
    def test_document_security_and_limits(self):
        self.client.force_authenticate(user=self.admin_a)

        # Upload document
        fake_file = SimpleUploadedFile("sample.pdf", b"file_content", content_type="application/pdf")
        response = self.client.post(f'/api/daycare/children/{self.child_a.id}/documents/', {
            "title": "Medical Waiver",
            "file_path": fake_file
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        doc_id = response.data['id']

        # Verify Audit Log
        self.assertTrue(AuditLog.objects.filter(action="Uploaded Document", entity_id=str(doc_id)).exists())

        # Attempt to download via secure endpoint
        response = self.client.get(f'/api/daycare/documents/{doc_id}/download/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Non-staff download attempt blocked
        self.client.force_authenticate(user=self.unauth_user)
        response = self.client.get(f'/api/daycare/documents/{doc_id}/download/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Admin B download attempt blocked (Cross-daycare tenant isolation)
        self.client.force_authenticate(user=self.admin_b)
        response = self.client.get(f'/api/daycare/documents/{doc_id}/download/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 8. Audit logs creation
    def test_audit_logs_creation(self):
        self.client.force_authenticate(user=self.admin_a)
        
        # Clear audit logs for daycare A
        AuditLog.objects.all().delete()

        # Update student profile
        self.client.patch(f'/api/daycare/children/{self.child_a.id}/', {"preferred_name": "Alice P"})

        # Check audit log written
        logs = AuditLog.objects.all()
        self.assertEqual(logs.count(), 1)
        self.assertEqual(logs[0].action, "Student Profile Updated")
        self.assertEqual(logs[0].entity_type, "Student")
        self.assertEqual(logs[0].user, self.admin_a)
