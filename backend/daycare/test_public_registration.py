import uuid
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from core.models import Daycare, RegistrationApplication, User, Employee

class PublicRegistrationEndToEndTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.daycare = Daycare.objects.create(
            name="Sunshine Early Learning Center",
            daycare_code="DC-SUN100",
            status="Active",
            city="Toronto",
            country="Canada",
            email="contact@sunshine.ca",
            phone="416-555-0199"
        )
        # Create admin user
        self.admin_user = User.objects.create_user(
            username='admin@sunshine.ca',
            email='admin@sunshine.ca',
            password='Password123!',
            is_staff=True,
            daycare=self.daycare
        )
        self.employee = Employee.objects.create(
            user=self.admin_user,
            daycare=self.daycare,
            role='Director',
            status='active'
        )

    def test_full_public_registration_lifecycle(self):
        # 1. Fetch public daycare information by ID and daycare_code
        res_info_id = self.client.get(f'/api/public/daycares/{self.daycare.id}/registration/')
        self.assertEqual(res_info_id.status_code, status.HTTP_200_OK)
        self.assertEqual(res_info_id.data['id'], str(self.daycare.id))
        self.assertEqual(res_info_id.data['name'], "Sunshine Early Learning Center")

        res_info_code = self.client.get(f'/api/public/daycares/{self.daycare.daycare_code}/registration/')
        self.assertEqual(res_info_code.status_code, status.HTTP_200_OK)
        self.assertEqual(res_info_code.data['id'], str(self.daycare.id))

        # 2. Create initial draft application using daycare_code
        payload_create = {
            'daycare_id': self.daycare.daycare_code,
            'applicant_name': 'Raj Kumar',
            'applicant_email': 'raj@example.com',
            'applicant_phone': '09855718311',
            'application_data': {
                'applicant': {'name': 'Raj Kumar', 'email': 'raj@example.com', 'phone': '09855718311'},
                'family': {'familyName': 'Kumar', 'address': '123 Main St'},
                'child': {'firstName': 'Aryan', 'lastName': 'Kumar', 'dob': '2022-05-15'}
            }
        }
        res_create = self.client.post('/api/public/registrations/', payload_create, format='json')
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        app_num = res_create.data['application_number']
        token = res_create.data['access_token']
        self.assertTrue(app_num.startswith('APP-'))
        self.assertTrue(len(token) > 0)

        # 3. Retrieve draft application with valid token
        res_detail = self.client.get(f'/api/public/registrations/{app_num}/?token={token}')
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(res_detail.data['applicant_name'], 'Raj Kumar')

        # 3b. Detail with invalid token should fail 403
        res_detail_bad = self.client.get(f'/api/public/registrations/{app_num}/?token=wrong-token')
        self.assertEqual(res_detail_bad.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Update draft application
        payload_update = {
            'applicant_name': 'Raj Kumar Updated',
            'token': token,
            'application_data': {
                'applicant': {'name': 'Raj Kumar Updated', 'email': 'raj@example.com', 'phone': '09855718311'},
                'family': {'familyName': 'Kumar Family', 'address': '456 Queen St'},
                'child': {'firstName': 'Aryan', 'lastName': 'Kumar', 'dob': '2022-05-15', 'gender': 'Male'}
            }
        }
        res_update = self.client.patch(f'/api/public/registrations/{app_num}/update/', payload_update, format='json')
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)

        # Verify DB state
        app_db = RegistrationApplication.objects.get(application_number=app_num)
        self.assertEqual(app_db.status, 'draft')
        self.assertEqual(app_db.applicant_name, 'Raj Kumar Updated')

        # 5. Submit application
        res_submit = self.client.post(f'/api/public/registrations/{app_num}/submit/', {'token': token}, format='json')
        self.assertEqual(res_submit.status_code, status.HTTP_200_OK)
        self.assertEqual(res_submit.data['detail'], 'Application submitted successfully.')

        # Verify final status in DB
        app_db.refresh_from_db()
        self.assertEqual(app_db.status, 'submitted')
        self.assertIsNotNone(app_db.submitted_at)

        # 6. Admin can view the submitted application
        self.client.force_authenticate(user=self.admin_user)
        res_admin_list = self.client.get('/api/daycare/applications/')
        self.assertEqual(res_admin_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_admin_list.data), 1)
        self.assertEqual(res_admin_list.data[0]['application_number'], app_num)
        self.assertEqual(res_admin_list.data[0]['status'], 'submitted')

