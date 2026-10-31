from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from core.models import User, Daycare, Employee, AuditLog

class EmployeeAPITests(APITestCase):
    def setUp(self):
        self.daycare1 = Daycare.objects.create(name="Happy Daycare", email="happy@daycare.com", status="Active")
        self.daycare2 = Daycare.objects.create(name="Sad Daycare", email="sad@daycare.com", status="Active")
        
        self.admin1 = User.objects.create_user(
            username="admin1@test.com", email="admin1@test.com", password="testpassword",
            daycare=self.daycare1, is_staff=True
        )
        self.admin2 = User.objects.create_user(
            username="admin2@test.com", email="admin2@test.com", password="testpassword",
            daycare=self.daycare2, is_staff=True
        )
        
        # Admin1's employees
        self.emp1 = Employee.objects.create(
            first_name="John", last_name="Doe", employee_number="E001",
            daycare=self.daycare1, status="active", start_date="2023-01-01",
            role="Teacher"
        )
        self.emp2 = Employee.objects.create(
            first_name="Jane", last_name="Smith", employee_number="E002",
            daycare=self.daycare1, status="inactive", start_date="2023-02-01",
            role="Assistant"
        )
        
        # Admin2's employee
        self.emp3 = Employee.objects.create(
            first_name="Bob", last_name="Brown", employee_number="E003",
            daycare=self.daycare2, status="active", start_date="2023-03-01",
            role="Cook"
        )

        self.url = reverse('employee_list')

    def test_list_employees(self):
        self.client.force_authenticate(user=self.admin1)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see their own daycare's employees
        self.assertEqual(len(response.data), 2)
        
    def test_filter_employees_by_status(self):
        self.client.force_authenticate(user=self.admin1)
        response = self.client.get(f"{self.url}?status=active")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['first_name'], "John")

    def test_create_employee(self):
        self.client.force_authenticate(user=self.admin1)
        data = {
            "first_name": "New",
            "last_name": "Emp",
            "employee_number": "E004",
            "start_date": "2023-04-01",
            "status": "active",
            "role": "Teacher"
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Employee.objects.filter(daycare=self.daycare1).count(), 3)
        
        # Check audit log
        log = AuditLog.objects.filter(action='EMPLOYEE_CREATED').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.entity_id, str(response.data['id']))

    def test_create_duplicate_employee_number(self):
        self.client.force_authenticate(user=self.admin1)
        data = {
            "first_name": "Copy",
            "last_name": "Cat",
            "employee_number": "E001",  # Already exists for daycare1
            "start_date": "2023-05-01",
            "status": "active",
            "role": "Teacher"
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('employee_number', response.data)

    def test_update_employee(self):
        self.client.force_authenticate(user=self.admin1)
        url = reverse('employee_detail', kwargs={'pk': self.emp1.pk})
        data = {"status": "on_leave"}
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.emp1.refresh_from_db()
        self.assertEqual(self.emp1.status, "on_leave")
        
        # Check audit log
        log = AuditLog.objects.filter(action='EMPLOYEE_UPDATED').first()
        self.assertIsNotNone(log)

    def test_prevent_direct_activation_of_terminated_employee(self):
        # First terminate
        self.emp1.status = 'terminated'
        self.emp1.save()
        
        self.client.force_authenticate(user=self.admin1)
        url = reverse('employee_detail', kwargs={'pk': self.emp1.pk})
        data = {"status": "active"}
        
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', response.data)

    def test_date_validation_end_before_start(self):
        self.client.force_authenticate(user=self.admin1)
        data = {
            "first_name": "Time",
            "last_name": "Traveler",
            "employee_number": "E005",
            "start_date": "2023-06-01",
            "end_date": "2023-01-01", # End before start
            "status": "active",
            "role": "Teacher"
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('end_date', response.data)
