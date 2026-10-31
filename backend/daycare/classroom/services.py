"""
Classroom and Program Domain Services.
Business logic for classroom capacity, teacher assignment, and program rosters.
"""
from core.models import Classroom, ClassroomTeacherAssignment

class ClassroomService:
    @staticmethod
    def get_classroom_teachers(classroom_id):
        return ClassroomTeacherAssignment.objects.filter(classroom_id=classroom_id, is_active=True)

    @staticmethod
    def get_daycare_classrooms(daycare):
        return Classroom.objects.filter(daycare=daycare)
