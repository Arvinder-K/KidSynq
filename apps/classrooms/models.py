"""
Classrooms app models.
Re-exports classroom and curriculum entities from core.models.
"""
from core.models import Classroom, ClassroomStudent, ClassroomTeacherAssignment, Program, RatioRule

__all__ = [
    'Classroom',
    'ClassroomStudent',
    'ClassroomTeacherAssignment',
    'Program',
    'RatioRule',
]

