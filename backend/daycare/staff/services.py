"""
Staff and Educator Domain Services.
Business logic for employee onboarding, credential tracking, and certifications.
"""
from core.models import Employee, ECECredential

class StaffService:
    @staticmethod
    def get_expiring_credentials(daycare, days=30):
        return ECECredential.objects.filter(employee__daycare=daycare)

    @staticmethod
    def get_active_employees(daycare):
        return Employee.objects.filter(daycare=daycare, is_active=True)
