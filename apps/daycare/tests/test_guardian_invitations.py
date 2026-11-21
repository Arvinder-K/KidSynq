from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta
from core.models import Daycare, User, Student, GuardianInvitation, GuardianPasswordResetToken, Guardian, Family, FamilyChild, FamilyGuardian

class GuardianInvitationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Daycare A
        self.daycare_a = Daycare.objects.create(name="Daycare A", status="Active")
        self.admin_a = User.objects.create_user(username="admin_a", email="admin_a@test.com", password="password", is_staff=True, daycare=self.daycare_a)
        self.student_a = Student.objects.create(daycare=self.daycare_a, first_name="Billy", last_name="Kid")

        # Daycare B
        self.daycare_b = Daycare.objects.create(name="Daycare B", status="Active")
        self.admin_b = User.objects.create_user(username="admin_b", email="admin_b@test.com", password="password", is_staff=True, daycare=self.daycare_b)
        self.student_b = Student.objects.create(daycare=self.daycare_b, first_name="Sally", last_name="Child")

    def test_create_invitation_success(self):
        """Admin A can successfully invite a guardian for Student A"""
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "student": self.student_a.id,
            "email": "guardian@test.com",
            "relationship": "Mother"
        }
        response = self.client.post(reverse('daycare_invitations'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'pending')
        self.assertIsNotNone(response.data['token'])
        self.assertEqual(response.data['relationship'], 'Mother')

    def test_duplicate_invitation_rejection(self):
        """Admin A cannot invite the same guardian for the same student twice while pending"""
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "student": self.student_a.id,
            "email": "guardian@test.com",
            "relationship": "Mother"
        }
        response = self.client.post(reverse('daycare_invitations'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Try duplicate invitation
        response_dup = self.client.post(reverse('daycare_invitations'), payload, format='json')
        self.assertEqual(response_dup.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("A pending invitation already exists", response_dup.data['detail'])

    def test_resend_and_cancel_invitation(self):
        """Admin A can resend and cancel invitations"""
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "student": self.student_a.id,
            "email": "guardian@test.com",
            "relationship": "Father"
        }
        response = self.client.post(reverse('daycare_invitations'), payload, format='json')
        inv_id = response.data['id']
        old_token = response.data['token']

        # Resend
        resend_response = self.client.post(reverse('daycare_invitation_resend', kwargs={'pk': inv_id}))
        self.assertEqual(resend_response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(resend_response.data['token'], old_token)
        self.assertEqual(resend_response.data['status'], 'pending')

        # Cancel
        cancel_response = self.client.post(reverse('daycare_invitation_cancel', kwargs={'pk': inv_id}))
        self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_response.data['status'], 'cancelled')

    def test_activation_validation(self):
        """Guardian can fetch activation details using a valid token"""
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "student": self.student_a.id,
            "email": "guardian@test.com",
            "relationship": "Mother"
        }
        inv_res = self.client.post(reverse('daycare_invitations'), payload, format='json')
        token = inv_res.data['token']

        # Validate token
        self.client.force_authenticate(user=None) # Anonymous
        val_res = self.client.get(f"{reverse('guardian_activate')}?token={token}")
        self.assertEqual(val_res.status_code, status.HTTP_200_OK)
        self.assertEqual(val_res.data['email'], 'guardian@test.com')
        self.assertEqual(val_res.data['student_name'], 'Billy Kid')

    def test_expired_or_cancelled_token_rejection(self):
        """Expired or cancelled tokens are rejected during activation"""
        # Cancelled token
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "student": self.student_a.id,
            "email": "guardian@test.com",
            "relationship": "Mother"
        }
        inv_res = self.client.post(reverse('daycare_invitations'), payload, format='json')
        token_cancelled = inv_res.data['token']
        self.client.post(reverse('daycare_invitation_cancel', kwargs={'pk': inv_res.data['id']}))

        self.client.force_authenticate(user=None)
        val_res = self.client.get(f"{reverse('guardian_activate')}?token={token_cancelled}")
        self.assertEqual(val_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancelled", val_res.data['detail'])

        # Expired token
        self.client.force_authenticate(user=self.admin_a)
        inv_res2 = self.client.post(reverse('daycare_invitations'), payload, format='json')
        inv_obj = GuardianInvitation.objects.get(id=inv_res2.data['id'])
        inv_obj.expires_at = timezone.now() - timedelta(hours=1)
        inv_obj.save()

        self.client.force_authenticate(user=None)
        val_res2 = self.client.get(f"{reverse('guardian_activate')}?token={inv_obj.token}")
        self.assertEqual(val_res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", val_res2.data['detail'])

    def test_activation_creates_account_and_family_links(self):
        """Submitting activation correctly configures User, Guardian, Family, and links child"""
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "student": self.student_a.id,
            "email": "guardian@test.com",
            "relationship": "Mother"
        }
        inv_res = self.client.post(reverse('daycare_invitations'), payload, format='json')
        token = inv_res.data['token']

        # Activate
        self.client.force_authenticate(user=None)
        act_payload = {
            "token": token,
            "password": "SecurePassword123!",
            "first_name": "Mary",
            "last_name": "Doe",
            "phone": "555-4321"
        }
        act_res = self.client.post(reverse('guardian_activate'), act_payload, format='json')
        self.assertEqual(act_res.status_code, status.HTTP_200_OK)

        # Assert User creation
        user_exists = User.objects.filter(email="guardian@test.com").exists()
        self.assertTrue(user_exists)
        user_obj = User.objects.get(email="guardian@test.com")
        self.assertEqual(user_obj.first_name, "Mary")

        # Assert Guardian profile creation
        self.assertTrue(hasattr(user_obj, 'guardian_profile'))
        guardian = user_obj.guardian_profile

        # Assert Family link (since student was not in a family, new family should be spawned)
        family_guardian = guardian.guardian_families.first()
        self.assertIsNotNone(family_guardian)
        family = family_guardian.family
        self.assertEqual(family.family_name, "Kid Family")
        self.assertEqual(family_guardian.relationship, "Mother")

        # Assert Child association
        family_child = family.family_children.first()
        self.assertIsNotNone(family_child)
        self.assertEqual(family_child.student, self.student_a)

    def test_guardian_access_after_activation(self):
        """Guardian can log in and view their family profile after activation"""
        # Invite and Activate
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "student": self.student_a.id,
            "email": "guardian@test.com",
            "relationship": "Father"
        }
        inv_res = self.client.post(reverse('daycare_invitations'), payload, format='json')
        token = inv_res.data['token']

        self.client.force_authenticate(user=None)
        act_payload = {
            "token": token,
            "password": "SecurePassword123!",
            "first_name": "John",
            "last_name": "Doe",
            "phone": "555-4321"
        }
        self.client.post(reverse('guardian_activate'), act_payload, format='json')

        # Retrieve token (Login)
        login_res = self.client.post(reverse('token_obtain_pair'), {
            "username": "guardian@test.com",
            "password": "SecurePassword123!"
        }, format='json')
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        access_token = login_res.data['access']

        # Access profile endpoint
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        profile_res = self.client.get(reverse('family_profile'))
        self.assertEqual(profile_res.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_res.data['family_name'], 'Kid Family')

    def test_forgot_and_reset_password(self):
        """Guardian can request password reset and set new credentials"""
        # Create active Guardian
        user = User.objects.create_user(username="g1@test.com", email="g1@test.com", password="old_password", daycare=self.daycare_a)
        guardian = Guardian.objects.create(user=user, daycare=self.daycare_a, first_name="John", last_name="Doe", email="g1@test.com")
        family = Family.objects.create(daycare=self.daycare_a, family_name="Doe Family")
        FamilyGuardian.objects.create(family=family, guardian=guardian, relationship="Father")

        # Forgot password
        self.client.force_authenticate(user=None)
        forgot_res = self.client.post(reverse('guardian_forgot_password'), {"email": "g1@test.com"}, format='json')
        self.assertEqual(forgot_res.status_code, status.HTTP_200_OK)

        reset_token_obj = GuardianPasswordResetToken.objects.get(user=user, used=False)
        
        # Reset password
        reset_res = self.client.post(reverse('guardian_reset_password'), {
            "token": reset_token_obj.token,
            "password": "NewSecurePassword123!"
        }, format='json')
        self.assertEqual(reset_res.status_code, status.HTTP_200_OK)

        # Verify login with new password
        login_res = self.client.post(reverse('token_obtain_pair'), {
            "username": "g1@test.com",
            "password": "NewSecurePassword123!"
        }, format='json')
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
