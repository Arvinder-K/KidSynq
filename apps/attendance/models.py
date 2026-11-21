"""
Attendance app models.
Re-exports attendance and activity logging entities from core.models.
"""
from core.models import (
    StudentAttendance, StaffAttendance, DailyReport,
    MealRecord, NapRecord, ActivityRecord
)

__all__ = [
    'StudentAttendance',
    'StaffAttendance',
    'DailyReport',
    'MealRecord',
    'NapRecord',
    'ActivityRecord',
]

