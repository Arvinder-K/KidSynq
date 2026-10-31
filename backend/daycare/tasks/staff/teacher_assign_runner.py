import os
import django
import sys
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import User, ConsentForm, Student
from rest_framework.test import APIRequestFactory, force_authenticate
from daycare.views.consent_forms import ConsentFormAssignView

daycare = User.objects.filter(daycare__isnull=False).first().daycare
admin = User.objects.filter(daycare=daycare).first()

form = ConsentForm.objects.filter(daycare=daycare).first()
if not form:
    form = ConsentForm.objects.create(daycare=daycare, title="Test Form", content="Test")

student = Student.objects.filter(daycare=daycare).first()
if not student:
    student = Student.objects.create(daycare=daycare, first_name="Test", last_name="Student")

factory = APIRequestFactory()
request = factory.post(f'/api/daycare/consent-forms/{form.id}/assign/', {'student_ids': [str(student.id)]}, format='json')
force_authenticate(request, user=admin)
request.user = admin

view = ConsentFormAssignView.as_view()
response = view(request, pk=form.id)
print("Response status:", response.status_code)
print("Response data:", response.data)
