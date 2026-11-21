from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from core.models import Daycare, User, Student, Guardian, Family, FamilyChild, FamilyGuardian

class FamilyChildAssociationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Daycare A
        self.daycare_a = Daycare.objects.create(name="Daycare A", status="Active")
        
        # Family A
        self.family_a = Family.objects.create(daycare=self.daycare_a, family_name="Family A")
        self.student_a1 = Student.objects.create(daycare=self.daycare_a, first_name="A1", last_name="Kid", dob="2020-01-01")
        self.student_a2 = Student.objects.create(daycare=self.daycare_a, first_name="A2", last_name="Kid", dob="2021-06-01")
        FamilyChild.objects.create(family=self.family_a, student=self.student_a1)
        FamilyChild.objects.create(family=self.family_a, student=self.student_a2)

        # Guardian A
        self.user_a = User.objects.create_user(username="guardian_a", email="guardian_a@test.com", password="password", daycare=self.daycare_a)
        self.guardian_a = Guardian.objects.create(user=self.user_a, daycare=self.daycare_a, first_name="Mary", last_name="A")
        FamilyGuardian.objects.create(family=self.family_a, guardian=self.guardian_a, relationship="Mother")

        # Family B
        self.family_b = Family.objects.create(daycare=self.daycare_a, family_name="Family B")
        self.student_b = Student.objects.create(daycare=self.daycare_a, first_name="B1", last_name="Child", dob="2022-01-01")
        FamilyChild.objects.create(family=self.family_b, student=self.student_b)

        # Guardian B
        self.user_b = User.objects.create_user(username="guardian_b", email="guardian_b@test.com", password="password", daycare=self.daycare_a)
        self.guardian_b = Guardian.objects.create(user=self.user_b, daycare=self.daycare_a, first_name="John", last_name="B")
        FamilyGuardian.objects.create(family=self.family_b, guardian=self.guardian_b, relationship="Father")

    def test_guardian_can_fetch_own_children(self):
        """Guardian A can fetch A1 and A2, but not B1"""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(reverse('family_children_list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        
        # Verify student names
        names = [child['first_name'] for child in response.data]
        self.assertIn("A1", names)
        self.assertIn("A2", names)
        self.assertNotIn("B1", names)

    def test_guardian_can_get_own_child_detail(self):
        """Guardian A can query student_a1 details"""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(reverse('family_child_detail', kwargs={'pk': self.student_a1.id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['first_name'], "A1")
        self.assertEqual(response.data['daycare_name'], "Daycare A")
        self.assertIn("years old", response.data['age'])

    def test_cross_family_detail_access_is_blocked(self):
        """Guardian A is forbidden from querying student_b details"""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(reverse('family_child_detail', kwargs={'pk': self.student_b.id}))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("permission", response.data['detail'])

    def test_endpoints_are_strictly_read_only(self):
        """Guardian cannot modify child details (POST, PUT, PATCH, DELETE are blocked)"""
        self.client.force_authenticate(user=self.user_a)
        
        # Try updating details
        response_put = self.client.put(reverse('family_child_detail', kwargs={'pk': self.student_a1.id}), {
            "first_name": "Hack"
        })
        self.assertEqual(response_put.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        response_patch = self.client.patch(reverse('family_child_detail', kwargs={'pk': self.student_a1.id}), {
            "enrollment_status": "Waitlist"
        })
        self.assertEqual(response_patch.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        response_delete = self.client.delete(reverse('family_child_detail', kwargs={'pk': self.student_a1.id}))
        self.assertEqual(response_delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
