"""
Schedule and Attendance Domain Services.
Business logic for shift scheduling, conflict checking, and leave approvals.
"""
from core.models import StaffSchedule, LeaveRequest

class ScheduleService:
    @staticmethod
    def get_upcoming_shifts(daycare):
        return StaffSchedule.objects.filter(employee__daycare=daycare).order_by('date')

    @staticmethod
    def get_pending_leaves(daycare):
        return LeaveRequest.objects.filter(employee__daycare=daycare, status='Pending')
