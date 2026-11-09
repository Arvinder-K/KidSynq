from datetime import date, timedelta
import uuid

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import (
    AuditLog, Classroom, ClassroomTeacherAssignment, Daycare, Employee,
    EmployeeAvailability, EmployeeCertification, EmployeeCompensation,
    EmployeeDocument, EmployeeEmergencyContact, EmployeeQualification,
    EmployeeType, EmploymentHistory, User
)
from core.services.teacher_assignment_service import TeacherAssignmentService


class StaffModulePhase5Tests(APITestCase):

    def setUp(self):
        # 1. Daycare A & B for Tenant Isolation
        self.daycare_a = Daycare.objects.create(name="Sunshine Daycare", status="Active")
        self.daycare_b = Daycare.objects.create(name="Starlight Academy", status="Active")

        # 2. Daycare Admins
        self.admin_a = User.objects.create_user(
            email='admin_a@sunshine.com', username='admin_a', password='password123',
            is_staff=True, daycare=self.daycare_a
        )
        self.admin_b = User.objects.create_user(
            email='admin_b@starlight.com', username='admin_b', password='password123',
            is_staff=True, daycare=self.daycare_b
        )

        # 3. Guardian (Regular User without staff permissions)
        self.guardian_user = User.objects.create_user(
            email='parent@test.com', username='guardian_user', password='password123',
            is_staff=False, daycare=self.daycare_a
        )

        # 4. Employee Types for Daycare A
        self.type_teacher = EmployeeType.objects.create(
            name="Teacher", daycare=self.daycare_a, is_eligible_for_classroom=True
        )
        self.type_ece = EmployeeType.objects.create(
            name="ECE", daycare=self.daycare_a, is_eligible_for_classroom=True
        )
        self.type_assistant = EmployeeType.objects.create(
            name="Assistant", daycare=self.daycare_a, is_eligible_for_classroom=True
        )
        self.type_cook = EmployeeType.objects.create(
            name="Cook", daycare=self.daycare_a, is_eligible_for_classroom=False
        )
        self.type_accountant = EmployeeType.objects.create(
            name="Accountant", daycare=self.daycare_a, is_eligible_for_classroom=False
        )

        # 5. Employees in Daycare A
        self.teacher_user_1 = User.objects.create_user(
            email='sarah.t@sunshine.com', username='sarah_t', password='password123',
            first_name='Sarah', last_name='Connor', is_staff=True, daycare=self.daycare_a
        )
        self.teacher_1 = Employee.objects.create(
            daycare=self.daycare_a,
            user=self.teacher_user_1,
            first_name="Sarah",
            last_name="Connor",
            email="sarah.t@sunshine.com",
            employee_number="EMP-1001",
            role="Teacher",
            job_title="Lead Teacher",
            status="active",
            start_date=date(2025, 1, 15)
        )
        self.teacher_1.types.add(self.type_teacher)

        self.teacher_user_2 = User.objects.create_user(
            email='john.ece@sunshine.com', username='john_ece', password='password123',
            first_name='John', last_name='Smith', is_staff=True, daycare=self.daycare_a
        )
        self.teacher_2 = Employee.objects.create(
            daycare=self.daycare_a,
            user=self.teacher_user_2,
            first_name="John",
            last_name="Smith",
            email="john.ece@sunshine.com",
            employee_number="EMP-1002",
            role="ECE",
            job_title="Early Childhood Educator",
            status="active",
            start_date=date(2025, 2, 1)
        )
        self.teacher_2.types.add(self.type_ece)

        self.assistant_1 = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Emily",
            last_name="Rose",
            email="emily.r@sunshine.com",
            employee_number="EMP-1003",
            role="Assistant",
            job_title="Classroom Assistant",
            status="active",
            start_date=date(2025, 3, 1)
        )
        self.assistant_1.types.add(self.type_assistant)

        self.cook_1 = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Gordon",
            last_name="Ramsay",
            email="gordon@sunshine.com",
            employee_number="EMP-1004",
            role="Staff",
            job_title="Head Cook",
            status="active",
            start_date=date(2025, 1, 10)
        )
        self.cook_1.types.add(self.type_cook)

        self.inactive_teacher = Employee.objects.create(
            daycare=self.daycare_a,
            first_name="Inactive",
            last_name="Staff",
            email="inactive@sunshine.com",
            employee_number="EMP-1005",
            role="Teacher",
            status="inactive",
            start_date=date(2024, 1, 1)
        )
        self.inactive_teacher.types.add(self.type_teacher)

        # 6. Employee in Daycare B (for cross-tenant checks)
        self.employee_b = Employee.objects.create(
            daycare=self.daycare_b,
            first_name="Bob",
            last_name="Builder",
            email="bob@starlight.com",
            employee_number="EMP-2001",
            role="Teacher",
            status="active",
            start_date=date(2025, 1, 1)
        )

        # 7. Classrooms in Daycare A and B
        self.classroom_a1 = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Butterflies (Toddlers)",
            room_code="TOD-101",
            capacity=15,
            status="Active"
        )
        self.classroom_a2 = Classroom.objects.create(
            daycare=self.daycare_a,
            room_name="Little Stars (Infants)",
            room_code="INF-102",
            capacity=10,
            status="Active"
        )
        self.classroom_b1 = Classroom.objects.create(
            daycare=self.daycare_b,
            room_name="Starlight Room 1",
            room_code="STR-201",
            capacity=12,
            status="Active"
        )

    # =========================================================================
    # 1. CLASSROOM INTEGRATION TESTS
    # =========================================================================

    def test_assign_primary_teacher_success(self):
        """Active eligible teacher can be assigned as Primary Teacher."""
        assignment = TeacherAssignmentService.assign_teacher(
            classroom=self.classroom_a1,
            employee=self.teacher_1,
            assignment_type='Primary',
            assigned_by=self.admin_a
        )
        self.assertEqual(assignment.status, 'Active')
        self.assertEqual(assignment.assignment_type, 'Primary')
        self.classroom_a1.refresh_from_db()
        self.assertEqual(self.classroom_a1.primary_teacher, self.teacher_user_1)

    def test_primary_teacher_replacement_ends_previous_and_preserves_history(self):
        """Replacing primary teacher ends previous assignment and keeps full history."""
        # 1. Assign Teacher 1 as Primary
        a1 = TeacherAssignmentService.assign_teacher(
            classroom=self.classroom_a1,
            employee=self.teacher_1,
            assignment_type='Primary',
            assigned_by=self.admin_a
        )
        self.assertEqual(a1.status, 'Active')

        # 2. Replace with Teacher 2 as Primary
        a2 = TeacherAssignmentService.assign_teacher(
            classroom=self.classroom_a1,
            employee=self.teacher_2,
            assignment_type='Primary',
            assigned_by=self.admin_a
        )

        # 3. Check Teacher 1 assignment ended
        a1.refresh_from_db()
        self.assertEqual(a1.status, 'Inactive')
        self.assertEqual(a1.end_date, timezone.now().date())

        # 4. Check Teacher 2 assignment active
        self.assertEqual(a2.status, 'Active')
        self.assertEqual(a2.employee, self.teacher_2)

        # 5. History preservation: 2 assignments exist in total
        total_assignments = ClassroomTeacherAssignment.objects.filter(
            classroom=self.classroom_a1,
            deleted_at__isnull=True
        ).count()
        self.assertEqual(total_assignments, 2)

    def test_multiple_assistant_teachers_allowed(self):
        """Multiple active assistant teachers can be assigned to the same classroom."""
        a1 = TeacherAssignmentService.assign_teacher(
            classroom=self.classroom_a1,
            employee=self.teacher_2,
            assignment_type='Assistant',
            assigned_by=self.admin_a
        )
        a2 = TeacherAssignmentService.assign_teacher(
            classroom=self.classroom_a1,
            employee=self.assistant_1,
            assignment_type='Assistant',
            assigned_by=self.admin_a
        )
        self.assertEqual(a1.status, 'Active')
        self.assertEqual(a2.status, 'Active')

        active_assistants = ClassroomTeacherAssignment.objects.filter(
            classroom=self.classroom_a1,
            assignment_type='Assistant',
            status='Active'
        ).count()
        self.assertEqual(active_assistants, 2)

    def test_ineligible_role_rejected(self):
        """Cook / Accountant / non-teaching staff cannot be assigned to classrooms."""
        with self.assertRaises(ValueError) as ctx:
            TeacherAssignmentService.assign_teacher(
                classroom=self.classroom_a1,
                employee=self.cook_1,
                assignment_type='Primary',
                assigned_by=self.admin_a
            )
        self.assertIn("not eligible for classroom teaching", str(ctx.exception))

    def test_inactive_employee_rejected(self):
        """Inactive or terminated employee cannot be assigned to classrooms."""
        with self.assertRaises(ValueError) as ctx:
            TeacherAssignmentService.assign_teacher(
                classroom=self.classroom_a1,
                employee=self.inactive_teacher,
                assignment_type='Primary',
                assigned_by=self.admin_a
            )
        self.assertIn("must be active", str(ctx.exception))

    def test_cross_daycare_assignment_rejected(self):
        """Teacher from Daycare B cannot be assigned to classroom in Daycare A."""
        with self.assertRaises(ValueError) as ctx:
            TeacherAssignmentService.assign_teacher(
                classroom=self.classroom_a1,
                employee=self.employee_b,
                assignment_type='Primary',
                assigned_by=self.admin_a
            )
        self.assertIn("same daycare", str(ctx.exception))

    # =========================================================================
    # 2. STAFF DASHBOARD API TESTS
    # =========================================================================

    def test_staff_dashboard_metrics_aggregation(self):
        """Dashboard returns accurate ORM aggregated statistics, charts, and alerts."""
        self.client.force_authenticate(user=self.admin_a)

        # Add expiring cert
        EmployeeCertification.objects.create(
            employee=self.teacher_1,
            certification_name="CPR & First Aid Level C",
            issue_date=date(2024, 1, 1),
            expiry_date=timezone.now().date() + timedelta(days=15)
        )
        # Add expiring document
        EmployeeDocument.objects.create(
            employee=self.teacher_1,
            document_type="Police Record Check",
            file="documents/police_check.pdf",
            expiry_date=timezone.now().date() + timedelta(days=20)
        )

        response = self.client.get('/api/daycare/employees/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        metrics = response.data['metrics']

        # Total employees in daycare A (5 created in setUp)
        self.assertEqual(metrics['total_employees'], 5)
        self.assertEqual(metrics['active_employees'], 4)
        self.assertEqual(metrics['certifications_expiring'], 1)
        self.assertEqual(metrics['documents_expiring'], 1)

        # Unassigned teaching staff
        self.assertGreaterEqual(metrics['unassigned_teaching_staff_count'], 1)

        # Check alerts generated
        alerts = response.data['alerts']
        self.assertTrue(any(a['type'] == 'certification_expiry' for a in alerts))
        self.assertTrue(any(a['type'] == 'document_expiry' for a in alerts))

    # =========================================================================
    # 3. STAFF REPORTS & EXPORT TESTS
    # =========================================================================

    def test_all_ten_staff_reports(self):
        """All 10 required staff reports return valid headers and rows."""
        self.client.force_authenticate(user=self.admin_a)

        report_types = [
            'directory', 'status', 'type', 'employment_history',
            'qualifications', 'certifications', 'documents',
            'assignments', 'availability', 'compensation'
        ]

        for rep in report_types:
            response = self.client.get(f'/api/daycare/employees/reports/?report_type={rep}')
            self.assertEqual(response.status_code, status.HTTP_200_OK, f"Report {rep} failed")
            self.assertIn('headers', response.data)
            self.assertIn('rows', response.data)
            self.assertGreater(len(response.data['headers']), 0)

    def test_staff_reports_csv_export(self):
        """Staff report CSV export returns downloadable text/csv content."""
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/daycare/employees/reports/', {'report_type': 'directory', 'export_format': 'csv'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('attachment; filename=', response['Content-Disposition'])
        content = response.content.decode('utf-8')
        self.assertIn("Employee Directory", content)
        self.assertIn("Sarah Connor", content)

    # =========================================================================
    # 4. EMERGENCY CONTACTS & AVAILABILITY SUB-RESOURCES
    # =========================================================================

    def test_emergency_contact_crud(self):
        """Admin can create, list, and delete emergency contacts for staff."""
        self.client.force_authenticate(user=self.admin_a)

        # Create
        create_res = self.client.post(f'/api/daycare/employees/{self.teacher_1.id}/emergency-contacts/', {
            'name': 'Kyle Reese',
            'relationship': 'Spouse',
            'phone': '555-0199',
            'email': 'kyle@future.com',
            'is_primary': True
        })
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        contact_id = create_res.data['id']

        # List
        list_res = self.client.get(f'/api/daycare/employees/{self.teacher_1.id}/emergency-contacts/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.data), 1)
        self.assertEqual(list_res.data[0]['name'], 'Kyle Reese')

        # Delete
        del_res = self.client.delete(f'/api/daycare/employee-emergency-contacts/{contact_id}/')
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)

    def test_employee_availability_schedule(self):
        """Admin can update and fetch 7-day employee availability schedule."""
        self.client.force_authenticate(user=self.admin_a)

        schedule_data = [
            {'day_of_week': 'Monday', 'start_time': '08:00', 'end_time': '16:30', 'is_available': True},
            {'day_of_week': 'Tuesday', 'start_time': '08:00', 'end_time': '16:30', 'is_available': True},
            {'day_of_week': 'Wednesday', 'start_time': '08:00', 'end_time': '16:30', 'is_available': True},
            {'day_of_week': 'Thursday', 'start_time': '08:00', 'end_time': '16:30', 'is_available': True},
            {'day_of_week': 'Friday', 'start_time': '08:00', 'end_time': '16:30', 'is_available': True},
            {'day_of_week': 'Saturday', 'is_available': False},
            {'day_of_week': 'Sunday', 'is_available': False},
        ]

        post_res = self.client.post(
            f'/api/daycare/employees/{self.teacher_1.id}/availability/',
            schedule_data,
            format='json'
        )
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)

        get_res = self.client.get(f'/api/daycare/employees/{self.teacher_1.id}/availability/')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(get_res.data), 7)

    # =========================================================================
    # 5. TENANT ISOLATION & PERMISSION SECURITY TESTS
    # =========================================================================

    def test_tenant_isolation_cross_daycare_access_blocked(self):
        """Admin of Daycare A cannot access, view, or modify Daycare B employee."""
        self.client.force_authenticate(user=self.admin_a)

        # Attempt to retrieve Daycare B employee
        res = self.client.get(f'/api/daycare/employees/{self.employee_b.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Attempt to add emergency contact to Daycare B employee
        res_contact = self.client.post('/api/daycare/employee-emergency-contacts/', {
            'employee': str(self.employee_b.id),
            'name': 'Hacker Contact',
            'relationship': 'None',
            'phone': '0000000000'
        })
        self.assertIn(res_contact.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST])

    def test_guardian_access_blocked_from_staff_endpoints(self):
        """Guardians/Parents are blocked from accessing staff endpoints."""
        self.client.force_authenticate(user=self.guardian_user)

        res_dash = self.client.get('/api/daycare/employees/dashboard/')
        self.assertEqual(res_dash.status_code, status.HTTP_403_FORBIDDEN)

        res_rep = self.client.get('/api/daycare/employees/reports/')
        self.assertEqual(res_rep.status_code, status.HTTP_403_FORBIDDEN)

        res_list = self.client.get('/api/daycare/employees/')
        self.assertEqual(res_list.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 6. AUDIT LOGGING TESTS
    # =========================================================================

    def test_audit_log_recorded_on_classroom_assignment(self):
        """Assigning teacher records audit log entry."""
        initial_logs = AuditLog.objects.count()

        TeacherAssignmentService.assign_teacher(
            classroom=self.classroom_a1,
            employee=self.teacher_1,
            assignment_type='Primary',
            assigned_by=self.admin_a
        )

        new_logs = AuditLog.objects.count()
        self.assertGreater(new_logs, initial_logs)
        last_log = AuditLog.objects.order_by('-created_at').first()
        self.assertEqual(last_log.action, 'CLASSROOM_TEACHER_ASSIGNED')
        self.assertEqual(last_log.module, 'classrooms')
