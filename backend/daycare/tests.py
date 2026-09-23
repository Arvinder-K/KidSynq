from rest_framework.test import APITestCase
from rest_framework import status
from core.models import User, Daycare

class DaycareTenantIsolationTests(APITestCase):
    def setUp(self):
        # Create daycares
        self.daycare_a = Daycare.objects.create(name="Daycare A", status="Active")
        self.daycare_b = Daycare.objects.create(name="Daycare B", status="Active")
        self.suspended_daycare = Daycare.objects.create(name="Daycare C", status="Suspended")
        
        # Create admins
        self.admin_a = User.objects.create_user(
            email='admin_a@test.com', username='admin_a', password='password123',
            is_staff=True, daycare=self.daycare_a
        )
        self.admin_b = User.objects.create_user(
            email='admin_b@test.com', username='admin_b', password='password123',
            is_staff=True, daycare=self.daycare_b
        )
        self.suspended_admin = User.objects.create_user(
            email='susp_admin@test.com', username='susp_admin', password='password123',
            is_staff=True, daycare=self.suspended_daycare
        )
        
        # Create standard user
        self.standard_user = User.objects.create_user(
            email='parent@test.com', username='parent', password='password123',
            is_staff=False, daycare=self.daycare_a
        )
        
        # Create SuperAdmin
        self.superadmin = User.objects.create_superuser(
            email='super@test.com', username='super', password='password123'
        )

    def test_valid_daycare_admin_access(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/daycare/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], "Daycare A")

    def test_tenant_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/daycare/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verify they cannot see Daycare B's name
        self.assertNotEqual(response.data['name'], "Daycare B")
        
    def test_suspended_daycare_access_blocked(self):
        self.client.force_authenticate(user=self.suspended_admin)
        response = self.client.get('/api/daycare/profile/')
        # Should be blocked by IsDaycareAdmin permission
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    def test_standard_user_access_blocked(self):
        self.client.force_authenticate(user=self.standard_user)
        response = self.client.get('/api/daycare/profile/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    def test_superadmin_access_blocked(self):
        # SuperAdmins should use the SuperAdmin portal, not the Daycare portal endpoints directly
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get('/api/daycare/profile/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_tenant_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/daycare/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['daycare_name'], "Daycare A")
        self.assertEqual(response.data['status'], "Active")
        
        # Test admin_b
        self.client.force_authenticate(user=self.admin_b)
        response = self.client.get('/api/daycare/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['daycare_name'], "Daycare B")
