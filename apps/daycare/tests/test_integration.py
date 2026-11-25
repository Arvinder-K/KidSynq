from rest_framework.test import APITestCase
from rest_framework import status
from core.models import User, Daycare, DaycareHoliday, DaycareEmergencyInformation, Branch, DaycareSettings

class DaycareModuleIntegrationTests(APITestCase):
    def setUp(self):
        # Create daycares
        self.daycare_a = Daycare.objects.create(name="Daycare A", status="Active")
        self.daycare_b = Daycare.objects.create(name="Daycare B", status="Active")
        
        # Create admins
        self.admin_a = User.objects.create_user(
            email='admin_a_int@test.com', username='admin_a_int', password='password123',
            is_staff=True, daycare=self.daycare_a
        )
        self.admin_b = User.objects.create_user(
            email='admin_b_int@test.com', username='admin_b_int', password='password123',
            is_staff=True, daycare=self.daycare_b
        )
        
        # Populate Daycare A data
        self.holiday_a = DaycareHoliday.objects.create(
            daycare=self.daycare_a, name="New Year A", holiday_date="2026-01-01"
        )
        self.emergency_a = DaycareEmergencyInformation.objects.create(
            daycare=self.daycare_a, contact_name="Hospital A", phone="111-111-1111"
        )
        self.branch_a = Branch.objects.create(
            daycare=self.daycare_a, name="Branch A", status="Active"
        )
        
        # Populate Daycare B data
        self.holiday_b = DaycareHoliday.objects.create(
            daycare=self.daycare_b, name="New Year B", holiday_date="2026-01-01"
        )
        self.emergency_b = DaycareEmergencyInformation.objects.create(
            daycare=self.daycare_b, contact_name="Hospital B", phone="222-222-2222"
        )
        self.branch_b = Branch.objects.create(
            daycare=self.daycare_b, name="Branch B", status="Active"
        )

    def test_holidays_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        
        # GET should only return Daycare A's holidays
        response = self.client.get('/api/daycare/holidays/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "New Year A")
        
        # PATCH to Daycare B's holiday should fail
        response = self.client.patch(f'/api/daycare/holidays/{self.holiday_b.id}/', {'name': 'Hacked'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # POST creating for Daycare B should be overridden or fail
        response = self.client.post('/api/daycare/holidays/', {'name': 'Daycare B Holiday', 'holiday_date': '2026-02-01'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Check if the created holiday belongs to Daycare A
        new_holiday = DaycareHoliday.objects.get(id=response.data['id'])
        self.assertEqual(new_holiday.daycare, self.daycare_a)

    def test_emergency_info_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        
        response = self.client.get('/api/daycare/emergency-information/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Assuming it returns a dict since it's OneToOne
        self.assertEqual(response.data['contact_name'], "Hospital A")
        
        # Admin A can't delete Daycare B's emergency info, but wait, the endpoint might not take an ID!
        # Let's try passing the ID in DELETE or PUT if it takes it, or just posting new data.
        # If the view is `DaycareEmergencyInfoView` which handles the single object:
        response = self.client.patch('/api/daycare/emergency-information/', {'contact_name': 'Hacked'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify Daycare B was not affected
        self.emergency_b.refresh_from_db()
        self.assertNotEqual(self.emergency_b.contact_name, 'Hacked')

    def test_branches_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        
        response = self.client.get('/api/daycare/branches/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "Branch A")
        
        response = self.client.put(f'/api/daycare/branches/{self.branch_b.id}/', {
            'name': 'Hacked Branch', 'status': 'Suspended'
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_settings_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        
        # GET Daycare A settings
        response = self.client.get('/api/daycare/settings/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Admin A cannot pass daycare_id = Daycare B because it's read_only and forced to Daycare A
        response = self.client.patch('/api/daycare/settings/', {'timezone': 'EST'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify Daycare B settings were not affected
        b_settings = DaycareSettings.objects.get_or_create(daycare=self.daycare_b)[0]
        self.assertNotEqual(b_settings.timezone, 'EST')
