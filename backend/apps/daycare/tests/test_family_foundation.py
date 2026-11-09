from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from core.models import Daycare, User, Family, Guardian, FamilyGuardian, FamilyChild, GuardianCommunicationPreference, Student

class FamilyFoundationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Daycare A
        self.daycare_a = Daycare.objects.create(name="Daycare A", status="Active")
        self.admin_a = User.objects.create_user(username="admin_a", email="admin_a@test.com", password="password", is_staff=True, daycare=self.daycare_a)
        
        # Guardian A1
        self.user_a1 = User.objects.create_user(username="guardian_a1", email="a1@test.com", password="password", is_staff=False, daycare=self.daycare_a)
        self.guardian_a1 = Guardian.objects.create(user=self.user_a1, daycare=self.daycare_a, first_name="John", last_name="Doe", email="a1@test.com", phone="12345")
        
        # Family A
        self.family_a = Family.objects.create(daycare=self.daycare_a, family_name="Doe Family", primary_contact="John Doe", primary_email="a1@test.com", primary_phone="12345")
        self.fg_a1 = FamilyGuardian.objects.create(family=self.family_a, guardian=self.guardian_a1, relationship="Father", is_primary=True)
        self.pref_a1 = GuardianCommunicationPreference.objects.create(guardian=self.guardian_a1, email_alerts=True, sms_alerts=True)

        # Daycare B
        self.daycare_b = Daycare.objects.create(name="Daycare B", status="Active")
        
        # Guardian B1
        self.user_b1 = User.objects.create_user(username="guardian_b1", email="b1@test.com", password="password", is_staff=False, daycare=self.daycare_b)
        self.guardian_b1 = Guardian.objects.create(user=self.user_b1, daycare=self.daycare_b, first_name="Jane", last_name="Smith", email="b1@test.com", phone="67890")
        
        # Family B
        self.family_b = Family.objects.create(daycare=self.daycare_b, family_name="Smith Family", primary_contact="Jane Smith", primary_email="b1@test.com", primary_phone="67890")
        self.fg_b1 = FamilyGuardian.objects.create(family=self.family_b, guardian=self.guardian_b1, relationship="Mother", is_primary=True)

    def test_guardian_role_resolution(self):
        """Verify get_role returns 'Guardian' for user linked to a Guardian profile"""
        self.client.force_authenticate(user=self.user_a1)
        response = self.client.get(reverse('profile_detail'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], 'Guardian')

    def test_get_family_profile(self):
        """Guardian A1 can retrieve their family profile"""
        self.client.force_authenticate(user=self.user_a1)
        response = self.client.get(reverse('family_profile'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['family_name'], 'Doe Family')
        self.assertEqual(response.data['primary_contact'], 'John Doe')

    def test_patch_family_profile(self):
        """Guardian A1 can update family details"""
        self.client.force_authenticate(user=self.user_a1)
        payload = {
            "family_name": "New Doe Family Name",
            "address": "123 Main St, Toronto"
        }
        response = self.client.patch(reverse('family_profile'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['family_name'], 'New Doe Family Name')
        self.assertEqual(response.data['address'], '123 Main St, Toronto')

    def test_get_family_guardians(self):
        """Guardian A1 gets a list of guardians in Family A"""
        self.client.force_authenticate(user=self.user_a1)
        response = self.client.get(reverse('family_guardians'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['first_name'], 'John')
        self.assertEqual(response.data[0]['relationship'], 'Father')
        self.assertTrue(response.data[0]['is_primary'])

    def test_add_family_guardian_with_account(self):
        """Guardian A1 can add a new guardian and spawn a User account"""
        self.client.force_authenticate(user=self.user_a1)
        payload = {
            "first_name": "Mary",
            "last_name": "Doe",
            "preferred_name": "Mare",
            "email": "mary.doe@test.com",
            "phone": "555-1234",
            "relationship": "Mother",
            "is_primary": False,
            "communication_preferences": {
                "email_alerts": True,
                "sms_alerts": False,
                "emergency_alerts_only": True
            }
        }
        response = self.client.post(reverse('family_guardians'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['first_name'], 'Mary')
        self.assertEqual(response.data['relationship'], 'Mother')
        
        # Verify user account creation
        user_exists = User.objects.filter(email="mary.doe@test.com").exists()
        self.assertTrue(user_exists)

        # Verify communication preference settings
        guardian_obj = Guardian.objects.get(email="mary.doe@test.com")
        self.assertEqual(guardian_obj.communication_preference.emergency_alerts_only, True)

    def test_patch_family_guardian_details(self):
        """Guardian A1 can edit details of a guardian belonging to the same family"""
        self.client.force_authenticate(user=self.user_a1)
        
        # Add Mary first
        mary = Guardian.objects.create(daycare=self.daycare_a, first_name="Mary", last_name="Doe", email="mary.doe2@test.com")
        FamilyGuardian.objects.create(family=self.family_a, guardian=mary, relationship="Mother", is_primary=False)
        
        payload = {
            "preferred_name": "Mare-Mare",
            "relationship": "Step-Mother",
            "communication_preferences": {
                "sms_alerts": True
            }
        }
        url = reverse('family_guardian_detail', kwargs={'pk': mary.id})
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['preferred_name'], 'Mare-Mare')
        self.assertEqual(response.data['relationship'], 'Step-Mother')
        
        mary.refresh_from_db()
        self.assertEqual(mary.communication_preference.sms_alerts, True)

    def test_tenant_isolation_family(self):
        """Guardian A1 cannot view/edit Family B profile"""
        self.client.force_authenticate(user=self.user_a1)
        
        # Guardian A1 tries to request Family B data via their profile view (it will only resolve their own, which is Family A)
        response = self.client.get(reverse('family_profile'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(response.data['family_name'], 'Smith Family')

        # Guardian A1 attempts to patch details of Guardian B1
        url = reverse('family_guardian_detail', kwargs={'pk': self.guardian_b1.id})
        payload = {"first_name": "Hacked Name"}
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
