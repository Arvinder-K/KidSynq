"""
Child and Student Domain Services.
Business logic for student onboarding, health compliance, and safe arrivals.
"""
from core.models import Student, HealthProfile, SafeArrivalDepartureEvent

class ChildService:
    @staticmethod
    def get_child_health_summary(student_id):
        return HealthProfile.objects.filter(student_id=student_id).first()

    @staticmethod
    def get_active_students(daycare):
        return Student.objects.filter(daycare=daycare, is_active=True)
